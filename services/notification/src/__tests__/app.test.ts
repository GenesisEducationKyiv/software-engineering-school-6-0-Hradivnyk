import request from 'supertest';
import { createApp } from '../app.js';
import type { Notifier } from '../email.service.js';
import type { ILogger } from '../logger.js';
import { EmailSendError } from '../errors.js';

const noopLogger: ILogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
};

function build(notifier: Partial<Notifier>) {
  const full: Notifier = {
    sendConfirmationEmail: jest.fn().mockResolvedValue(undefined),
    sendNotificationEmail: jest.fn().mockResolvedValue(undefined),
    ...notifier,
  };
  return { app: createApp(full, noopLogger), notifier: full };
}

describe('notification HTTP service', () => {
  it('GET /health returns ok', async () => {
    const { app } = build({});
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('POST /api/notify dispatches a confirmation email and returns 202', async () => {
    const { app, notifier } = build({});
    const res = await request(app).post('/api/notify').send({
      type: 'confirmation',
      email: 'a@b.com',
      repo: 'owner/repo',
      confirm_token: 'tok',
    });

    expect(res.status).toBe(202);
    expect(notifier.sendConfirmationEmail).toHaveBeenCalledWith(
      'a@b.com',
      'tok',
      'owner/repo',
    );
  });

  it('POST /api/notify dispatches a notification email and returns 202', async () => {
    const { app, notifier } = build({});
    const res = await request(app).post('/api/notify').send({
      type: 'notification',
      email: 'a@b.com',
      repo: 'owner/repo',
      tag_name: 'v1',
      unsubscribe_token: 'tok',
    });

    expect(res.status).toBe(202);
    expect(notifier.sendNotificationEmail).toHaveBeenCalledWith(
      'a@b.com',
      'owner/repo',
      'v1',
      'tok',
    );
  });

  it('rejects an invalid payload with 400', async () => {
    const { app, notifier } = build({});
    const res = await request(app).post('/api/notify').send({
      type: 'confirmation',
      email: 'not-an-email',
      repo: 'owner/repo',
    });

    expect(res.status).toBe(400);
    expect(notifier.sendConfirmationEmail).not.toHaveBeenCalled();
  });

  it('rejects an unknown template type with 400', async () => {
    const { app, notifier } = build({});
    const res = await request(app).post('/api/notify').send({
      type: 'unknown',
      email: 'a@b.com',
      repo: 'owner/repo',
    });

    expect(res.status).toBe(400);
    expect(notifier.sendConfirmationEmail).not.toHaveBeenCalled();
    expect(notifier.sendNotificationEmail).not.toHaveBeenCalled();
  });

  it('returns 502 when email sending fails', async () => {
    const { app } = build({
      sendConfirmationEmail: jest
        .fn()
        .mockRejectedValue(new EmailSendError(new Error('smtp'))),
    });
    const res = await request(app).post('/api/notify').send({
      type: 'confirmation',
      email: 'a@b.com',
      repo: 'owner/repo',
      confirm_token: 'tok',
    });

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'email_send_failed' });
  });

  it('returns 500 on an unexpected error', async () => {
    const { app } = build({
      sendConfirmationEmail: jest.fn().mockRejectedValue(new TypeError('boom')),
    });
    const res = await request(app).post('/api/notify').send({
      type: 'confirmation',
      email: 'a@b.com',
      repo: 'owner/repo',
      confirm_token: 'tok',
    });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'internal_error' });
  });
});
