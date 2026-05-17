import knexLib from 'knex';
import type { Knex } from 'knex';
import { join } from 'node:path';
import { config } from '../config/index.js';

const knexConfig: Knex.Config = {
  client: 'pg',
  connection: config.db.url,
  migrations: {
    // process.cwd() is always the project root when running via npm scripts.
    // tsx maps .js extension imports to .ts source files at runtime.
    directory: join(process.cwd(), 'src', 'db', 'migrations'),
    // .ts for tsx (dev/test), .js for compiled output (production)
    loadExtensions: ['.ts', '.js'],
  },
};

const knex = knexLib(knexConfig);

export default knex;
