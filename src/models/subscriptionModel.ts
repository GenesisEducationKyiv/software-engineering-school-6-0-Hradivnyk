import knex from '../db/knex.js';
import type { Subscription } from '../types.js';

interface SubscriptionRow {
  email: string;
  repo: string;
  last_seen_tag: string | null;
}

export class SubscriptionModel {
  // Upserts the repository and inserts a new pending subscription with both tokens.
  async create(
    email: string,
    repo: string,
    confirmToken: string,
    unsubscribeToken: string,
  ): Promise<void> {
    await knex('repositories').insert({ repo }).onConflict('repo').ignore();
    await knex('subscriptions').insert({
      email,
      repo,
      confirm_token: confirmToken,
      unsubscribe_token: unsubscribeToken,
      status: 'pending',
    });
  }

  // Returns true if a subscription for the given email and repo already exists.
  async existsByEmailAndRepo(email: string, repo: string): Promise<boolean> {
    const row = await knex('subscriptions').where({ email, repo }).first();
    return row !== undefined;
  }

  // Sets subscription status to confirmed. Returns false if the token was not found.
  async confirm(confirmToken: string): Promise<boolean> {
    const count = await knex('subscriptions')
      .where({ confirm_token: confirmToken })
      .update({ status: 'confirmed' });
    return count > 0;
  }

  // Deletes the subscription by its unsubscribe token. Returns false if not found.
  async deleteByUnsubscribeToken(unsubscribeToken: string): Promise<boolean> {
    const count = await knex('subscriptions')
      .where({ unsubscribe_token: unsubscribeToken })
      .delete();
    return count > 0;
  }

  // Returns all confirmed subscriptions for the given email, including last seen release tag.
  async findByEmail(email: string): Promise<Subscription[]> {
    const rows: SubscriptionRow[] = await knex('subscriptions')
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

export const subscriptionModel = new SubscriptionModel();
