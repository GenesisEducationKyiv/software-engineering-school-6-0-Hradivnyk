import { RepositoryModel } from './models/repositoryModel.js';
import { SubscriptionModel } from './models/subscriptionModel.js';
import { EmailService } from './services/emailService.js';
import { GithubService } from './services/githubService.js';
import { SubscriptionService } from './services/subscriptionService.js';
import { ScannerService } from './services/scannerService.js';
import { SubscriptionController } from './controllers/subscriptionController.js';
import { config } from './config/index.js';

const repositoryModel = new RepositoryModel();
const subscriptionModel = new SubscriptionModel(repositoryModel);
const emailService = new EmailService({
  host: config.email.host,
  port: config.email.port,
  user: config.email.user,
  pass: config.email.pass,
  from: config.email.from,
  baseUrl: config.app.baseUrl,
});
const githubService = new GithubService();

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
);

export const subscriptionController = new SubscriptionController(
  subscriptionService,
);
