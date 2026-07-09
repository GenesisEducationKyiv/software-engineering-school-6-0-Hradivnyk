import knex from './platform/db/knex.js';
import { config } from './platform/config/index.js';
import logger from './platform/logger.js';
import { GithubService, FetchHttpClient } from './modules/github/index.js';
import { NotificationHttpClient } from './modules/notifications/index.js';
import { createSubscriptionModule } from './modules/subscriptions/index.js';
import {
  ScannerService,
  InProcessReleaseHandler,
} from './modules/releases/index.js';

const githubService = new GithubService(
  new FetchHttpClient(),
  config.github.token,
);

const notifier = new NotificationHttpClient(
  {
    baseUrl: config.notification.url,
    timeoutMs: config.notification.timeoutMs,
  },
  logger,
);

const { subscriptionModel, repositoryModel, subscriptionController } =
  createSubscriptionModule(knex, { notifier, githubService });

export { subscriptionModel, repositoryModel, subscriptionController };

const releaseHandler = new InProcessReleaseHandler(
  notifier,
  repositoryModel,
  logger,
);

export const scannerService = new ScannerService(
  subscriptionModel,
  githubService,
  releaseHandler,
  logger,
);
