import 'dotenv/config';
import { app } from './container.js';
import { config } from './config.js';
import logger from './logger.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const server = app.listen(config.server.port, () => {
  logger.info(
    { event: 'service.started', port: config.server.port },
    'Notification service started',
  );
});

function gracefulShutdown(code = 0): void {
  logger.info(
    { event: 'service.shutdown.started' },
    'Graceful shutdown started',
  );

  const timer = setTimeout(() => {
    logger.error(
      { event: 'service.shutdown.timeout' },
      'Shutdown timed out, forcing exit',
    );
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  server.close(() => {
    clearTimeout(timer);
    process.exit(code);
  });
}

process.on('SIGTERM', () => {
  logger.info({ event: 'service.shutdown' }, 'SIGTERM received, shutting down');
  gracefulShutdown(0);
});
process.on('SIGINT', () => {
  logger.info({ event: 'service.shutdown' }, 'SIGINT received, shutting down');
  gracefulShutdown(0);
});
