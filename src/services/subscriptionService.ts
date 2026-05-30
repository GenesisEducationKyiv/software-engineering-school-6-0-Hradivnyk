import crypto from 'node:crypto';
import type { Subscription } from '../types.js';
import {
  DuplicateSubscriptionError,
  InvalidTokenError,
  RepositoryNotFoundError,
  TokenNotFoundError,
} from '../errors.js';
import { subscriptionModel } from '../models/subscriptionModel.js';
import logger from '../utils/logger.js';
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
    if (alreadySubscribed) {
      logger.warn(
        { event: 'subscription.duplicate', email, repo },
        'Duplicate subscription attempt',
      );
      throw new DuplicateSubscriptionError(email, repo);
    }

    const confirmToken = crypto.randomBytes(32).toString('hex');
    const unsubscribeToken = crypto.randomBytes(32).toString('hex');

    await subscriptionModel.create(email, repo, confirmToken, unsubscribeToken);
    await emailService.sendConfirmationEmail(email, confirmToken, repo);
    logger.info(
      { event: 'subscription.created', email, repo },
      'Subscription created',
    );
  }

  async confirm(token: string): Promise<void> {
    if (!TOKEN_REGEX.test(token)) throw new InvalidTokenError();
    const sub = await subscriptionModel.confirm(token);
    if (!sub) throw new TokenNotFoundError();
    logger.info(
      { event: 'subscription.confirmed', email: sub.email, repo: sub.repo },
      'Subscription confirmed',
    );
  }

  async unsubscribe(token: string): Promise<void> {
    if (!TOKEN_REGEX.test(token)) throw new InvalidTokenError();
    const sub = await subscriptionModel.deleteByUnsubscribeToken(token);
    if (!sub) throw new TokenNotFoundError();
    logger.info(
      { event: 'subscription.unsubscribed', email: sub.email, repo: sub.repo },
      'Subscription unsubscribed',
    );
  }

  async getSubscriptions(email: string): Promise<Subscription[]> {
    return subscriptionModel.findByEmail(email);
  }
}

export const subscriptionService = new SubscriptionService();
