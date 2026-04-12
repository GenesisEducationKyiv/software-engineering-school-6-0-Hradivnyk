import crypto from 'node:crypto';
import type { Subscription } from '../types.js';
import { emailService } from './emailService.js';

export class SubscriptionService {
  async subscribe(email: string, repo: string): Promise<void> {
    const token = crypto.randomBytes(32).toString('hex');
    await emailService.sendConfirmationEmail(email, token, repo);
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
