import crypto from 'node:crypto';
import type { Subscription } from '../types.js';
import {
  DuplicateSubscriptionError,
  InvalidTokenError,
  RepositoryNotFoundError,
  TokenNotFoundError,
} from '../errors.js';
import { subscriptionModel } from '../models/subscriptionModel.js';
import { emailService } from './emailService.js';
import { githubService } from './githubService.js';

const TOKEN_REGEX = /^[0-9a-f]{64}$/;

export class SubscriptionService {
  async subscribe(email: string, repo: string): Promise<void> {
    const exists = await githubService.repositoryExists(repo);
    if (!exists) throw new RepositoryNotFoundError(repo);

    const alreadySubscribed = await subscriptionModel.existsByEmailAndRepo(
      email,
      repo,
    );
    if (alreadySubscribed) throw new DuplicateSubscriptionError(email, repo);

    const confirmToken = crypto.randomBytes(32).toString('hex');
    const unsubscribeToken = crypto.randomBytes(32).toString('hex');

    await subscriptionModel.create(email, repo, confirmToken, unsubscribeToken);
    await emailService.sendConfirmationEmail(email, confirmToken, repo);
  }

  async confirm(token: string): Promise<void> {
    if (!TOKEN_REGEX.test(token)) throw new InvalidTokenError();
    const found = await subscriptionModel.confirm(token);
    if (!found) throw new TokenNotFoundError();
  }

  async unsubscribe(token: string): Promise<void> {
    if (!TOKEN_REGEX.test(token)) throw new InvalidTokenError();
    const found = await subscriptionModel.deleteByUnsubscribeToken(token);
    if (!found) throw new TokenNotFoundError();
  }

  async getSubscriptions(email: string): Promise<Subscription[]> {
    return subscriptionModel.findByEmail(email);
  }
}

export const subscriptionService = new SubscriptionService();
