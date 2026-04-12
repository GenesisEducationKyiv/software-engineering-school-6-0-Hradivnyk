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
  async scan(): Promise<void> {
    logger.info('Scanner: starting release check');

    const subscriptions = await subscriptionModel.findAllConfirmedWithTokens();

    if (subscriptions.length === 0) {
      logger.info('Scanner: no active subscriptions, skipping');
      return;
    }

    const byRepo = groupByRepo(subscriptions);

    for (const [repo, subscribers] of byRepo) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const release = await githubService.getLatestRelease(repo);

        if (!release) {
          logger.debug({ repo }, 'Scanner: no releases found');
          continue;
        }

        const lastSeenTag = subscribers[0].last_seen_tag;

        if (release.tag_name === lastSeenTag) {
          logger.debug(
            { repo, tag: release.tag_name },
            'Scanner: no new release',
          );
          continue;
        }

        logger.info(
          { repo, tag: release.tag_name },
          'Scanner: new release detected, sending notifications',
        );

        // eslint-disable-next-line no-await-in-loop
        await Promise.allSettled(
          subscribers.map((sub) =>
            emailService
              .sendNotificationEmail(
                sub.email,
                repo,
                release.tag_name,
                sub.unsubscribe_token,
              )
              .catch((err: unknown) => {
                logger.error(
                  { err, email: sub.email, repo },
                  'Scanner: failed to send notification email',
                );
              }),
          ),
        );

        // eslint-disable-next-line no-await-in-loop
        await subscriptionModel.updateLastSeenTag(repo, release.tag_name);
      } catch (err) {
        logger.error({ err, repo }, 'Scanner: error processing repo');
      }
    }

    logger.info('Scanner: release check complete');
  }

  start(): void {
    if (!cron.validate(config.scanner.cronSchedule)) {
      throw new Error(
        `Invalid cron schedule: "${config.scanner.cronSchedule}". Check SCANNER_CRON_SCHEDULE in your .env file.`,
      );
    }

    cron.schedule(config.scanner.cronSchedule, () => {
      this.scan().catch((err: unknown) => {
        logger.error({ err }, 'Scanner: unhandled error during scan');
      });
    });

    logger.info(
      { schedule: config.scanner.cronSchedule },
      'Scanner: scheduled',
    );
  }
}

export const scannerService = new ScannerService();
