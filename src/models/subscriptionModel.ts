import type { Knex } from 'knex';
import type { Subscription } from '../types.js';
import type { IRepositoryModel } from './repositoryModel.js';

interface SubscriptionRow {
  email: string;
  repo: string;
  last_seen_tag: string | null;
}

export interface ConfirmedSubscriptionWithToken {
  email: string;
  repo: string;
  unsubscribe_token: string;
  last_seen_tag: string | null;
}

export interface ISubscriptionModel {
  create(
    email: string,
    repo: string,
    confirmToken: string,
    unsubscribeToken: string,
  ): Promise<void>;
  existsByEmailAndRepo(email: string, repo: string): Promise<boolean>;
  confirm(confirmToken: string): Promise<boolean>;
  deleteByUnsubscribeToken(unsubscribeToken: string): Promise<boolean>;
  findAllConfirmedWithTokens(): Promise<ConfirmedSubscriptionWithToken[]>;
  findByEmail(email: string): Promise<Subscription[]>;
}

export class SubscriptionModel implements ISubscriptionModel {
  constructor(
    private readonly db: Knex,
    private readonly repositoryModel: IRepositoryModel,
  ) {}

  // Ensures the repository exists, then inserts a new pending subscription with both tokens.
  async create(
    email: string,
    repo: string,
    confirmToken: string,
    unsubscribeToken: string,
  ): Promise<void> {
    await this.repositoryModel.upsert(repo);
    await this.db('subscriptions').insert({
      email,
      repo,
      confirm_token: confirmToken,
      unsubscribe_token: unsubscribeToken,
      status: 'pending',
    });
  }

  // Returns true if a subscription for the given email and repo already exists.
  async existsByEmailAndRepo(email: string, repo: string): Promise<boolean> {
    const row: unknown = await this.db('subscriptions')
      .where({ email, repo })
      .first();
    return row !== undefined;
  }

  // Sets subscription status to confirmed. Returns false if the token was not found.
  async confirm(confirmToken: string): Promise<boolean> {
    const count = await this.db('subscriptions')
      .where({ confirm_token: confirmToken })
      .update({ status: 'confirmed' });
    return count > 0;
  }

  // Deletes the subscription by its unsubscribe token. Returns false if not found.
  async deleteByUnsubscribeToken(unsubscribeToken: string): Promise<boolean> {
    const count = await this.db('subscriptions')
      .where({ unsubscribe_token: unsubscribeToken })
      .delete();
    return count > 0;
  }

  // Returns all confirmed subscriptions with their unsubscribe tokens and last seen tag.
  async findAllConfirmedWithTokens(): Promise<
    ConfirmedSubscriptionWithToken[]
  > {
    return this.db('subscriptions')
      .join('repositories', 'subscriptions.repo', 'repositories.repo')
      .where('subscriptions.status', 'confirmed')
      .select(
        'subscriptions.email',
        'subscriptions.repo',
        'subscriptions.unsubscribe_token',
        'repositories.last_seen_tag',
      );
  }

  // Returns all confirmed subscriptions for the given email, including last seen release tag.
  async findByEmail(email: string): Promise<Subscription[]> {
    const rows: SubscriptionRow[] = await this.db('subscriptions')
      .join('repositories', 'subscriptions.repo', 'repositories.repo')
      .where({
        'subscriptions.email': email,
        'subscriptions.status': 'confirmed',
      })
      .select(
        'subscriptions.email',
        'subscriptions.repo',
        'repositories.last_seen_tag',
      );

    return rows.map((row) => ({
      email: row.email,
      repo: row.repo,
      confirmed: true,
      last_seen_tag: row.last_seen_tag,
    }));
  }
}
