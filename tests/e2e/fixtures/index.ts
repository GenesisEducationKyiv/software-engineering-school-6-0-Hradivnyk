import { test as base } from '@playwright/test';
import { Client } from 'pg';

type E2EFixtures = {
  apiKey: string;
  db: Client;
};

export const test = base.extend<E2EFixtures>({
  // eslint-disable-next-line no-empty-pattern
  apiKey: async ({}, use) => {
    await use(process.env.API_KEY ?? '');
  },

  // eslint-disable-next-line no-empty-pattern
  db: async ({}, use) => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    await use(client);
    await client.end();
  },
});

export { expect } from '@playwright/test';
