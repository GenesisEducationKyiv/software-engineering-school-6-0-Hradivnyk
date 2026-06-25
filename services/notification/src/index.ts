import 'dotenv/config';
import http from 'node:http';
import { ServerCredentials } from '@grpc/grpc-js';
import {
  broker,
  emailRequestedConsumer,
  outboxRelay,
  grpcServer,
  restApp,
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

  // ── Health server (node:http, existing) ──────────────────────────────────
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

  // ── gRPC server ──────────────────────────────────────────────────────────
  await new Promise<void>((resolve, reject) => {
    grpcServer.bindAsync(
      `0.0.0.0:${config.grpc.port.toString()}`,
      ServerCredentials.createInsecure(),
      (err) => {
        if (err) {
          reject(err);
          return;
        }
        logger.info(
          { event: 'grpc.started', port: config.grpc.port },
          'gRPC server started',
        );
        resolve();
      },
    );
  });

  // ── Synchronous REST server ───────────────────────────────────────────────
  const restServer = restApp.listen(config.rest.port, () => {
    logger.info(
      { event: 'rest.started', port: config.rest.port },
      'REST server started',
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

    // Drain in-flight gRPC calls then close REST and health servers in parallel.
    grpcServer.tryShutdown((grpcErr) => {
      if (grpcErr) {
        logger.error({ err: grpcErr }, 'gRPC shutdown error');
      }
    });

    restServer.close(() => {
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
