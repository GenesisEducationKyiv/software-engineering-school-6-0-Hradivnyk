import { execSync } from 'child_process';
import { config } from 'dotenv';
import { resolve } from 'path';

export default function globalSetup(): void {
  config({ path: resolve(process.cwd(), '.env.test'), override: true });

  console.log('\nRunning DB migrations for integration tests...');
  execSync('npm run migrate', {
    env: { ...process.env },
    stdio: 'inherit',
  });
}
