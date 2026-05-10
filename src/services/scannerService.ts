import type {
  ConfirmedSubscriptionWithToken,
  ISubscriptionModel,
} from '../models/subscriptionModel.js';
import type { IRepositoryModel } from '../models/repositoryModel.js';
import logger from '../utils/logger.js';
import type { IEmailService } from './emailService.js';
import type { IGithubService } from './githubService.js';

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
  ) {}

  private async processRepo(
    repo: string,
    subscribers: ConfirmedSubscriptionWithToken[],
  ): Promise<void> {
    try {
      const release = await this.githubService.getLatestRelease(repo);

      if (!release) {
        logger.debug({ repo }, 'Scanner: no releases found');
        return;
      }

      const lastSeenTag = subscribers[0].last_seen_tag;

      if (release.tag_name === lastSeenTag) {
        logger.debug(
          { repo, tag: release.tag_name },
          'Scanner: no new release',
        );
        return;
      }

      logger.info(
        { repo, tag: release.tag_name },
        'Scanner: new release detected, sending notifications',
      );

      await Promise.allSettled(
        subscribers.map(async (sub) =>
          this.emailService
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

      await this.repositoryModel.updateLastSeenTag(repo, release.tag_name);
    } catch (err) {
      logger.error({ err, repo }, 'Scanner: error processing repo');
    }
  }

  async scan(): Promise<void> {
    logger.info('Scanner: starting release check');

    const subscriptions =
      await this.subscriptionModel.findAllConfirmedWithTokens();

    if (subscriptions.length === 0) {
      logger.info('Scanner: no active subscriptions, skipping');
      return;
    }

    const byRepo = groupByRepo(subscriptions);

    for (const [repo, subscribers] of byRepo.entries()) {
      // eslint-disable-next-line no-await-in-loop
      await this.processRepo(repo, subscribers); // sequential to respect GitHub API rate limits
    }

    logger.info('Scanner: release check complete');
  }
}
