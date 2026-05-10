import type { Request, Response, NextFunction } from 'express';
import { subscriptionService } from '../services/subscriptionService.js';
import {
  subscribeSchema,
  tokenSchema,
  emailQuerySchema,
} from '../schemas/subscriptionSchemas.js';

export class SubscriptionController {
  async subscribe(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { email, repo } = subscribeSchema.parse(req.body);
      await subscriptionService.subscribe(email, repo);
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
      await subscriptionService.confirm(token);
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
      await subscriptionService.unsubscribe(token);
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
      const subscriptions = await subscriptionService.getSubscriptions(email);
      res.status(200).json(subscriptions);
    } catch (err) {
      next(err);
    }
  }
}

export const subscriptionController = new SubscriptionController();
