import { NotificationHttpClient } from '../notification.client.js';
import type { ILogger } from '../../../platform/logger.js';

const noopLogger: ILogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
};

describe('NotificationHttpClient', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;
  });

  function client() {
    return new NotificationHttpClient(
      { baseUrl: 'http://notification:4000/', timeoutMs: 1000 },
      noopLogger,
    );
  }

  it('POSTs confirmation requests to the unified notify endpoint', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 202 });

    await client().sendConfirmationEmail('a@b.com', 'tok', 'owner/repo');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://notification:4000/api/notify');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      type: 'confirmation',
      email: 'a@b.com',
      repo: 'owner/repo',
      confirm_token: 'tok',
    });
  });

  it('POSTs release requests to the unified notify endpoint', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 202 });

    await client().sendNotificationEmail('a@b.com', 'owner/repo', 'v1', 'tok');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://notification:4000/api/notify');
    expect(JSON.parse(init.body as string)).toEqual({
      type: 'notification',
      email: 'a@b.com',
      repo: 'owner/repo',
      tag_name: 'v1',
      unsubscribe_token: 'tok',
    });
  });

  it('throws when the service responds with a non-2xx status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    await expect(
      client().sendConfirmationEmail('a@b.com', 'tok', 'owner/repo'),
    ).rejects.toThrow('500');
  });
});
