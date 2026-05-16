import { execSync } from 'node:child_process';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

export default function globalSetup(): void {
  loadEnv({ path: resolve('.env.e2e') });

  console.log('Running DB migrations for E2E tests...');
  execSync('npm run migrate', {
    env: { ...process.env },
    stdio: 'inherit',
  });
}
