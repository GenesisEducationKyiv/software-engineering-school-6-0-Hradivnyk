import cron from 'node-cron';
import { config } from '../config/index.js';
import type {
  ConfirmedSubscriptionWithToken,
  ISubscriptionModel,
} from '../models/subscriptionModel.js';
import type { IRepositoryModel } from '../models/repositoryModel.js';
import {
  scannerEmailsSentTotal,
  scannerReleasesDetectedTotal,
  scannerScanDurationSeconds,
} from '../metrics/index.js';
import logger from '../utils/logger.js';
import type { ILogger } from '../utils/logger.js';
import type { IEmailService } from './emailService.js';
import type { IGithubService } from './githubService.js';
import { GitHubRateLimitError } from '../errors.js';

function groupByRepo(
  subscriptions: ConfirmedSubscriptionWithToken[],
): Map<string, ConfirmedSubscriptionWithToken[]> {
  const map = new Map<string, ConfirmedSubscriptionWithToken[]>();
  for (const sub of subscriptions) {
    const list = map.get(sub.repo) ?? [];
    list.push(sub);
    map.set(sub.repo, list);
  }
  return map;
}

export class ScannerService {
  constructor(
    private readonly subscriptionModel: ISubscriptionModel,
    private readonly repositoryModel: IRepositoryModel,
    private readonly emailService: IEmailService,
    private readonly githubService: IGithubService,
    private readonly logger: ILogger,
  ) {}

  private async processRepo(
    repo: string,
    subscribers: ConfirmedSubscriptionWithToken[],
  ): Promise<void> {
    try {
      const release = await this.githubService.getLatestRelease(repo);

      if (!release) {
        this.logger.debug(
          { event: 'scanner.no_releases', repo },
          'No releases found',
        );
        return;
      }

      const lastSeenTag = subscribers[0].last_seen_tag;

      if (release.tag_name === lastSeenTag) {
        this.logger.debug(
          { event: 'scanner.no_new_release', repo, tag: release.tag_name },
          'No new release',
        );
        return;
      }

      this.logger.info(
        { event: 'scanner.release_detected', repo, tag: release.tag_name },
        'New release detected',
      );

      scannerReleasesDetectedTotal.inc({ repo });

      const results = await Promise.allSettled(
        subscribers.map(async (sub) =>
          this.emailService
            .sendNotificationEmail(
              sub.email,
              repo,
              release.tag_name,
              sub.unsubscribe_token,
            )
            .then(() => {
              scannerEmailsSentTotal.inc({ repo });
            }),
        ),
      );

      const failures = results.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );
      for (const failure of failures) {
        this.logger.error(
          {
            event: 'scanner.notification_failed',
            err: failure.reason as unknown,
            repo,
          },
          'Failed to send notification email',
        );
      }

      if (failures.length > 0) return;

      await this.repositoryModel.updateLastSeenTag(repo, release.tag_name);
    } catch (err) {
      if (err instanceof GitHubRateLimitError) throw err;
      this.logger.error(
        { event: 'scanner.repo_error', err, repo },
        'Error processing repo',
      );
    }
  }

  async scan(): Promise<void> {
    const endTimer = scannerScanDurationSeconds.startTimer();
    let result = 'success';
    try {
      this.logger.info(
        { event: 'scanner.check_started' },
        'Starting release check',
      );

      const subscriptions =
        await this.subscriptionModel.findAllConfirmedWithTokens();

      if (subscriptions.length === 0) {
        this.logger.info(
          { event: 'scanner.no_subscriptions' },
          'No active subscriptions, skipping',
        );
        return;
      }

      const byRepo = groupByRepo(subscriptions);

      for (const [repo, subscribers] of byRepo.entries()) {
        // eslint-disable-next-line no-await-in-loop
        await this.processRepo(repo, subscribers); // sequential to respect GitHub API rate limits
      }

      this.logger.info(
        { event: 'scanner.check_complete' },
        'Release check complete',
      );
    } catch (err) {
      result = 'error';
      throw err;
    } finally {
      endTimer({ result });
    }
  }

  start(): void {
    if (!cron.validate(config.scanner.cronSchedule)) {
      throw new Error(
        `Invalid cron schedule: "${config.scanner.cronSchedule}". Check SCANNER_CRON_SCHEDULE in your .env file.`,
      );
    }

    cron.schedule(config.scanner.cronSchedule, () => {
      this.scan().catch((err: unknown) => {
        logger.error(
          { event: 'scanner.unhandled_error', err },
          'Unhandled error during scan',
        );
      });
    });

    logger.info(
      { event: 'scanner.scheduled', schedule: config.scanner.cronSchedule },
      'Scanner scheduled',
    );
  }
}
