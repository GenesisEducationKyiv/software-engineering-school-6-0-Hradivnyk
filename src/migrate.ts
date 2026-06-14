import knex from './platform/db/knex.js';

await knex.migrate.latest();
await knex.destroy();
