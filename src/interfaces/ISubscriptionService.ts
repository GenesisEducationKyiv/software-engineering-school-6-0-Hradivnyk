import type { Subscription } from '../types.js';

export interface ISubscriptionService {
  subscribe(email: string, repo: string): Promise<void>;
  confirm(token: string): Promise<void>;
  unsubscribe(token: string): Promise<void>;
  getSubscriptions(email: string): Promise<Subscription[]>;
}
