import knex from './platform/db/knex.js';
import { config } from './platform/config/index.js';
import logger from './platform/logger.js';
import { GithubService, FetchHttpClient } from './modules/github/index.js';
import {
  EmailService,
  NodemailerEmailSender,
  EmailTemplateBuilder,
} from './modules/notifications/index.js';
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

const emailSender = new NodemailerEmailSender({
  host: config.email.host,
  port: config.email.port,
  user: config.email.user,
  pass: config.email.pass,
  from: config.email.from,
});
const emailTemplates = new EmailTemplateBuilder(config.app.baseUrl);
const notifier = new EmailService(emailSender, emailTemplates);

const repositoryModel = new RepositoryModel(knex);
const subscriptionModel = new SubscriptionModel(knex, repositoryModel);

const subscriptionService = new SubscriptionService(
  subscriptionModel,
  notifier,
  githubService,
);

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
