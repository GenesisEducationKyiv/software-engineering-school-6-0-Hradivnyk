import type { IBroker, ILogger } from '@release-owl/platform';
import {
  EMAIL_REQUESTED,
  EmailRequestedPayloadSchema,
} from '@release-owl/contracts';
import type { Notifier } from './email.service.js';

const QUEUE = 'notification.email-requested';

export class EmailRequestedConsumer {
  private started = false;

  constructor(
    private readonly broker: IBroker,
    private readonly notifier: Notifier,
    private readonly logger: ILogger,
  ) {}

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    await this.broker.subscribe(
      QUEUE,
      EMAIL_REQUESTED,
      async (raw): Promise<void> => {
        const payload = EmailRequestedPayloadSchema.parse(raw);

        if (payload.type === 'confirmation') {
          await this.notifier.sendConfirmationEmail(
            payload.email,
            payload.confirm_token,
            payload.repo,
          );
          this.logger.info(
            { event: 'email.confirmation_sent', repo: payload.repo },
            'Confirmation email sent',
          );
        } else {
          await this.notifier.sendNotificationEmail(
            payload.email,
            payload.repo,
            payload.tag_name,
            payload.unsubscribe_token,
          );
          this.logger.info(
            { event: 'email.notification_sent', repo: payload.repo },
            'Notification email sent',
          );
        }
      },
    );
  }
}
