import express from 'express';
import type { Request, Response, NextFunction, Express } from 'express';
import type { Notifier } from './email.service.js';
import type { ILogger } from './logger.js';
import { ConfirmationRequestSchema, ReleaseRequestSchema } from './schemas.js';

/**
 * Builds the notification HTTP service. The REST endpoints are the integration
 * contract between the API monolith and this service (synchronous
 * request–response), replacing what would otherwise be a message queue.
 */
export function createApp(notifier: Notifier, logger: ILogger): Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.post(
    '/api/notify/confirmation',
    async (req: Request, res: Response): Promise<void> => {
      const parsed = ConfirmationRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: 'invalid_request', details: parsed.error.flatten() });
        return;
      }
      const { email, token, repo } = parsed.data;
      await notifier.sendConfirmationEmail(email, token, repo);
      logger.info(
        { event: 'notify.confirmation_sent', repo },
        'Confirmation email sent',
      );
      res.status(202).json({ status: 'sent' });
    },
  );

  app.post(
    '/api/notify/release',
    async (req: Request, res: Response): Promise<void> => {
      const parsed = ReleaseRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: 'invalid_request', details: parsed.error.flatten() });
        return;
      }
      const { email, repo, tag, token } = parsed.data;
      await notifier.sendNotificationEmail(email, repo, tag, token);
      logger.info(
        { event: 'notify.release_sent', repo, tag },
        'Release email sent',
      );
      res.status(202).json({ status: 'sent' });
    },
  );

  app.use(
    (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
      logger.error(
        { event: 'notify.request_failed', err },
        'Notification request failed',
      );
      res.status(502).json({ error: 'email_send_failed' });
    },
  );

  return app;
}
