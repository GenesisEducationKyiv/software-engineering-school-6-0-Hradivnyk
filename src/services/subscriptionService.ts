import crypto from 'node:crypto';
import type { Subscription } from '../types.js';
import {
  DuplicateSubscriptionError,
  InvalidTokenError,
  RepositoryNotFoundError,
  TokenNotFoundError,
} from '../errors.js';
import type { ISubscriptionModel } from '../models/subscriptionModel.js';
import { subscriptionModel } from '../models/subscriptionModel.js';
import type { IEmailService } from './emailService.js';
import { emailService } from './emailService.js';
import type { IGithubService } from './githubService.js';
import { githubService } from './githubService.js';

const TOKEN_REGEX = /^[0-9a-f]{64}$/;

export interface ISubscriptionService {
  subscribe(email: string, repo: string): Promise<void>;
  confirm(token: string): Promise<void>;
  unsubscribe(token: string): Promise<void>;
  getSubscriptions(email: string): Promise<Subscription[]>;
}

export class SubscriptionService implements ISubscriptionService {
  constructor(
    private readonly subscriptionModel: ISubscriptionModel,
    private readonly emailService: IEmailService,
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

    await this.subscriptionModel.create(
      email,
      repo,
      confirmToken,
      unsubscribeToken,
    );
    await this.emailService.sendConfirmationEmail(email, confirmToken, repo);
  }

  async confirm(token: string): Promise<void> {
    if (!TOKEN_REGEX.test(token)) throw new InvalidTokenError();
    const found = await this.subscriptionModel.confirm(token);
    if (!found) throw new TokenNotFoundError();
  }

  async unsubscribe(token: string): Promise<void> {
    if (!TOKEN_REGEX.test(token)) throw new InvalidTokenError();
    const found = await this.subscriptionModel.deleteByUnsubscribeToken(token);
    if (!found) throw new TokenNotFoundError();
  }

  async getSubscriptions(email: string): Promise<Subscription[]> {
    return this.subscriptionModel.findByEmail(email);
  }
}

export const subscriptionService = new SubscriptionService(
  subscriptionModel,
  emailService,
  githubService,
);
