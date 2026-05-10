import { RepositoryModel } from './models/repositoryModel.js';
import { SubscriptionModel } from './models/subscriptionModel.js';
import { EmailService } from './services/emailService.js';
import { GithubService } from './services/githubService.js';
import { SubscriptionService } from './services/subscriptionService.js';
import { ScannerService } from './services/scannerService.js';
import { SubscriptionController } from './controllers/subscriptionController.js';

const repositoryModel = new RepositoryModel();
const subscriptionModel = new SubscriptionModel(repositoryModel);
const emailService = new EmailService();
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
