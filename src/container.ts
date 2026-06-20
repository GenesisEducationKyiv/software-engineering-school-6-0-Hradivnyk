import knex from './platform/db/knex.js';
import { config } from './platform/config/index.js';
import logger from './platform/logger.js';
import { RabbitMQBroker } from '@release-owl/platform';
import { GithubService, FetchHttpClient } from './modules/github/index.js';
import { BrokerNotifier } from './modules/notifications/index.js';
import { SubscriptionModel } from './modules/subscriptions/subscription.model.js';
import { RepositoryModel } from './modules/subscriptions/repository.model.js';
import { SubscriptionService } from './modules/subscriptions/subscription.service.js';
import { SubscriptionController } from './modules/subscriptions/subscription.controller.js';
import {
  ScannerService,
  InProcessReleaseHandler,
} from './modules/releases/index.js';

const githubService = new GithubService(
  new FetchHttpClient(),
  config.github.token,
);

export const broker = new RabbitMQBroker(config.rabbitmq.url, logger);

const notifier = new BrokerNotifier(broker);

const repositoryModel = new RepositoryModel(knex);
const subscriptionModel = new SubscriptionModel(knex, repositoryModel);

const subscriptionService = new SubscriptionService(
  subscriptionModel,
  notifier,
  githubService,
);

export { subscriptionModel, repositoryModel };

export const subscriptionController = new SubscriptionController(
  subscriptionService,
);

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
