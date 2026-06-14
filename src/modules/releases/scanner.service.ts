import type {
  ConfirmedSubscriptionsProvider,
  ConfirmedSubscriptionWithToken,
} from '../subscriptions/index.js';
import type { IGithubService } from '../github/index.js';
import { GitHubRateLimitError } from '../github/index.js';
import type { ILogger } from '../../platform/logger.js';
import type { ReleaseHandler } from './release.handler.js';

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
    private readonly subscriptions: ConfirmedSubscriptionsProvider,
    private readonly githubService: IGithubService,
    private readonly releaseHandler: ReleaseHandler,
    private readonly logger: ILogger,
  ) {}

  private async processRepo(
    repo: string,
    subscribers: ConfirmedSubscriptionWithToken[],
  ): Promise<void> {
    try {
      const release = await this.githubService.getLatestRelease(repo);

      if (!release) {
        this.logger.debug({ repo }, 'Scanner: no releases found');
        return;
      }

      const lastSeenTag = subscribers[0].last_seen_tag;

      if (release.tag_name === lastSeenTag) {
        this.logger.debug(
          { repo, tag: release.tag_name },
          'Scanner: no new release',
        );
        return;
      }

      this.logger.info(
        { repo, tag: release.tag_name },
        'Scanner: new release detected, sending notifications',
      );

      await this.releaseHandler.handle(repo, release, subscribers);
    } catch (err) {
      if (err instanceof GitHubRateLimitError) throw err;
      this.logger.error({ err, repo }, 'Scanner: error processing repo');
    }
  }

  async scan(): Promise<void> {
    this.logger.info('Scanner: starting release check');

    const subscriptions = await this.subscriptions.findAllConfirmedWithTokens();

    if (subscriptions.length === 0) {
      this.logger.info('Scanner: no active subscriptions, skipping');
      return;
    }

    const byRepo = groupByRepo(subscriptions);

    for (const [repo, subscribers] of byRepo.entries()) {
      // eslint-disable-next-line no-await-in-loop
      await this.processRepo(repo, subscribers); // sequential to respect GitHub API rate limits
    }

    this.logger.info('Scanner: release check complete');
  }
}
