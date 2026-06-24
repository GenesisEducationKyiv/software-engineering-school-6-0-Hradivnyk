import type { Knex } from 'knex';

// Transactional outbox for reply events published by the notification service.
// The consumer writes inbox + outbox atomically; the relay publishes outbox rows
// to RabbitMQ after the transaction commits (at-least-once delivery).
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('outbox', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.text('routing_key').notNullable();
    table.jsonb('payload').notNullable();
    table
      .timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.timestamp('published_at', { useTz: true }).nullable();
    table.integer('attempts').notNullable().defaultTo(0);
    // The relay scans for not-yet-published rows oldest-first.
    table.index(['published_at', 'created_at'], 'outbox_unpublished_idx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('outbox');
}
