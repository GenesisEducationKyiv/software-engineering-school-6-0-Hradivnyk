import type { Knex } from 'knex';
import { SubscriptionModel } from './subscription.model.js';
import type { ISubscriptionModel } from './subscription.model.js';
import { RepositoryModel } from './repository.model.js';
import type { IRepositoryModel } from './repository.model.js';
import { SubscriptionService } from './subscription.service.js';
import { SubscriptionController } from './subscription.controller.js';
import type { Notifier } from '../notifications/index.js';
import type { IGithubService } from '../github/index.js';

export interface SubscriptionModuleDeps {
  notifier: Notifier;
  githubService: IGithubService;
}

export interface SubscriptionModule {
  subscriptionModel: ISubscriptionModel;
  repositoryModel: IRepositoryModel;
  subscriptionService: SubscriptionService;
  subscriptionController: SubscriptionController;
}

// Composition helper: keeps the concrete persistence classes private to this
// module so consumers (e.g. the app's container) only ever see the
// interfaces/service/controller, not the data layer itself.
export function createSubscriptionModule(
  db: Knex,
  { notifier, githubService }: SubscriptionModuleDeps,
): SubscriptionModule {
  const repositoryModel = new RepositoryModel(db);
  const subscriptionModel = new SubscriptionModel(db, repositoryModel);
  const subscriptionService = new SubscriptionService(
    subscriptionModel,
    notifier,
    githubService,
  );
  const subscriptionController = new SubscriptionController(
    subscriptionService,
  );

  return {
    subscriptionModel,
    repositoryModel,
    subscriptionService,
    subscriptionController,
  };
}
