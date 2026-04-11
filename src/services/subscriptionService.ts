import type { Subscription } from '../types.js';

export class SubscriptionService {
  subscribe(_email: string, _repo: string): Promise<void> {
    return Promise.resolve();
  }

  confirm(_token: string): Promise<void> {
    return Promise.resolve();
  }

  unsubscribe(_token: string): Promise<void> {
    return Promise.resolve();
  }

  getSubscriptions(_email: string): Promise<Subscription[]> {
    return Promise.resolve([]);
  }
}

export const subscriptionService = new SubscriptionService();
