import type { ISubscriptionModel } from '../../models/subscriptionModel.js';
import type { IRepositoryModel } from '../../models/repositoryModel.js';
import type { IEmailService } from '../emailService.js';
import type { IGithubService } from '../githubService.js';
import type { ILogger } from '../../utils/logger.js';
import { ScannerService } from '../scannerService.js';

const REPO_A = 'owner/repo-a';
const REPO_B = 'owner/repo-b';

function makeSubscriber(
  repo: string,
  email: string,
  lastSeenTag: string | null = null,
  unsubscribeToken = 'token-' + email,
) {
  return {
    email,
    repo,
    unsubscribe_token: unsubscribeToken,
    last_seen_tag: lastSeenTag,
  };
}

describe('ScannerService', () => {
  let service: ScannerService;

  // Typed as plain {method: jest.Mock} objects to avoid jest.Mocked<T> resolution
  // issues in ESLint when interface comes from a newly added module.
  let mockModel: { [K in keyof ISubscriptionModel]: jest.Mock };
  let mockRepositoryModel: { [K in keyof IRepositoryModel]: jest.Mock };
  let mockEmailService: { [K in keyof IEmailService]: jest.Mock };
  let mockGithubService: { [K in keyof IGithubService]: jest.Mock };
  let mockLogger: { [K in keyof ILogger]: jest.Mock };

  beforeEach(() => {
    mockModel = {
      create: jest.fn(),
      existsByEmailAndRepo: jest.fn(),
      confirm: jest.fn(),
      deleteByUnsubscribeToken: jest.fn(),
      findAllConfirmedWithTokens: jest.fn(),
      findByEmail: jest.fn(),
    };
    mockRepositoryModel = {
      upsert: jest.fn(),
      updateLastSeenTag: jest.fn().mockResolvedValue(undefined),
    };
    mockEmailService = {
      sendConfirmationEmail: jest.fn(),
      sendNotificationEmail: jest.fn().mockResolvedValue(undefined),
    };
    mockGithubService = {
      repositoryExists: jest.fn(),
      getLatestRelease: jest.fn(),
    };
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    };

    service = new ScannerService(
      mockModel,
      mockRepositoryModel,
      mockEmailService,
      mockGithubService,
      mockLogger,
    );
  });

  describe('scan', () => {
    it('should not send any emails if there are no active subscriptions', async () => {
      mockModel.findAllConfirmedWithTokens.mockResolvedValue([]);

      await service.scan();

      expect(mockGithubService.getLatestRelease).not.toHaveBeenCalled();
      expect(mockEmailService.sendNotificationEmail).not.toHaveBeenCalled();
    });

    it('should fetch the latest release for each unique repository in active subscriptions', async () => {
      mockModel.findAllConfirmedWithTokens.mockResolvedValue([
        makeSubscriber(REPO_A, 'a@example.com', 'v1.0.0'),
        makeSubscriber(REPO_A, 'b@example.com', 'v1.0.0'),
        makeSubscriber(REPO_B, 'c@example.com', 'v2.0.0'),
      ]);
      mockGithubService.getLatestRelease.mockResolvedValue({
        tag_name: 'v1.0.0',
        html_url: 'https://github.com',
      });

      await service.scan();

      expect(mockGithubService.getLatestRelease).toHaveBeenCalledTimes(2);
      expect(mockGithubService.getLatestRelease).toHaveBeenCalledWith(REPO_A);
      expect(mockGithubService.getLatestRelease).toHaveBeenCalledWith(REPO_B);
    });

    it('should send a notification email to each subscriber when a new release is detected', async () => {
      mockModel.findAllConfirmedWithTokens.mockResolvedValue([
        makeSubscriber(REPO_A, 'a@example.com', 'v1.0.0', 'token-a'),
        makeSubscriber(REPO_A, 'b@example.com', 'v1.0.0', 'token-b'),
      ]);
      mockGithubService.getLatestRelease.mockResolvedValue({
        tag_name: 'v2.0.0',
        html_url: 'https://github.com',
      });

      await service.scan();

      expect(mockEmailService.sendNotificationEmail).toHaveBeenCalledTimes(2);
      expect(mockEmailService.sendNotificationEmail).toHaveBeenCalledWith(
        'a@example.com',
        REPO_A,
        'v2.0.0',
        'token-a',
      );
      expect(mockEmailService.sendNotificationEmail).toHaveBeenCalledWith(
        'b@example.com',
        REPO_A,
        'v2.0.0',
        'token-b',
      );
    });

    it('should update last_seen_tag in the database after sending notifications', async () => {
      mockModel.findAllConfirmedWithTokens.mockResolvedValue([
        makeSubscriber(REPO_A, 'a@example.com', 'v1.0.0'),
      ]);
      mockGithubService.getLatestRelease.mockResolvedValue({
        tag_name: 'v2.0.0',
        html_url: 'https://github.com',
      });

      await service.scan();

      expect(mockRepositoryModel.updateLastSeenTag).toHaveBeenCalledWith(
        REPO_A,
        'v2.0.0',
      );
    });

    it('should not send a notification if the latest release matches last_seen_tag', async () => {
      mockModel.findAllConfirmedWithTokens.mockResolvedValue([
        makeSubscriber(REPO_A, 'a@example.com', 'v1.0.0'),
      ]);
      mockGithubService.getLatestRelease.mockResolvedValue({
        tag_name: 'v1.0.0',
        html_url: 'https://github.com',
      });

      await service.scan();

      expect(mockEmailService.sendNotificationEmail).not.toHaveBeenCalled();
      expect(mockRepositoryModel.updateLastSeenTag).not.toHaveBeenCalled();
    });

    it('should not send a notification if the repository has no releases', async () => {
      mockModel.findAllConfirmedWithTokens.mockResolvedValue([
        makeSubscriber(REPO_A, 'a@example.com', null),
      ]);
      mockGithubService.getLatestRelease.mockResolvedValue(null);

      await service.scan();

      expect(mockEmailService.sendNotificationEmail).not.toHaveBeenCalled();
    });

    it('should continue processing remaining repos if one GitHub API call fails', async () => {
      mockModel.findAllConfirmedWithTokens.mockResolvedValue([
        makeSubscriber(REPO_A, 'a@example.com', 'v1.0.0'),
        makeSubscriber(REPO_B, 'b@example.com', 'v1.0.0'),
      ]);
      mockGithubService.getLatestRelease
        .mockRejectedValueOnce(new Error('GitHub API error'))
        .mockResolvedValueOnce({
          tag_name: 'v2.0.0',
          html_url: 'https://github.com',
        });

      await service.scan();

      expect(mockGithubService.getLatestRelease).toHaveBeenCalledTimes(2);
      expect(mockEmailService.sendNotificationEmail).toHaveBeenCalledTimes(1);
      expect(mockEmailService.sendNotificationEmail).toHaveBeenCalledWith(
        'b@example.com',
        REPO_B,
        'v2.0.0',
        expect.any(String),
      );
    });
  });
});
