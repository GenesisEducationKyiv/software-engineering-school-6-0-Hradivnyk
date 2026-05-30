import cron from 'node-cron';
import { config } from '../config/index.js';
import type { ConfirmedSubscriptionWithToken } from '../models/subscriptionModel.js';
import { subscriptionModel } from '../models/subscriptionModel.js';
import logger from '../utils/logger.js';
import { emailService } from './emailService.js';
import { githubService } from './githubService.js';

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
  private async processRepo(
    repo: string,
    subscribers: ConfirmedSubscriptionWithToken[],
  ): Promise<void> {
    try {
      const release = await githubService.getLatestRelease(repo);

      if (!release) {
        logger.debug(
          { event: 'scanner.no_releases', repo },
          'No releases found',
        );
        return;
      }

      const lastSeenTag = subscribers[0].last_seen_tag;

      if (release.tag_name === lastSeenTag) {
        logger.debug(
          { event: 'scanner.no_new_release', repo, tag: release.tag_name },
          'No new release',
        );
        return;
      }

      logger.info(
        { event: 'scanner.release_detected', repo, tag: release.tag_name },
        'New release detected',
      );

      await Promise.allSettled(
        subscribers.map(async (sub) =>
          emailService
            .sendNotificationEmail(
              sub.email,
              repo,
              release.tag_name,
              sub.unsubscribe_token,
            )
            .catch((err: unknown) => {
              logger.error(
                {
                  event: 'scanner.notification_failed',
                  err,
                  email: sub.email,
                  repo,
                },
                'Failed to send notification email',
              );
            }),
        ),
      );

      await subscriptionModel.updateLastSeenTag(repo, release.tag_name);
    } catch (err) {
      logger.error(
        { event: 'scanner.repo_error', err, repo },
        'Error processing repo',
      );
    }
  }

  async scan(): Promise<void> {
    logger.info({ event: 'scanner.check_started' }, 'Starting release check');

    const subscriptions = await subscriptionModel.findAllConfirmedWithTokens();

    if (subscriptions.length === 0) {
      logger.info(
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

    logger.info({ event: 'scanner.check_complete' }, 'Release check complete');
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

export const scannerService = new ScannerService();
