import type { Notifier } from '../notifications/index.js';
import type {
  IRepositoryModel,
  ConfirmedSubscriptionWithToken,
} from '../subscriptions/index.js';
import type { Release } from '../github/index.js';
import type { ILogger } from '../../platform/logger.js';
import {
  scannerEmailsSentTotal,
  scannerReleasesDetectedTotal,
} from '../../metrics/index.js';

/** Reacts to a newly detected release. The in-process implementation records
 *  the tag best-effort (before sending) and notifies subscribers, so a failed
 *  send to one subscriber doesn't re-notify everyone else on the next scan;
 *  in a later phase this seam is replaced by publishing a `release.detected`
 *  event. */
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
    scannerReleasesDetectedTotal.inc({ repo });

    await this.repositoryModel.updateLastSeenTag(repo, release.tag_name);

    const results = await Promise.allSettled(
      subscribers.map(async (sub) =>
        this.notifier
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

    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(
          { err: result.reason as unknown, repo },
          'ReleaseHandler: failed to send notification email',
        );
      }
    }
  }
}
