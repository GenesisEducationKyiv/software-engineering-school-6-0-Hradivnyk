import knex from '../db/knex.js';
import type { Subscription } from '../types.js';

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
    const row: unknown = await knex('subscriptions')
      .where({ email, repo })
      .first();
    return row !== undefined;
  }

  // Sets subscription status to confirmed. Returns the subscription row, or null if token not found.
  async confirm(
    confirmToken: string,
  ): Promise<{ email: string; repo: string } | null> {
    const rows: { email: string; repo: string }[] = await knex('subscriptions')
      .where({ confirm_token: confirmToken })
      .update({ status: 'confirmed' })
      .returning(['email', 'repo']);
    return rows[0] ?? null;
  }

  // Deletes the subscription by its unsubscribe token. Returns the subscription row, or null if not found.
  async deleteByUnsubscribeToken(
    unsubscribeToken: string,
  ): Promise<{ email: string; repo: string } | null> {
    const rows: { email: string; repo: string }[] = await knex('subscriptions')
      .where({ unsubscribe_token: unsubscribeToken })
      .delete()
      .returning(['email', 'repo']);
    return rows[0] ?? null;
  }

  // Returns all confirmed subscriptions with their unsubscribe tokens and last seen tag.
  async findAllConfirmedWithTokens(): Promise<
    ConfirmedSubscriptionWithToken[]
  > {
    return knex('subscriptions')
      .join('repositories', 'subscriptions.repo', 'repositories.repo')
      .where('subscriptions.status', 'confirmed')
      .select(
        'subscriptions.email',
        'subscriptions.repo',
        'subscriptions.unsubscribe_token',
        'repositories.last_seen_tag',
      );
  }

  // Updates last_seen_tag for the given repository.
  async updateLastSeenTag(repo: string, tag: string): Promise<void> {
    await knex('repositories').where({ repo }).update({ last_seen_tag: tag });
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
