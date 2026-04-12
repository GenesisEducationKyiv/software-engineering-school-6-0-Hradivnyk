import {
  DuplicateSubscriptionError,
  InvalidTokenError,
  RepositoryNotFoundError,
  TokenNotFoundError,
} from '../../errors.js';
import { subscriptionModel } from '../../models/subscriptionModel.js';
import { emailService } from '../emailService.js';
import { githubService } from '../githubService.js';
import { SubscriptionService } from '../subscriptionService.js';

jest.mock('../../db/knex.js', () => ({}));
jest.mock('../githubService.js');
jest.mock('../../models/subscriptionModel.js');
jest.mock('../emailService.js');

const mockedGithubService = jest.mocked(githubService);
const mockedModel = jest.mocked(subscriptionModel);
const mockedEmailService = jest.mocked(emailService);

const VALID_TOKEN = 'a'.repeat(64);
const EMAIL = 'user@example.com';
const REPO = 'owner/repo';

describe('SubscriptionService', () => {
  let service: SubscriptionService;

  beforeEach(() => {
    service = new SubscriptionService();
    jest.clearAllMocks();
  });

  describe('subscribe', () => {
    beforeEach(() => {
      mockedGithubService.repositoryExists.mockResolvedValue(true);
      mockedModel.existsByEmailAndRepo.mockResolvedValue(false);
      mockedModel.create.mockResolvedValue(undefined);
      mockedEmailService.sendConfirmationEmail.mockResolvedValue(undefined);
    });

    it('should validate that the repository exists via githubService', async () => {
      await service.subscribe(EMAIL, REPO);

      expect(mockedGithubService.repositoryExists).toHaveBeenCalledWith(REPO);
    });

    it('should save a new unconfirmed subscription to the database', async () => {
      await service.subscribe(EMAIL, REPO);

      expect(mockedModel.create).toHaveBeenCalledWith(
        EMAIL,
        REPO,
        expect.stringMatching(/^[0-9a-f]{64}$/),
        expect.stringMatching(/^[0-9a-f]{64}$/),
      );
    });

    it('should generate a confirmation token and store it', async () => {
      await service.subscribe(EMAIL, REPO);

      const [, , confirmToken, unsubscribeToken] =
        mockedModel.create.mock.calls[0];
      expect(confirmToken).toMatch(/^[0-9a-f]{64}$/);
      expect(unsubscribeToken).toMatch(/^[0-9a-f]{64}$/);
      expect(confirmToken).not.toBe(unsubscribeToken);
    });

    it('should call emailService to send a confirmation email', async () => {
      await service.subscribe(EMAIL, REPO);

      const [, , confirmToken] = mockedModel.create.mock.calls[0];
      expect(mockedEmailService.sendConfirmationEmail).toHaveBeenCalledWith(
        EMAIL,
        confirmToken,
        REPO,
      );
    });

    it('should throw RepositoryNotFoundError if githubService returns not found', async () => {
      mockedGithubService.repositoryExists.mockResolvedValue(false);

      await expect(service.subscribe(EMAIL, REPO)).rejects.toThrow(
        RepositoryNotFoundError,
      );
    });

    it('should throw DuplicateSubscriptionError if subscription already exists for email and repo', async () => {
      mockedModel.existsByEmailAndRepo.mockResolvedValue(true);

      await expect(service.subscribe(EMAIL, REPO)).rejects.toThrow(
        DuplicateSubscriptionError,
      );
    });
  });

  describe('confirm', () => {
    it('should mark the subscription as confirmed in the database', async () => {
      mockedModel.confirm.mockResolvedValue(true);

      await service.confirm(VALID_TOKEN);

      expect(mockedModel.confirm).toHaveBeenCalledWith(VALID_TOKEN);
    });

    it('should throw TokenNotFoundError if the token does not exist', async () => {
      mockedModel.confirm.mockResolvedValue(false);

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
      mockedModel.deleteByUnsubscribeToken.mockResolvedValue(true);

      await service.unsubscribe(VALID_TOKEN);

      expect(mockedModel.deleteByUnsubscribeToken).toHaveBeenCalledWith(
        VALID_TOKEN,
      );
    });

    it('should throw TokenNotFoundError if the token does not exist', async () => {
      mockedModel.deleteByUnsubscribeToken.mockResolvedValue(false);

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
      mockedModel.findByEmail.mockResolvedValue(subscriptions);

      const result = await service.getSubscriptions(EMAIL);

      expect(result).toEqual(subscriptions);
      expect(mockedModel.findByEmail).toHaveBeenCalledWith(EMAIL);
    });

    it('should return an empty array if no subscriptions exist for the email', async () => {
      mockedModel.findByEmail.mockResolvedValue([]);

      const result = await service.getSubscriptions(EMAIL);

      expect(result).toEqual([]);
    });
  });
});
