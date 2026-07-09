import type { ILogger } from '../../platform/logger.js';
import type { EmailRequestedPayload } from '@release-owl/contracts';

export interface Notifier {
  sendConfirmationEmail(
    email: string,
    token: string,
    repo: string,
  ): Promise<void>;
  sendNotificationEmail(
    email: string,
    repo: string,
    tag: string,
    token: string,
  ): Promise<void>;
}

export interface NotificationClientConfig {
  baseUrl: string;
  timeoutMs: number;
}

/**
 * Talks to the standalone notification service over HTTP (synchronous
 * request–response). Email composition and SMTP delivery live in that service;
 * the monolith only fires a request and waits for acknowledgement.
 *
 * Every email kind goes to a single `/api/notify` endpoint with a discriminated
 * payload keyed by `type` — the same contract the broker event uses — so adding
 * a new email kind never requires a new endpoint here.
 *
 * An {@link AbortController} timeout keeps a slow/unhealthy notification service
 * from blocking the calling business operation indefinitely.
 */
export class NotificationHttpClient implements Notifier {
  constructor(
    private readonly config: NotificationClientConfig,
    private readonly logger: ILogger,
  ) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
  }

  private readonly baseUrl: string;

  async sendConfirmationEmail(
    email: string,
    token: string,
    repo: string,
  ): Promise<void> {
    await this.post({
      type: 'confirmation',
      email,
      repo,
      confirm_token: token,
    });
  }

  async sendNotificationEmail(
    email: string,
    repo: string,
    tag: string,
    token: string,
  ): Promise<void> {
    await this.post({
      type: 'notification',
      email,
      repo,
      tag_name: tag,
      unsubscribe_token: token,
    });
  }

  private async post(payload: EmailRequestedPayload): Promise<void> {
    const path = '/api/notify';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(
          `notification service responded with ${response.status.toString()}`,
        );
      }
    } catch (err) {
      this.logger.error(
        { event: 'notification.request_failed', path, err },
        'Notification service request failed',
      );
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
