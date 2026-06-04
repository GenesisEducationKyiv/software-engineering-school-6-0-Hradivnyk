import { EmailService } from '../emailService.js';
import type { IEmailSender, SendMailOptions } from '../emailSender.js';
import type { IEmailTemplateBuilder } from '../emailTemplateBuilder.js';

const EMAIL = 'user@example.com';
const REPO = 'owner/repo';
const TOKEN = 'abc123token';
const TAG = 'v2.0.0';

const FAKE_OPTIONS: SendMailOptions = {
  to: EMAIL,
  subject: 'stub subject',
  text: 'stub text',
};

describe('EmailService', () => {
  let mockSend: jest.Mock<Promise<void>, [SendMailOptions]>;
  let mockConfirmationEmail: jest.Mock<SendMailOptions>;
  let mockNotificationEmail: jest.Mock<SendMailOptions>;
  let sender: IEmailSender;
  let templates: IEmailTemplateBuilder;
  let service: EmailService;

  beforeEach(() => {
    mockSend = jest.fn().mockResolvedValue(undefined);
    mockConfirmationEmail = jest.fn().mockReturnValue(FAKE_OPTIONS);
    mockNotificationEmail = jest.fn().mockReturnValue(FAKE_OPTIONS);
    sender = { send: mockSend };
    templates = {
      confirmationEmail: mockConfirmationEmail,
      notificationEmail: mockNotificationEmail,
    };
    service = new EmailService(sender, templates);
  });

  describe('sendConfirmationEmail', () => {
    it('should build the template with correct arguments', async () => {
      await service.sendConfirmationEmail(EMAIL, TOKEN, REPO);

      expect(mockConfirmationEmail).toHaveBeenCalledWith(EMAIL, TOKEN, REPO);
    });

    it('should pass the built template to the sender', async () => {
      await service.sendConfirmationEmail(EMAIL, TOKEN, REPO);

      expect(mockSend).toHaveBeenCalledWith(FAKE_OPTIONS);
    });

    it('should propagate errors from the sender', async () => {
      mockSend.mockRejectedValue(new Error('SMTP error'));

      await expect(
        service.sendConfirmationEmail(EMAIL, TOKEN, REPO),
      ).rejects.toThrow('SMTP error');
    });
  });

  describe('sendNotificationEmail', () => {
    it('should build the template with correct arguments', async () => {
      await service.sendNotificationEmail(EMAIL, REPO, TAG, TOKEN);

      expect(mockNotificationEmail).toHaveBeenCalledWith(
        EMAIL,
        REPO,
        TAG,
        TOKEN,
      );
    });

    it('should pass the built template to the sender', async () => {
      await service.sendNotificationEmail(EMAIL, REPO, TAG, TOKEN);

      expect(mockSend).toHaveBeenCalledWith(FAKE_OPTIONS);
    });

    it('should propagate errors from the sender', async () => {
      mockSend.mockRejectedValue(new Error('Connection timeout'));

      await expect(
        service.sendNotificationEmail(EMAIL, REPO, TAG, TOKEN),
      ).rejects.toThrow('Connection timeout');
    });
  });
});
