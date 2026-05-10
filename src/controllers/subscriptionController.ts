import type { Request, Response, NextFunction } from 'express';
import type { Subscription } from '../types.js';
import {
  subscribeSchema,
  tokenSchema,
  emailQuerySchema,
} from '../schemas/subscriptionSchemas.js';

// The controller owns the contract it depends on — a core tenet of DIP.
export interface ISubscriptionService {
  subscribe(email: string, repo: string): Promise<void>;
  confirm(token: string): Promise<void>;
  unsubscribe(token: string): Promise<void>;
  getSubscriptions(email: string): Promise<Subscription[]>;
}

export class SubscriptionController {
  constructor(private readonly subscriptionService: ISubscriptionService) {}

  async subscribe(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { email, repo } = subscribeSchema.parse(req.body);
      await this.subscriptionService.subscribe(email, repo);
      res
        .status(200)
        .json({ message: 'Subscription successful. Confirmation email sent.' });
    } catch (err) {
      next(err);
    }
  }

  async confirmSubscription(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { token } = tokenSchema.parse(req.params);
      await this.subscriptionService.confirm(token);
      res.status(200).json({ message: 'Subscription confirmed successfully.' });
    } catch (err) {
      next(err);
    }
  }

  async unsubscribe(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { token } = tokenSchema.parse(req.params);
      await this.subscriptionService.unsubscribe(token);
      res.status(200).json({ message: 'Unsubscribed successfully.' });
    } catch (err) {
      next(err);
    }
  }

  async getSubscriptions(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { email } = emailQuerySchema.parse(req.query);
      const subscriptions =
        await this.subscriptionService.getSubscriptions(email);
      res.status(200).json(subscriptions);
    } catch (err) {
      next(err);
    }
  }
}
