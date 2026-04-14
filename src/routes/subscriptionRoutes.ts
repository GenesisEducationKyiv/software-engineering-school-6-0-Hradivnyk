import { Router } from 'express';
import { subscriptionController } from '../controllers/subscriptionController.js';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';

const router = Router();

router.post('/subscribe', apiKeyAuth, (req, res, next) =>
  subscriptionController.subscribe(req, res, next),
);

router.get('/confirm/:token', (req, res, next) =>
  subscriptionController.confirmSubscription(req, res, next),
);

router.get('/unsubscribe/:token', (req, res, next) =>
  subscriptionController.unsubscribe(req, res, next),
);

router.get('/subscriptions', (req, res, next) =>
  subscriptionController.getSubscriptions(req, res, next),
);

export default router;
