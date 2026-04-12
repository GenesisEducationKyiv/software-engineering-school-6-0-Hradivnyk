import request from 'supertest';
import app from '../../src/app.js';
import { subscriptionService } from '../../src/services/subscriptionService.js';
import {
  DuplicateSubscriptionError,
  RepositoryNotFoundError,
  TokenNotFoundError,
} from '../../src/errors.js';
import type { Subscription } from '../../src/types.js';

jest.mock('../../src/db/knex.js', () => ({}));
jest.mock('../../src/services/subscriptionService.js');

const mockedService = jest.mocked(subscriptionService);

const VALID_TOKEN = 'a'.repeat(64);
const EMAIL = 'user@example.com';
const REPO = 'owner/repo';
const API_KEY = process.env.API_KEY as string;

describe('API key authentication', () => {
  it('should return 401 when X-API-Key header is missing', async () => {
    const res = await request(app).post('/api/subscribe').send({});

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 401 when X-API-Key header is invalid', async () => {
    const res = await request(app)
      .post('/api/subscribe')
      .set('X-API-Key', 'wrong-key')
      .send({});

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
});

describe('POST /api/subscribe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedService.subscribe.mockResolvedValue(undefined);
  });

  it('should return 200 and send a confirmation email with valid email and existing repository', async () => {
    const res = await request(app)
      .post('/api/subscribe')
      .set('X-API-Key', API_KEY)
      .send({ email: EMAIL, repo: REPO });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(mockedService.subscribe).toHaveBeenCalledWith(EMAIL, REPO);
  });

  it('should return 400 if email format is invalid', async () => {
    const res = await request(app)
      .post('/api/subscribe')
      .set('X-API-Key', API_KEY)
      .send({ email: 'invalid-email', repo: REPO });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 400 if repo does not match owner/repo format', async () => {
    const res = await request(app)
      .post('/api/subscribe')
      .set('X-API-Key', API_KEY)
      .send({ email: EMAIL, repo: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 404 if repository is not found on GitHub', async () => {
    mockedService.subscribe.mockRejectedValue(
      new RepositoryNotFoundError(REPO),
    );

    const res = await request(app)
      .post('/api/subscribe')
      .set('X-API-Key', API_KEY)
      .send({ email: EMAIL, repo: REPO });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 409 if email is already subscribed to this repository', async () => {
    mockedService.subscribe.mockRejectedValue(
      new DuplicateSubscriptionError(EMAIL, REPO),
    );

    const res = await request(app)
      .post('/api/subscribe')
      .set('X-API-Key', API_KEY)
      .send({ email: EMAIL, repo: REPO });

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error');
  });
});

describe('GET /api/confirm/:token', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 200 and confirm the subscription with a valid token', async () => {
    mockedService.confirm.mockResolvedValue(undefined);

    const res = await request(app)
      .get(`/api/confirm/${VALID_TOKEN}`)
      .set('X-API-Key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(mockedService.confirm).toHaveBeenCalledWith(VALID_TOKEN);
  });

  it('should return 400 if token format is invalid', async () => {
    const res = await request(app)
      .get('/api/confirm/invalid-token')
      .set('X-API-Key', API_KEY);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 404 if token is not found', async () => {
    mockedService.confirm.mockRejectedValue(new TokenNotFoundError());

    const res = await request(app)
      .get(`/api/confirm/${VALID_TOKEN}`)
      .set('X-API-Key', API_KEY);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});

describe('GET /api/unsubscribe/:token', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 200 and remove the subscription with a valid token', async () => {
    mockedService.unsubscribe.mockResolvedValue(undefined);

    const res = await request(app)
      .get(`/api/unsubscribe/${VALID_TOKEN}`)
      .set('X-API-Key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(mockedService.unsubscribe).toHaveBeenCalledWith(VALID_TOKEN);
  });

  it('should return 400 if token format is invalid', async () => {
    const res = await request(app)
      .get('/api/unsubscribe/bad-token')
      .set('X-API-Key', API_KEY);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 404 if token is not found', async () => {
    mockedService.unsubscribe.mockRejectedValue(new TokenNotFoundError());

    const res = await request(app)
      .get(`/api/unsubscribe/${VALID_TOKEN}`)
      .set('X-API-Key', API_KEY);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});

describe('GET /api/subscriptions', () => {
  const subscriptions: Subscription[] = [
    { email: EMAIL, repo: REPO, confirmed: true, last_seen_tag: 'v1.0.0' },
    {
      email: EMAIL,
      repo: 'owner/other-repo',
      confirmed: true,
      last_seen_tag: null,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 200 and an array of subscriptions for a given email', async () => {
    mockedService.getSubscriptions.mockResolvedValue(subscriptions);

    const res = await request(app)
      .get('/api/subscriptions')
      .set('X-API-Key', API_KEY)
      .query({ email: EMAIL });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(subscriptions);
    expect(mockedService.getSubscriptions).toHaveBeenCalledWith(EMAIL);
  });

  it('should return 200 and an empty array if no subscriptions exist', async () => {
    mockedService.getSubscriptions.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/subscriptions')
      .set('X-API-Key', API_KEY)
      .query({ email: EMAIL });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('should return 400 if email query parameter is missing', async () => {
    const res = await request(app)
      .get('/api/subscriptions')
      .set('X-API-Key', API_KEY);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 400 if email format is invalid', async () => {
    const res = await request(app)
      .get('/api/subscriptions')
      .set('X-API-Key', API_KEY)
      .query({ email: 'not-a-valid-email' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});
