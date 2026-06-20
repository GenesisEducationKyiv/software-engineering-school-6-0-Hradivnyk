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
  auth: {
    apiKey: required('API_KEY'),
  },
} as const;
