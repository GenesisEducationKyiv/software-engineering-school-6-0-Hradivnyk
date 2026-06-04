import {
  DuplicateSubscriptionError,
  InvalidTokenError,
  RepositoryNotFoundError,
  TokenNotFoundError,
} from '../../errors.js';
import type { ISubscriptionModel } from '../../models/subscriptionModel.js';
import type { IEmailService } from '../emailService.js';
import type { IGithubService } from '../githubService.js';
import { SubscriptionService } from '../subscriptionService.js';

const VALID_TOKEN = 'a'.repeat(64);
const EMAIL = 'user@example.com';
const REPO = 'owner/repo';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let mockModel: jest.Mocked<ISubscriptionModel>;
  let mockEmailService: jest.Mocked<IEmailService>;
  let mockGithubService: jest.Mocked<IGithubService>;

  beforeEach(() => {
    mockModel = {
      create: jest.fn(),
      existsByEmailAndRepo: jest.fn(),
      confirm: jest.fn(),
      deleteByUnsubscribeToken: jest.fn(),
      findAllConfirmedWithTokens: jest.fn(),
      findByEmail: jest.fn(),
    };
    mockEmailService = {
      sendConfirmationEmail: jest.fn(),
      sendNotificationEmail: jest.fn(),
    };
    mockGithubService = {
      repositoryExists: jest.fn(),
      getLatestRelease: jest.fn(),
    };
    service = new SubscriptionService(
      mockModel,
      mockEmailService,
      mockGithubService,
    );
  });

  describe('subscribe', () => {
    beforeEach(() => {
      mockGithubService.repositoryExists.mockResolvedValue(true);
      mockModel.existsByEmailAndRepo.mockResolvedValue(false);
      mockModel.create.mockResolvedValue(undefined);
      mockEmailService.sendConfirmationEmail.mockResolvedValue(undefined);
    });

    it('should validate that the repository exists via githubService', async () => {
      await service.subscribe(EMAIL, REPO);

      expect(mockGithubService.repositoryExists).toHaveBeenCalledWith(REPO);
    });

    it('should save a new unconfirmed subscription to the database', async () => {
      await service.subscribe(EMAIL, REPO);

      expect(mockModel.create).toHaveBeenCalledWith(
        EMAIL,
        REPO,
        expect.stringMatching(/^[0-9a-f]{64}$/),
        expect.stringMatching(/^[0-9a-f]{64}$/),
      );
    });

    it('should generate a confirmation token and store it', async () => {
      await service.subscribe(EMAIL, REPO);

      const [, , confirmToken, unsubscribeToken] =
        mockModel.create.mock.calls[0];
      expect(confirmToken).toMatch(/^[0-9a-f]{64}$/);
      expect(unsubscribeToken).toMatch(/^[0-9a-f]{64}$/);
      expect(confirmToken).not.toBe(unsubscribeToken);
    });

    it('should call emailService to send a confirmation email', async () => {
      await service.subscribe(EMAIL, REPO);

      const [, , confirmToken] = mockModel.create.mock.calls[0];
      expect(mockEmailService.sendConfirmationEmail).toHaveBeenCalledWith(
        EMAIL,
        confirmToken,
        REPO,
      );
    });

    it('should throw RepositoryNotFoundError if githubService returns not found', async () => {
      mockGithubService.repositoryExists.mockResolvedValue(false);

      await expect(service.subscribe(EMAIL, REPO)).rejects.toThrow(
        RepositoryNotFoundError,
      );
    });

    it('should throw DuplicateSubscriptionError if subscription already exists for email and repo', async () => {
      mockModel.existsByEmailAndRepo.mockResolvedValue(true);

      await expect(service.subscribe(EMAIL, REPO)).rejects.toThrow(
        DuplicateSubscriptionError,
      );
    });
  });

  describe('confirm', () => {
    it('should mark the subscription as confirmed in the database', async () => {
      mockModel.confirm.mockResolvedValue({ email: EMAIL, repo: REPO });

      await service.confirm(VALID_TOKEN);

      expect(mockModel.confirm).toHaveBeenCalledWith(VALID_TOKEN);
    });

    it('should throw TokenNotFoundError if the token does not exist', async () => {
      mockModel.confirm.mockResolvedValue(null);

      await expect(service.confirm(VALID_TOKEN)).rejects.toThrow(
        TokenNotFoundError,
      );
    });

    it('should throw InvalidTokenError if the token format is invalid', async () => {
      await expect(service.confirm('not-a-valid-token')).rejects.toThrow(
        InvalidTokenError,
      );
    });
  });

  describe('unsubscribe', () => {
    it('should remove the subscription from the database', async () => {
      mockModel.deleteByUnsubscribeToken.mockResolvedValue({
        email: EMAIL,
        repo: REPO,
      });

      await service.unsubscribe(VALID_TOKEN);

      expect(mockModel.deleteByUnsubscribeToken).toHaveBeenCalledWith(
        VALID_TOKEN,
      );
    });

    it('should throw TokenNotFoundError if the token does not exist', async () => {
      mockModel.deleteByUnsubscribeToken.mockResolvedValue(null);

      await expect(service.unsubscribe(VALID_TOKEN)).rejects.toThrow(
        TokenNotFoundError,
      );
    });

    it('should throw InvalidTokenError if the token format is invalid', async () => {
      await expect(service.unsubscribe('bad!')).rejects.toThrow(
        InvalidTokenError,
      );
    });
  });

  describe('getSubscriptions', () => {
    it('should return all confirmed subscriptions for a given email', async () => {
      const subscriptions = [
        { email: EMAIL, repo: REPO, confirmed: true, last_seen_tag: 'v1.2.3' },
        {
          email: EMAIL,
          repo: 'other/repo',
          confirmed: true,
          last_seen_tag: null,
        },
      ];
      mockModel.findByEmail.mockResolvedValue(subscriptions);

      const result = await service.getSubscriptions(EMAIL);

      expect(result).toEqual(subscriptions);
      expect(mockModel.findByEmail).toHaveBeenCalledWith(EMAIL);
    });

    it('should return an empty array if no subscriptions exist for the email', async () => {
      mockModel.findByEmail.mockResolvedValue([]);

      const result = await service.getSubscriptions(EMAIL);

      expect(result).toEqual([]);
    });
  });
});
