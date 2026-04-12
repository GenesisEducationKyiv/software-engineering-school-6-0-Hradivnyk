import type { NextFunction, Request, Response } from 'express';
import {
  DuplicateSubscriptionError,
  RepositoryNotFoundError,
  TokenNotFoundError,
} from '../../errors.js';
import { SubscriptionController } from '../subscriptionController.js';
import { subscriptionService } from '../../services/subscriptionService.js';

jest.mock('../../db/knex.js', () => ({}));
jest.mock('../../services/subscriptionService.js');

const mockedService = jest.mocked(subscriptionService);

const VALID_TOKEN = 'a'.repeat(64);
const EMAIL = 'user@example.com';
const REPO = 'owner/repo';

function mockReq(
  overrides: {
    body?: Record<string, unknown>;
    params?: Record<string, string>;
    query?: Record<string, unknown>;
  } = {},
): Request {
  return {
    body: overrides.body ?? {},
    params: overrides.params ?? {},
    query: overrides.query ?? {},
  } as unknown as Request;
}

function mockRes(): { res: Response; status: jest.Mock; json: jest.Mock } {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { res: { status } as unknown as Response, status, json };
}

describe('SubscriptionController', () => {
  let controller: SubscriptionController;
  let next: NextFunction;

  beforeEach(() => {
    controller = new SubscriptionController();
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('subscribe', () => {
    it('should call subscriptionService.subscribe with email and repo from request body', async () => {
      mockedService.subscribe.mockResolvedValue(undefined);
      const { res } = mockRes();

      await controller.subscribe(
        mockReq({ body: { email: EMAIL, repo: REPO } }),
        res,
        next,
      );

      expect(mockedService.subscribe).toHaveBeenCalledWith(EMAIL, REPO);
    });

    it('should return 200 on successful subscription', async () => {
      mockedService.subscribe.mockResolvedValue(undefined);
      const { res, status, json } = mockRes();

      await controller.subscribe(
        mockReq({ body: { email: EMAIL, repo: REPO } }),
        res,
        next,
      );

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.any(String) }),
      );
    });

    it('should return 400 if email is missing from request body', async () => {
      const { res, status } = mockRes();

      await controller.subscribe(mockReq({ body: { repo: REPO } }), res, next);

      expect(status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if repo is missing from request body', async () => {
      const { res, status } = mockRes();

      await controller.subscribe(
        mockReq({ body: { email: EMAIL } }),
        res,
        next,
      );

      expect(status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if email format is invalid', async () => {
      const { res, status, json } = mockRes();

      await controller.subscribe(
        mockReq({ body: { email: 'not-an-email', repo: REPO } }),
        res,
        next,
      );

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ error: 'Invalid email format' });
    });

    it('should return 400 if repo does not match owner/repo format', async () => {
      const { res, status, json } = mockRes();

      await controller.subscribe(
        mockReq({ body: { email: EMAIL, repo: 'invalid-repo-format' } }),
        res,
        next,
      );

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('owner/repo'),
        }),
      );
    });

    it('should return 404 if subscriptionService throws a RepositoryNotFoundError', async () => {
      mockedService.subscribe.mockRejectedValue(
        new RepositoryNotFoundError(REPO),
      );
      const { res, status, json } = mockRes();

      await controller.subscribe(
        mockReq({ body: { email: EMAIL, repo: REPO } }),
        res,
        next,
      );

      expect(status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(String) }),
      );
    });

    it('should return 409 if subscriptionService throws a DuplicateSubscriptionError', async () => {
      mockedService.subscribe.mockRejectedValue(
        new DuplicateSubscriptionError(EMAIL, REPO),
      );
      const { res, status, json } = mockRes();

      await controller.subscribe(
        mockReq({ body: { email: EMAIL, repo: REPO } }),
        res,
        next,
      );

      expect(status).toHaveBeenCalledWith(409);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(String) }),
      );
    });
  });

  describe('confirmSubscription', () => {
    it('should call subscriptionService.confirm with token from request params', async () => {
      mockedService.confirm.mockResolvedValue(undefined);
      const { res } = mockRes();

      await controller.confirmSubscription(
        mockReq({ params: { token: VALID_TOKEN } }),
        res,
        next,
      );

      expect(mockedService.confirm).toHaveBeenCalledWith(VALID_TOKEN);
    });

    it('should return 200 on successful confirmation', async () => {
      mockedService.confirm.mockResolvedValue(undefined);
      const { res, status, json } = mockRes();

      await controller.confirmSubscription(
        mockReq({ params: { token: VALID_TOKEN } }),
        res,
        next,
      );

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.any(String) }),
      );
    });

    it('should return 400 if token format is invalid', async () => {
      const { res, status, json } = mockRes();

      await controller.confirmSubscription(
        mockReq({ params: { token: 'not-a-valid-token' } }),
        res,
        next,
      );

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ error: 'Invalid token format' });
    });

    it('should return 404 if subscriptionService throws a TokenNotFoundError', async () => {
      mockedService.confirm.mockRejectedValue(new TokenNotFoundError());
      const { res, status, json } = mockRes();

      await controller.confirmSubscription(
        mockReq({ params: { token: VALID_TOKEN } }),
        res,
        next,
      );

      expect(status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(String) }),
      );
    });
  });

  describe('unsubscribe', () => {
    it('should call subscriptionService.unsubscribe with token from request params', async () => {
      mockedService.unsubscribe.mockResolvedValue(undefined);
      const { res } = mockRes();

      await controller.unsubscribe(
        mockReq({ params: { token: VALID_TOKEN } }),
        res,
        next,
      );

      expect(mockedService.unsubscribe).toHaveBeenCalledWith(VALID_TOKEN);
    });

    it('should return 200 on successful unsubscription', async () => {
      mockedService.unsubscribe.mockResolvedValue(undefined);
      const { res, status, json } = mockRes();

      await controller.unsubscribe(
        mockReq({ params: { token: VALID_TOKEN } }),
        res,
        next,
      );

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.any(String) }),
      );
    });

    it('should return 400 if token format is invalid', async () => {
      const { res, status, json } = mockRes();

      await controller.unsubscribe(
        mockReq({ params: { token: 'bad-token' } }),
        res,
        next,
      );

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ error: 'Invalid token format' });
    });

    it('should return 404 if subscriptionService throws a TokenNotFoundError', async () => {
      mockedService.unsubscribe.mockRejectedValue(new TokenNotFoundError());
      const { res, status, json } = mockRes();

      await controller.unsubscribe(
        mockReq({ params: { token: VALID_TOKEN } }),
        res,
        next,
      );

      expect(status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(String) }),
      );
    });
  });

  describe('getSubscriptions', () => {
    const subscriptions = [
      { email: EMAIL, repo: REPO, confirmed: true, last_seen_tag: 'v1.0.0' },
    ];

    it('should call subscriptionService.getSubscriptions with email from query params', async () => {
      mockedService.getSubscriptions.mockResolvedValue(subscriptions);
      const { res } = mockRes();

      await controller.getSubscriptions(
        mockReq({ query: { email: EMAIL } }),
        res,
        next,
      );

      expect(mockedService.getSubscriptions).toHaveBeenCalledWith(EMAIL);
    });

    it('should return 200 and an array of subscriptions', async () => {
      mockedService.getSubscriptions.mockResolvedValue(subscriptions);
      const { res, status, json } = mockRes();

      await controller.getSubscriptions(
        mockReq({ query: { email: EMAIL } }),
        res,
        next,
      );

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith(subscriptions);
    });

    it('should return 200 and an empty array if no subscriptions found', async () => {
      mockedService.getSubscriptions.mockResolvedValue([]);
      const { res, status, json } = mockRes();

      await controller.getSubscriptions(
        mockReq({ query: { email: EMAIL } }),
        res,
        next,
      );

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith([]);
    });

    it('should return 400 if email query param is missing', async () => {
      const { res, status } = mockRes();

      await controller.getSubscriptions(mockReq({ query: {} }), res, next);

      expect(status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if email format is invalid', async () => {
      const { res, status, json } = mockRes();

      await controller.getSubscriptions(
        mockReq({ query: { email: 'not-an-email' } }),
        res,
        next,
      );

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ error: 'Invalid email format' });
    });
  });
});
