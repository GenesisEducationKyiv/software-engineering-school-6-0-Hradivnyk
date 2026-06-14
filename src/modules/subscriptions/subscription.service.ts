import crypto from 'node:crypto';
import type {
  Subscription,
  ISubscriptionService,
} from './subscription.types.js';
import {
  DuplicateSubscriptionError,
  InvalidTokenError,
  RepositoryNotFoundError,
  TokenNotFoundError,
} from './subscription.errors.js';
import type { ISubscriptionModel } from './subscription.model.js';
import { subscriptionOperationsTotal } from '../../metrics/index.js';
import logger from '../../platform/logger.js';
import type { Notifier } from '../notifications/index.js';
import type { IGithubService } from '../github/index.js';
import { isValidToken } from './token.js';

const hashEmail = (email: string): string =>
  crypto.createHash('sha256').update(email).digest('hex').slice(0, 12);

export class SubscriptionService implements ISubscriptionService {
  constructor(
    private readonly subscriptionModel: ISubscriptionModel,
    private readonly notifier: Notifier,
    private readonly githubService: IGithubService,
  ) {}

  async subscribe(email: string, repo: string): Promise<void> {
    const exists = await this.githubService.repositoryExists(repo);
    if (!exists) {
      subscriptionOperationsTotal.inc({
        operation: 'subscribe',
        result: 'repo_not_found',
      });
      throw new RepositoryNotFoundError(repo);
    }

    const alreadySubscribed = await this.subscriptionModel.existsByEmailAndRepo(
      email,
      repo,
    );
    if (alreadySubscribed) {
      logger.warn(
        { event: 'subscription.duplicate', emailHash: hashEmail(email), repo },
        'Duplicate subscription attempt',
      );
      subscriptionOperationsTotal.inc({
        operation: 'subscribe',
        result: 'duplicate',
      });
      throw new DuplicateSubscriptionError(email, repo);
    }

    const confirmToken = crypto.randomBytes(32).toString('hex');
    const unsubscribeToken = crypto.randomBytes(32).toString('hex');

    await this.notifier.sendConfirmationEmail(email, confirmToken, repo);
    await this.subscriptionModel.create(
      email,
      repo,
      confirmToken,
      unsubscribeToken,
    );
    subscriptionOperationsTotal.inc({
      operation: 'subscribe',
      result: 'success',
    });
    logger.info(
      { event: 'subscription.created', emailHash: hashEmail(email), repo },
      'Subscription created',
    );
  }

  async confirm(token: string): Promise<void> {
    if (!isValidToken(token)) {
      subscriptionOperationsTotal.inc({
        operation: 'confirm',
        result: 'invalid_token',
      });
      throw new InvalidTokenError();
    }
    const sub = await this.subscriptionModel.confirm(token);
    if (!sub) {
      subscriptionOperationsTotal.inc({
        operation: 'confirm',
        result: 'not_found',
      });
      throw new TokenNotFoundError();
    }
    subscriptionOperationsTotal.inc({
      operation: 'confirm',
      result: 'success',
    });
    logger.info(
      {
        event: 'subscription.confirmed',
        emailHash: hashEmail(sub.email),
        repo: sub.repo,
      },
      'Subscription confirmed',
    );
  }

  async unsubscribe(token: string): Promise<void> {
    if (!isValidToken(token)) {
      subscriptionOperationsTotal.inc({
        operation: 'unsubscribe',
        result: 'invalid_token',
      });
      throw new InvalidTokenError();
    }
    const sub = await this.subscriptionModel.deleteByUnsubscribeToken(token);
    if (!sub) {
      subscriptionOperationsTotal.inc({
        operation: 'unsubscribe',
        result: 'not_found',
      });
      throw new TokenNotFoundError();
    }
    subscriptionOperationsTotal.inc({
      operation: 'unsubscribe',
      result: 'success',
    });
    logger.info(
      {
        event: 'subscription.unsubscribed',
        emailHash: hashEmail(sub.email),
        repo: sub.repo,
      },
      'Subscription unsubscribed',
    );
  }

  async getSubscriptions(email: string): Promise<Subscription[]> {
    return this.subscriptionModel.findByEmail(email);
  }
}
