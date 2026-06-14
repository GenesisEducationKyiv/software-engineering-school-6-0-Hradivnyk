import pino from 'pino';
import { config } from './config/index.js';

export interface ILogger {
  info(objOrMsg: object | string, msg?: string): void;
  debug(objOrMsg: object | string, msg?: string): void;
  error(objOrMsg: object | string, msg?: string): void;
}

const getLevel = (): string => {
  if (config.server.isTest) return 'silent';
  if (config.server.isDev) return 'debug';
  return 'info';
};

const logger = pino({
  level: getLevel(),

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
