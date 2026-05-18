import { EmailService } from '../emailService.js';
import type { IEmailSender, SendMailOptions } from '../emailSender.js';

const EMAIL = 'user@example.com';
const REPO = 'owner/repo';
const TOKEN = 'abc123token';
const BASE_URL = 'http://localhost:3000';

describe('EmailService', () => {
  let mockSend: jest.Mock<Promise<void>, [SendMailOptions]>;
  let sender: IEmailSender;
  let service: EmailService;

  beforeEach(() => {
    mockSend = jest.fn().mockResolvedValue(undefined);
    sender = { send: mockSend };
    service = new EmailService(sender, BASE_URL);
  });

  describe('sendConfirmationEmail', () => {
    it('should send to the correct recipient email address', async () => {
      await service.sendConfirmationEmail(EMAIL, TOKEN, REPO);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ to: EMAIL }),
      );
    });

    it('should send an email with a subject containing the repo name', async () => {
      await service.sendConfirmationEmail(EMAIL, TOKEN, REPO);

      const [options] = mockSend.mock.calls[0];
      expect(options.subject).toContain(REPO);
    });

    it('should send an email with a confirmation link containing the token', async () => {
      await service.sendConfirmationEmail(EMAIL, TOKEN, REPO);

      const [options] = mockSend.mock.calls[0];
      expect(options.text).toContain(`/api/confirm/${TOKEN}`);
    });

    it('should throw an error if the mail transport fails', async () => {
      mockSend.mockRejectedValue(new Error('SMTP error'));

      await expect(
        service.sendConfirmationEmail(EMAIL, TOKEN, REPO),
      ).rejects.toThrow('SMTP error');
    });
  });

  describe('sendNotificationEmail', () => {
    const TAG = 'v2.0.0';

    it('should send to the correct recipient email address', async () => {
      await service.sendNotificationEmail(EMAIL, REPO, TAG, TOKEN);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ to: EMAIL }),
      );
    });

    it('should send a release notification email with the repo name and release tag', async () => {
      await service.sendNotificationEmail(EMAIL, REPO, TAG, TOKEN);

      const [options] = mockSend.mock.calls[0];
      expect(options.subject).toContain(REPO);
      expect(options.subject).toContain(TAG);
    });

    it('should include an unsubscribe link with the correct token', async () => {
      await service.sendNotificationEmail(EMAIL, REPO, TAG, TOKEN);

      const [options] = mockSend.mock.calls[0];
      expect(options.text).toContain(`/api/unsubscribe/${TOKEN}`);
    });

    it('should throw an error if the mail transport fails', async () => {
      mockSend.mockRejectedValue(new Error('Connection timeout'));

      await expect(
        service.sendNotificationEmail(EMAIL, REPO, TAG, TOKEN),
      ).rejects.toThrow('Connection timeout');
    });
  });
});
