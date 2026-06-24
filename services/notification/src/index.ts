import 'dotenv/config';
import http from 'node:http';
import {
  broker,
  emailRequestedConsumer,
  outboxRelay,
  knex,
} from './container.js';
import { config } from './config.js';
import logger from './logger.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function start(): Promise<void> {
  await broker.connect();
  // Drain outbox reply events (email.sent / email.failed) to the broker.
  outboxRelay.start();
  await emailRequestedConsumer.start();

  const healthServer = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  });

  healthServer.listen(config.health.port, () => {
    logger.info(
      { event: 'health.started', port: config.health.port },
      'Health server started',
    );
  });

  logger.info({ event: 'service.started' }, 'Notification service started');

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

    outboxRelay.stop();

    healthServer.close(() => {
      clearTimeout(timer);
      broker
        .close()
        .then(async () => knex.destroy())
        .then(() => process.exit(code))
        .catch((err: unknown) => {
          logger.error({ err }, 'Error during shutdown');
          process.exit(1);
        });
    });
  }

  process.on('SIGTERM', () => {
    logger.info(
      { event: 'service.shutdown' },
      'SIGTERM received, shutting down',
    );
    gracefulShutdown(0);
  });
  process.on('SIGINT', () => {
    logger.info(
      { event: 'service.shutdown' },
      'SIGINT received, shutting down',
    );
    gracefulShutdown(0);
  });
}

start().catch((err: unknown) => {
  logger.error({ err }, 'Failed to start notification service');
  process.exit(1);
});
