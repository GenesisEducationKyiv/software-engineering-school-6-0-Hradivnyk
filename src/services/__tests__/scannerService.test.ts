import cron from 'node-cron';
import { subscriptionModel } from '../../models/subscriptionModel.js';
import { emailService } from '../emailService.js';
import { githubService } from '../githubService.js';
import { ScannerService } from '../scannerService.js';

jest.mock('../../db/knex.js', () => ({}));
jest.mock('../githubService.js');
jest.mock('../emailService.js');
jest.mock('../../models/subscriptionModel.js');
jest.mock('node-cron');

const mockedGithubService = jest.mocked(githubService);
const mockedEmailService = jest.mocked(emailService);
const mockedModel = jest.mocked(subscriptionModel);
const mockedCron = jest.mocked(cron);

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

  beforeEach(() => {
    service = new ScannerService();
    jest.clearAllMocks();
    mockedEmailService.sendNotificationEmail.mockResolvedValue(undefined);
    mockedModel.updateLastSeenTag.mockResolvedValue(undefined);
  });

  describe('scan', () => {
    it('should not send any emails if there are no active subscriptions', async () => {
      mockedModel.findAllConfirmedWithTokens.mockResolvedValue([]);

      await service.scan();

      expect(mockedGithubService.getLatestRelease).not.toHaveBeenCalled();
      expect(mockedEmailService.sendNotificationEmail).not.toHaveBeenCalled();
    });

    it('should fetch the latest release for each unique repository in active subscriptions', async () => {
      mockedModel.findAllConfirmedWithTokens.mockResolvedValue([
        makeSubscriber(REPO_A, 'a@example.com', 'v1.0.0'),
        makeSubscriber(REPO_A, 'b@example.com', 'v1.0.0'),
        makeSubscriber(REPO_B, 'c@example.com', 'v2.0.0'),
      ]);
      mockedGithubService.getLatestRelease.mockResolvedValue({
        tag_name: 'v1.0.0',
        html_url: 'https://github.com',
      });

      await service.scan();

      expect(mockedGithubService.getLatestRelease).toHaveBeenCalledTimes(2);
      expect(mockedGithubService.getLatestRelease).toHaveBeenCalledWith(REPO_A);
      expect(mockedGithubService.getLatestRelease).toHaveBeenCalledWith(REPO_B);
    });

    it('should send a notification email to each subscriber when a new release is detected', async () => {
      mockedModel.findAllConfirmedWithTokens.mockResolvedValue([
        makeSubscriber(REPO_A, 'a@example.com', 'v1.0.0', 'token-a'),
        makeSubscriber(REPO_A, 'b@example.com', 'v1.0.0', 'token-b'),
      ]);
      mockedGithubService.getLatestRelease.mockResolvedValue({
        tag_name: 'v2.0.0',
        html_url: 'https://github.com',
      });

      await service.scan();

      expect(mockedEmailService.sendNotificationEmail).toHaveBeenCalledTimes(2);
      expect(mockedEmailService.sendNotificationEmail).toHaveBeenCalledWith(
        'a@example.com',
        REPO_A,
        'v2.0.0',
        'token-a',
      );
      expect(mockedEmailService.sendNotificationEmail).toHaveBeenCalledWith(
        'b@example.com',
        REPO_A,
        'v2.0.0',
        'token-b',
      );
    });

    it('should update last_seen_tag in the database after sending notifications', async () => {
      mockedModel.findAllConfirmedWithTokens.mockResolvedValue([
        makeSubscriber(REPO_A, 'a@example.com', 'v1.0.0'),
      ]);
      mockedGithubService.getLatestRelease.mockResolvedValue({
        tag_name: 'v2.0.0',
        html_url: 'https://github.com',
      });

      await service.scan();

      expect(mockedModel.updateLastSeenTag).toHaveBeenCalledWith(
        REPO_A,
        'v2.0.0',
      );
    });

    it('should not send a notification if the latest release matches last_seen_tag', async () => {
      mockedModel.findAllConfirmedWithTokens.mockResolvedValue([
        makeSubscriber(REPO_A, 'a@example.com', 'v1.0.0'),
      ]);
      mockedGithubService.getLatestRelease.mockResolvedValue({
        tag_name: 'v1.0.0',
        html_url: 'https://github.com',
      });

      await service.scan();

      expect(mockedEmailService.sendNotificationEmail).not.toHaveBeenCalled();
      expect(mockedModel.updateLastSeenTag).not.toHaveBeenCalled();
    });

    it('should not send a notification if the repository has no releases', async () => {
      mockedModel.findAllConfirmedWithTokens.mockResolvedValue([
        makeSubscriber(REPO_A, 'a@example.com', null),
      ]);
      mockedGithubService.getLatestRelease.mockResolvedValue(null);

      await service.scan();

      expect(mockedEmailService.sendNotificationEmail).not.toHaveBeenCalled();
    });

    it('should continue processing remaining repos if one GitHub API call fails', async () => {
      mockedModel.findAllConfirmedWithTokens.mockResolvedValue([
        makeSubscriber(REPO_A, 'a@example.com', 'v1.0.0'),
        makeSubscriber(REPO_B, 'b@example.com', 'v1.0.0'),
      ]);
      mockedGithubService.getLatestRelease
        .mockRejectedValueOnce(new Error('GitHub API error'))
        .mockResolvedValueOnce({
          tag_name: 'v2.0.0',
          html_url: 'https://github.com',
        });

      await service.scan();

      expect(mockedGithubService.getLatestRelease).toHaveBeenCalledTimes(2);
      expect(mockedEmailService.sendNotificationEmail).toHaveBeenCalledTimes(1);
      expect(mockedEmailService.sendNotificationEmail).toHaveBeenCalledWith(
        'b@example.com',
        REPO_B,
        'v2.0.0',
        expect.any(String),
      );
    });
  });

  describe('start', () => {
    it('should throw an Error when the cron expression is invalid', () => {
      mockedCron.validate.mockReturnValue(false);

      expect(() => service.start()).toThrow(/Invalid cron schedule/);
    });

    it('should call cron.schedule with the configured schedule when the expression is valid', () => {
      mockedCron.validate.mockReturnValue(true);
      mockedCron.schedule.mockReturnValue(
        {} as ReturnType<typeof cron.schedule>,
      );

      service.start();

      expect(mockedCron.schedule).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
      );
    });
  });
});
