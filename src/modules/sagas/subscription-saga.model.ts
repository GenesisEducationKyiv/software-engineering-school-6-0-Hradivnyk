import type { Knex } from 'knex';

export type SagaStatus = 'started' | 'completed' | 'compensated';

export interface SagaRow {
  id: string;
  subscription_id: string;
  type: string;
  status: SagaStatus;
  created_at: Date;
  updated_at: Date;
}

export interface ISagaModel {
  /**
   * Inserts a new saga row in status='started' and returns the generated id,
   * which acts as the correlation id (saga_id) threaded through the
   * email.requested command and the email.sent/email.failed reply.
   * Must run inside the same transaction as the subscription insert and the
   * outbox enqueue so all three commit atomically.
   */
  start(subscriptionId: string, trx: Knex): Promise<string>;

  /** Returns the saga row, or null if not found. */
  findById(sagaId: string, trx?: Knex): Promise<SagaRow | null>;

  /** Transitions status to 'completed'. */
  markCompleted(sagaId: string, trx: Knex): Promise<void>;

  /** Transitions status to 'compensated'. */
  markCompensated(sagaId: string, trx: Knex): Promise<void>;
}

export class SubscriptionSagaModel implements ISagaModel {
  constructor(private readonly db: Knex) {}

  async start(subscriptionId: string, trx: Knex): Promise<string> {
    const rows: { id: string }[] = await trx('subscription_sagas')
      .insert({ subscription_id: subscriptionId })
      .returning('id');
    return rows[0].id;
  }

  async findById(sagaId: string, trx?: Knex): Promise<SagaRow | null> {
    const row: unknown = await (trx ?? this.db)('subscription_sagas')
      .where({ id: sagaId })
      .first();
    return row !== undefined ? (row as SagaRow) : null;
  }

  async markCompleted(sagaId: string, trx: Knex): Promise<void> {
    await trx('subscription_sagas').where({ id: sagaId }).update({
      status: 'completed',
      updated_at: trx.fn.now(),
    });
  }

  async markCompensated(sagaId: string, trx: Knex): Promise<void> {
    await trx('subscription_sagas').where({ id: sagaId }).update({
      status: 'compensated',
      updated_at: trx.fn.now(),
    });
  }
}
