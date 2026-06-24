const required = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env variable: ${key}`);
  return value;
};

const optional = (key: string, defaultValue: string): string => {
  return process.env[key] ?? defaultValue;
};

const nodeEnv = optional('NODE_ENV', 'development');

export const config = {
  server: {
    port: Number.parseInt(optional('PORT', '3000')),
    nodeEnv,
    isDev: nodeEnv === 'development',
    isProd: nodeEnv === 'production',
    isTest: nodeEnv === 'test',
    logLevel: optional(
      'LOG_LEVEL',
      nodeEnv === 'test'
        ? 'silent'
        : nodeEnv === 'development'
          ? 'debug'
          : 'info',
    ),
  },
  db: {
    url: required('DATABASE_URL'),
  },
  github: {
    token: optional('GITHUB_TOKEN', ''),
  },
  rabbitmq: {
    url: optional('RABBITMQ_URL', 'amqp://localhost:5672'),
  },
  app: {
    baseUrl: optional('BASE_URL', 'http://localhost:3000'),
    allowedOrigin: optional('ALLOWED_ORIGIN', '*'),
  },
  scanner: {
    cronSchedule: optional('SCANNER_CRON_SCHEDULE', '0 * * * *'),
  },
  outbox: {
    pollIntervalMs: Number.parseInt(
      optional('OUTBOX_POLL_INTERVAL_MS', '1000'),
    ),
    batchSize: Number.parseInt(optional('OUTBOX_BATCH_SIZE', '50')),
  },
  saga: {
    // How often the sweeper checks for stuck sagas (ms).
    sweepIntervalMs: Number.parseInt(
      optional('SAGA_SWEEP_INTERVAL_MS', String(5 * 60 * 1000)),
    ),
    // Sagas older than this threshold in status='started' are considered stuck.
    timeoutMs: Number.parseInt(
      optional('SAGA_TIMEOUT_MS', String(30 * 60 * 1000)),
    ),
  },
  auth: {
    apiKey: required('API_KEY'),
  },
} as const;
