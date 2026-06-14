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
import type { Notifier } from '../notifications/index.js';
import type { IGithubService } from '../github/index.js';
import { isValidToken } from './token.js';

export class SubscriptionService implements ISubscriptionService {
  constructor(
    private readonly subscriptionModel: ISubscriptionModel,
    private readonly notifier: Notifier,
    private readonly githubService: IGithubService,
  ) {}

  async subscribe(email: string, repo: string): Promise<void> {
    const exists = await this.githubService.repositoryExists(repo);
    if (!exists) throw new RepositoryNotFoundError(repo);

    const alreadySubscribed = await this.subscriptionModel.existsByEmailAndRepo(
      email,
      repo,
    );
    if (alreadySubscribed) throw new DuplicateSubscriptionError(email, repo);

    const confirmToken = crypto.randomBytes(32).toString('hex');
    const unsubscribeToken = crypto.randomBytes(32).toString('hex');

    await this.notifier.sendConfirmationEmail(email, confirmToken, repo);
    await this.subscriptionModel.create(
      email,
      repo,
      confirmToken,
      unsubscribeToken,
    );
  }

  async confirm(token: string): Promise<void> {
    if (!isValidToken(token)) throw new InvalidTokenError();
    const found = await this.subscriptionModel.confirm(token);
    if (!found) throw new TokenNotFoundError();
  }

  async unsubscribe(token: string): Promise<void> {
    if (!isValidToken(token)) throw new InvalidTokenError();
    const found = await this.subscriptionModel.deleteByUnsubscribeToken(token);
    if (!found) throw new TokenNotFoundError();
  }

  async getSubscriptions(email: string): Promise<Subscription[]> {
    return this.subscriptionModel.findByEmail(email);
  }
}
