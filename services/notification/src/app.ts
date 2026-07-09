import express from 'express';
import type { Request, Response, NextFunction, Express } from 'express';
import type { Notifier } from './email.service.js';
import type { ILogger } from './logger.js';
import { EmailRequestedPayloadSchema } from '@release-owl/contracts';
import { EmailSendError } from './errors.js';

/**
 * Builds the notification HTTP service. The single `/api/notify` endpoint is the
 * integration contract between the API monolith and this service (synchronous
 * request–response), replacing what would otherwise be a message queue. The body
 * is a discriminated union keyed by `type`, so a new email kind is added as a new
 * union variant plus a dispatch case here — without adding a new endpoint.
 */
export function createApp(notifier: Notifier, logger: ILogger): Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.post(
    '/api/notify',
    async (req: Request, res: Response): Promise<void> => {
      const parsed = EmailRequestedPayloadSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: 'invalid_request', details: parsed.error.flatten() });
        return;
      }
      const payload = parsed.data;

      if (payload.type === 'confirmation') {
        await notifier.sendConfirmationEmail(
          payload.email,
          payload.confirm_token,
          payload.repo,
        );
        logger.info(
          { event: 'notify.confirmation_sent', repo: payload.repo },
          'Confirmation email sent',
        );
      } else {
        await notifier.sendNotificationEmail(
          payload.email,
          payload.repo,
          payload.tag_name,
          payload.unsubscribe_token,
        );
        logger.info(
          {
            event: 'notify.release_sent',
            repo: payload.repo,
            tag: payload.tag_name,
          },
          'Release email sent',
        );
      }

      res.status(200).json({ status: 'sent' });
    },
  );

  app.use(
    (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
      if (err instanceof EmailSendError) {
        logger.error(
          { event: 'notify.email_send_failed', err },
          'Email send failed',
        );
        res.status(502).json({ error: 'email_send_failed' });
        return;
      }
      logger.error(
        { event: 'notify.request_failed', err },
        'Notification request failed',
      );
      res.status(500).json({ error: 'internal_error' });
    },
  );

  return app;
}
