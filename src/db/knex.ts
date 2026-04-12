import knexLib from 'knex';
import type { Knex } from 'knex';
import { config } from '../config/index.js';

const knexConfig: Knex.Config = {
  client: 'pg',
  connection: config.db.url,
  migrations: {
    directory: '../../migrations',
    extension: 'ts',
  },
};

const knex = knexLib(knexConfig);

export default knex;
