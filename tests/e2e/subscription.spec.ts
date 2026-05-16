import { test, expect } from './fixtures/index.js';
import { getSubscriptionTokens, deleteSubscriptions } from './helpers/db.js';

const EMAIL = 'e2e-test@example.com';
const REPO = 'octocat/Hello-World'; // guaranteed to exist on GitHub

test.describe('POST /api/subscribe', () => {
  test.beforeEach(async ({ db }) => {
    await deleteSubscriptions(db, EMAIL);
  });

  test('returns 401 without API key', async ({ request }) => {
    const res = await request.post('/api/subscribe', {
      data: { email: EMAIL, repo: REPO },
    });

    expect(res.status()).toBe(401);
    expect(await res.json()).toHaveProperty('error');
  });

  test('returns 401 with wrong API key', async ({ request }) => {
    const res = await request.post('/api/subscribe', {
      headers: { 'X-API-Key': 'wrong-key' },
      data: { email: EMAIL, repo: REPO },
    });

    expect(res.status()).toBe(401);
    expect(await res.json()).toHaveProperty('error');
  });

  test('returns 200 and sends confirmation email for valid input', async ({
    request,
    apiKey,
  }) => {
    const res = await request.post('/api/subscribe', {
      headers: { 'X-API-Key': apiKey },
      data: { email: EMAIL, repo: REPO },
    });

    expect(res.status()).toBe(200);
    expect(await res.json()).toHaveProperty('message');
  });

  test('returns 400 for invalid email format', async ({ request, apiKey }) => {
    const res = await request.post('/api/subscribe', {
      headers: { 'X-API-Key': apiKey },
      data: { email: 'not-an-email', repo: REPO },
    });

    expect(res.status()).toBe(400);
    expect(await res.json()).toHaveProperty('error');
  });

  test('returns 400 for invalid repo format', async ({ request, apiKey }) => {
    const res = await request.post('/api/subscribe', {
      headers: { 'X-API-Key': apiKey },
      data: { email: EMAIL, repo: 'no-slash-repo' },
    });

    expect(res.status()).toBe(400);
    expect(await res.json()).toHaveProperty('error');
  });

  test('returns 404 for non-existent GitHub repository', async ({
    request,
    apiKey,
  }) => {
    const res = await request.post('/api/subscribe', {
      headers: { 'X-API-Key': apiKey },
      data: {
        email: EMAIL,
        repo: 'nonexistent-user-xyz123/nonexistent-repo-xyz456',
      },
    });

    expect(res.status()).toBe(404);
    expect(await res.json()).toHaveProperty('error');
  });

  test('returns 409 when already subscribed to the same repo', async ({
    request,
    apiKey,
  }) => {
    await request.post('/api/subscribe', {
      headers: { 'X-API-Key': apiKey },
      data: { email: EMAIL, repo: REPO },
    });

    const res = await request.post('/api/subscribe', {
      headers: { 'X-API-Key': apiKey },
      data: { email: EMAIL, repo: REPO },
    });

    expect(res.status()).toBe(409);
    expect(await res.json()).toHaveProperty('error');
  });
});

test.describe('GET /api/confirm/:token', () => {
  test.beforeEach(async ({ request, apiKey, db }) => {
    await deleteSubscriptions(db, EMAIL);
    await request.post('/api/subscribe', {
      headers: { 'X-API-Key': apiKey },
      data: { email: EMAIL, repo: REPO },
    });
  });

  test('returns 200 for a valid confirm token', async ({ request, db }) => {
    const { confirmToken } = await getSubscriptionTokens(db, EMAIL, REPO);

    const res = await request.get(`/api/confirm/${confirmToken}`);

    expect(res.status()).toBe(200);
    expect(await res.json()).toHaveProperty('message');
  });

  test('returns 400 for invalid token format', async ({ request }) => {
    const res = await request.get('/api/confirm/invalid-token');

    expect(res.status()).toBe(400);
    expect(await res.json()).toHaveProperty('error');
  });

  test('returns 404 for unknown token', async ({ request }) => {
    const res = await request.get(`/api/confirm/${'a'.repeat(64)}`);

    expect(res.status()).toBe(404);
    expect(await res.json()).toHaveProperty('error');
  });
});

test.describe('GET /api/unsubscribe/:token', () => {
  test.beforeEach(async ({ request, apiKey, db }) => {
    await deleteSubscriptions(db, EMAIL);
    await request.post('/api/subscribe', {
      headers: { 'X-API-Key': apiKey },
      data: { email: EMAIL, repo: REPO },
    });
  });

  test('returns 200 for a valid unsubscribe token', async ({ request, db }) => {
    const { unsubscribeToken } = await getSubscriptionTokens(db, EMAIL, REPO);

    const res = await request.get(`/api/unsubscribe/${unsubscribeToken}`);

    expect(res.status()).toBe(200);
    expect(await res.json()).toHaveProperty('message');
  });

  test('returns 400 for invalid token format', async ({ request }) => {
    const res = await request.get('/api/unsubscribe/bad-token');

    expect(res.status()).toBe(400);
    expect(await res.json()).toHaveProperty('error');
  });

  test('returns 404 for unknown token', async ({ request }) => {
    const res = await request.get(`/api/unsubscribe/${'b'.repeat(64)}`);

    expect(res.status()).toBe(404);
    expect(await res.json()).toHaveProperty('error');
  });
});

test.describe('GET /api/subscriptions', () => {
  test.beforeEach(async ({ request, apiKey, db }) => {
    await deleteSubscriptions(db, EMAIL);
    await request.post('/api/subscribe', {
      headers: { 'X-API-Key': apiKey },
      data: { email: EMAIL, repo: REPO },
    });
  });

  test('returns subscription list for a known email', async ({ request }) => {
    const res = await request.get('/api/subscriptions', {
      params: { email: EMAIL },
    });

    expect(res.status()).toBe(200);
    const subs = await res.json();
    expect(subs).toHaveLength(1);
    expect(subs[0]).toMatchObject({ email: EMAIL, repo: REPO });
  });

  test('returns empty array for email with no subscriptions', async ({
    request,
  }) => {
    const res = await request.get('/api/subscriptions', {
      params: { email: 'nobody@example.com' },
    });

    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test('returns 400 when email query param is missing', async ({ request }) => {
    const res = await request.get('/api/subscriptions');

    expect(res.status()).toBe(400);
    expect(await res.json()).toHaveProperty('error');
  });

  test('returns 400 for invalid email format', async ({ request }) => {
    const res = await request.get('/api/subscriptions', {
      params: { email: 'not-valid' },
    });

    expect(res.status()).toBe(400);
    expect(await res.json()).toHaveProperty('error');
  });
});

test('full flow: subscribe → confirm → list → unsubscribe', async ({
  request,
  apiKey,
  db,
}) => {
  await deleteSubscriptions(db, EMAIL);

  // subscribe
  const subscribeRes = await request.post('/api/subscribe', {
    headers: { 'X-API-Key': apiKey },
    data: { email: EMAIL, repo: REPO },
  });
  expect(subscribeRes.status()).toBe(200);

  const { confirmToken, unsubscribeToken } = await getSubscriptionTokens(
    db,
    EMAIL,
    REPO,
  );

  // confirm
  const confirmRes = await request.get(`/api/confirm/${confirmToken}`);
  expect(confirmRes.status()).toBe(200);

  // list — subscription should be confirmed
  const listRes = await request.get('/api/subscriptions', {
    params: { email: EMAIL },
  });
  expect(listRes.status()).toBe(200);
  const subs = await listRes.json();
  expect(subs[0]).toMatchObject({ email: EMAIL, repo: REPO, confirmed: true });

  // unsubscribe
  const unsubRes = await request.get(`/api/unsubscribe/${unsubscribeToken}`);
  expect(unsubRes.status()).toBe(200);

  // list — should be empty now
  const listRes2 = await request.get('/api/subscriptions', {
    params: { email: EMAIL },
  });
  expect(await listRes2.json()).toHaveLength(0);
});
