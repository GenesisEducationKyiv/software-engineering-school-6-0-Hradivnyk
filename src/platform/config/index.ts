const required = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env variable: ${key}`);
  return value;
};

const optional = (key: string, defaultValue: string): string => {
  return process.env[key] ?? defaultValue;
};

const optionalInt = (key: string, defaultValue: number): number => {
  const raw = process.env[key];
  if (raw === undefined) return defaultValue;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed))
    throw new Error(`Env variable ${key} must be an integer, got: "${raw}"`);
  return parsed;
};

const nodeEnv = optional('NODE_ENV', 'development');

export const config = {
  server: {
    port: optionalInt('PORT', 3000),
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
  notification: {
    url: optional('NOTIFICATION_SERVICE_URL', 'http://localhost:4000'),
    timeoutMs: optionalInt('NOTIFICATION_TIMEOUT_MS', 5000),
  },
  app: {
    baseUrl: optional('BASE_URL', 'http://localhost:3000'),
    allowedOrigin: optional('ALLOWED_ORIGIN', '*'),
  },
  scanner: {
    cronSchedule: optional('SCANNER_CRON_SCHEDULE', '0 * * * *'),
  },
  auth: {
    apiKey: required('API_KEY'),
  },
} as const;
