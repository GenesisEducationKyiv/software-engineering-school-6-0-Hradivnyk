import { createRequire } from 'node:module';
import pino from 'pino';
import { config } from '../config/index.js';

const require = createRequire(import.meta.url);
const { name, version } = require('../../package.json') as {
  name: string;
  version: string;
};

const getLevel = (): string => {
  if (config.server.isTest) return 'silent';
  if (config.server.isDev) return 'debug';
  return 'info';
};

const logger = pino({
  level: getLevel(),

  base: {
    service: name,
    version,
    env: config.server.nodeEnv,
  },

  formatters: {
    level: (label) => ({ level: label }),
  },

  // pino-pretty only in development — in production clean JSON
  transport: config.server.isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

export default logger;
