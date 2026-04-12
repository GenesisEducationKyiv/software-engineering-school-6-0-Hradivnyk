import type { Knex } from 'knex';

const knexConfig: Knex.Config = {
  client: 'pg',
  connection: process.env['DATABASE_URL'],
  migrations: {
    directory: './src/db/migrations',
    extension: 'ts',
    loadExtensions: ['.ts'],
  },
};

export default knexConfig;
