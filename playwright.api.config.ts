import { defineConfig } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

loadEnv({ path: resolve('.env.e2e') });

const PORT = process.env.PORT ?? '3001';
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: BASE_URL,
    extraHTTPHeaders: { 'Content-Type': 'application/json' },
  },
  webServer: {
    command: 'npm run dev:e2e',
    url: `${BASE_URL}/api/docs`,
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: 'test',
      PORT,
      DATABASE_URL: process.env.DATABASE_URL ?? '',
      GITHUB_TOKEN: process.env.GITHUB_TOKEN ?? '',
      SMTP_HOST: process.env.SMTP_HOST ?? 'localhost',
      SMTP_PORT: process.env.SMTP_PORT ?? '1025',
      SMTP_USER: process.env.SMTP_USER ?? 'test@example.com',
      SMTP_PASS: process.env.SMTP_PASS ?? 'test',
      SMTP_FROM: process.env.SMTP_FROM ?? 'noreply@test.example.com',
      BASE_URL,
      ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN ?? '*',
      SCANNER_CRON_SCHEDULE:
        process.env.SCANNER_CRON_SCHEDULE ?? '59 23 31 12 0',
      API_KEY: process.env.API_KEY ?? '',
    },
  },
});
