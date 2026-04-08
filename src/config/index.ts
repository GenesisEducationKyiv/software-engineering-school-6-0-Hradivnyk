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
  },
  db: {
    url: required('DATABASE_URL'),
  },
  github: {
    token: optional('GITHUB_TOKEN', ''),
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
} as const;
