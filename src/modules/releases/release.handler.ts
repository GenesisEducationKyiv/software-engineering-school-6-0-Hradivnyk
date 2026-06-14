import type { Notifier } from '../notifications/index.js';
import type {
  IRepositoryModel,
  ConfirmedSubscriptionWithToken,
} from '../subscriptions/index.js';
import type { Release } from '../github/index.js';
import type { ILogger } from '../../platform/logger.js';

/** Reacts to a newly detected release. The in-process implementation notifies
 *  subscribers and records the tag; in a later phase this seam is replaced by
 *  publishing a `release.detected` event. */
export interface ReleaseHandler {
  handle(
    repo: string,
    release: Release,
    subscribers: ConfirmedSubscriptionWithToken[],
  ): Promise<void>;
}

export class InProcessReleaseHandler implements ReleaseHandler {
  constructor(
    private readonly notifier: Notifier,
    private readonly repositoryModel: IRepositoryModel,
    private readonly logger: ILogger,
  ) {}

  async handle(
    repo: string,
    release: Release,
    subscribers: ConfirmedSubscriptionWithToken[],
  ): Promise<void> {
    const results = await Promise.allSettled(
      subscribers.map(async (sub) =>
        this.notifier.sendNotificationEmail(
          sub.email,
          repo,
          release.tag_name,
          sub.unsubscribe_token,
        ),
      ),
    );

    const failures = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    for (const failure of failures) {
      this.logger.error(
        { err: failure.reason as unknown, repo },
        'ReleaseHandler: failed to send notification email',
      );
    }

    if (failures.length > 0) return;

    await this.repositoryModel.updateLastSeenTag(repo, release.tag_name);
  }
}
