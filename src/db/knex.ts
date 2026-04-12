import knexLib from 'knex';
import type { Knex } from 'knex';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { config } from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const knexConfig: Knex.Config = {
  client: 'pg',
  connection: config.db.url,
  migrations: {
    directory: join(__dirname, 'migrations'),
    loadExtensions: ['.js'],
  },
};

const knex = knexLib(knexConfig);

export default knex;
