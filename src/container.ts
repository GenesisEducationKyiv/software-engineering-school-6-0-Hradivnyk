import { RepositoryModel } from './models/repositoryModel.js';
import { SubscriptionModel } from './models/subscriptionModel.js';
import { EmailService } from './services/emailService.js';
import { NodemailerEmailSender } from './services/emailSender.js';
import { EmailTemplateBuilder } from './services/emailTemplateBuilder.js';
import { GithubService } from './services/githubService.js';
import { FetchHttpClient } from './httpClient.js';
import { SubscriptionService } from './services/subscriptionService.js';
import { ScannerService } from './services/scannerService.js';
import { SubscriptionController } from './controllers/subscriptionController.js';
import { config } from './config/index.js';
import logger from './utils/logger.js';

const repositoryModel = new RepositoryModel();
const subscriptionModel = new SubscriptionModel(repositoryModel);
const emailSender = new NodemailerEmailSender({
  host: config.email.host,
  port: config.email.port,
  user: config.email.user,
  pass: config.email.pass,
  from: config.email.from,
});
const emailTemplates = new EmailTemplateBuilder(config.app.baseUrl);
const emailService = new EmailService(emailSender, emailTemplates);
const githubService = new GithubService(
  new FetchHttpClient(),
  config.github.token,
);

const subscriptionService = new SubscriptionService(
  subscriptionModel,
  emailService,
  githubService,
);

export const scannerService = new ScannerService(
  subscriptionModel,
  repositoryModel,
  emailService,
  githubService,
  logger,
);

export const subscriptionController = new SubscriptionController(
  subscriptionService,
);
