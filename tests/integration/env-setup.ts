// Runs before any imports in test worker processes.
// Sets DATABASE_URL (and other vars) before src/config/index.ts is imported.
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.test'), override: true });
