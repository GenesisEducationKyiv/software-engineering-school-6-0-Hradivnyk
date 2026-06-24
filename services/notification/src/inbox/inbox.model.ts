import type { Knex } from 'knex';

export type InboxStatus = 'sent' | 'failed';

export interface IInboxModel {
  /**
   * Returns true if a row with this key already exists in the inbox.
   * Used as a fast pre-check before the expensive email send to avoid
   * sending duplicates on at-least-once redelivery.
   */
  wasProcessed(key: string, trx?: Knex): Promise<boolean>;

  /**
   * Inserts a deduplication record. The PK constraint on `id` enforces
   * exactly-once processing: concurrent redeliveries that both pass
   * wasProcessed() will race here and only one will commit.
   * Must run inside the same transaction as the outbox enqueue.
   */
  markProcessed(key: string, status: InboxStatus, trx: Knex): Promise<void>;
}

export class InboxModel implements IInboxModel {
  constructor(private readonly db: Knex) {}

  async wasProcessed(key: string, trx?: Knex): Promise<boolean> {
    const row: unknown = await (trx ?? this.db)('inbox')
      .where({ id: key })
      .first();
    return row !== undefined;
  }

  async markProcessed(
    key: string,
    status: InboxStatus,
    trx: Knex,
  ): Promise<void> {
    await trx('inbox').insert({ id: key, status });
  }
}
