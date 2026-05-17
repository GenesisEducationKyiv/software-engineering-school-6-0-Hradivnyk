'use strict';

/**
 * Cross-platform test runner with Docker Compose lifecycle management.
 *
 * Usage:
 *   node scripts/run-with-compose.cjs <compose-files> -- <test-command>
 *
 * Example:
 *   node scripts/run-with-compose.cjs \
 *     -f docker-compose.test.yml \
 *     -- jest --selectProjects integration --runInBand
 *
 * Guarantees:
 *   - `docker compose up` failure aborts immediately with a non-zero exit code.
 *   - `docker compose down` always runs, even when the test command fails.
 *   - Exits with the test command's exit code, not the cleanup's.
 */

const { execSync } = require('child_process');

// Split argv on '--': everything before is compose flags, everything after is
// the test command.
const args = process.argv.slice(2);
const separatorIndex = args.indexOf('--');

if (separatorIndex === -1) {
  console.error(
    'Usage: node run-with-compose.cjs <compose-flags> -- <test-command>',
  );
  process.exit(1);
}

const composeFlags = args.slice(0, separatorIndex).join(' ');
const testCommand = args.slice(separatorIndex + 1).join(' ');
const compose = `docker compose ${composeFlags}`;

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

// 1. Pre-clean: remove any stale containers and volumes from a previous run so
//    that services (e.g. PostgreSQL) always initialise from scratch.
try {
  run(`${compose} down -v`);
} catch {
  // Non-fatal — nothing to clean up on a fresh machine.
}

// 2. Bring the stack up — fail fast if this step errors.
run(`${compose} up -d --wait`);

// 3. Run tests — capture the exit code without throwing.
let testExitCode = 0;
try {
  run(testCommand);
} catch (err) {
  testExitCode = typeof err.status === 'number' ? err.status : 1;
}

// 4. Always tear the stack down with -v so volumes are removed too,
//    ensuring a clean slate for the next run.
try {
  run(`${compose} down -v`);
} catch {
  // Cleanup errors are non-fatal; the test result is what matters.
}

process.exit(testExitCode);
