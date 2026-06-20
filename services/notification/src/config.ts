const required = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env variable: ${key}`);
  return value;
};

const optional = (key: string, defaultValue: string): string =>
  process.env[key] ?? defaultValue;

const nodeEnv = optional('NODE_ENV', 'development');

export const config = {
  nodeEnv,
  isDev: nodeEnv === 'development',
  isTest: nodeEnv === 'test',
  logLevel: optional(
    'LOG_LEVEL',
    nodeEnv === 'test'
      ? 'silent'
      : nodeEnv === 'development'
        ? 'debug'
        : 'info',
  ),
  server: {
    port: Number.parseInt(optional('NOTIFICATION_PORT', '4000')),
  },
  email: {
    host: required('SMTP_HOST'),
    port: Number.parseInt(optional('SMTP_PORT', '587')),
    user: required('SMTP_USER'),
    pass: required('SMTP_PASS'),
    from: required('SMTP_FROM'),
  },
  app: {
    baseUrl: optional('BASE_URL', 'http://localhost:3000'),
  },
  retry: {
    attempts: Number.parseInt(optional('EMAIL_RETRY_ATTEMPTS', '3')),
    backoffMs: Number.parseInt(optional('EMAIL_RETRY_BACKOFF_MS', '500')),
  },
} as const;
