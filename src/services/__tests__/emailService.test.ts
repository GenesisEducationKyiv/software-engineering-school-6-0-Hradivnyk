import nodemailer from 'nodemailer';
import { EmailService } from '../emailService.js';

jest.mock('nodemailer');

const mockSendMail = jest.fn();
jest.mocked(nodemailer).createTransport.mockReturnValue({
  sendMail: mockSendMail,
} as unknown as ReturnType<typeof nodemailer.createTransport>);

const EMAIL = 'user@example.com';
const REPO = 'owner/repo';
const TOKEN = 'abc123token';

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(() => {
    service = new EmailService();
    mockSendMail.mockReset();
    mockSendMail.mockResolvedValue(undefined);
  });

  describe('sendConfirmationEmail', () => {
    it('should send to the correct recipient email address', async () => {
      await service.sendConfirmationEmail(EMAIL, TOKEN, REPO);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: EMAIL }),
      );
    });

    it('should send an email with a subject containing the repo name', async () => {
      await service.sendConfirmationEmail(EMAIL, TOKEN, REPO);

      const [mailOptions] = mockSendMail.mock.calls[0];
      expect(mailOptions.subject).toContain(REPO);
    });

    it('should send an email with a confirmation link containing the token', async () => {
      await service.sendConfirmationEmail(EMAIL, TOKEN, REPO);

      const [mailOptions] = mockSendMail.mock.calls[0];
      expect(mailOptions.text).toContain(`/api/confirm/${TOKEN}`);
    });

    it('should throw an error if the mail transport fails', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP error'));

      await expect(
        service.sendConfirmationEmail(EMAIL, TOKEN, REPO),
      ).rejects.toThrow('SMTP error');
    });
  });

  describe('sendNotificationEmail', () => {
    const TAG = 'v2.0.0';

    it('should send to the correct recipient email address', async () => {
      await service.sendNotificationEmail(EMAIL, REPO, TAG, TOKEN);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: EMAIL }),
      );
    });

    it('should send a release notification email with the repo name and release tag', async () => {
      await service.sendNotificationEmail(EMAIL, REPO, TAG, TOKEN);

      const [mailOptions] = mockSendMail.mock.calls[0];
      expect(mailOptions.subject).toContain(REPO);
      expect(mailOptions.subject).toContain(TAG);
    });

    it('should include an unsubscribe link with the correct token', async () => {
      await service.sendNotificationEmail(EMAIL, REPO, TAG, TOKEN);

      const [mailOptions] = mockSendMail.mock.calls[0];
      expect(mailOptions.text).toContain(`/api/unsubscribe/${TOKEN}`);
    });

    it('should throw an error if the mail transport fails', async () => {
      mockSendMail.mockRejectedValue(new Error('Connection timeout'));

      await expect(
        service.sendNotificationEmail(EMAIL, REPO, TAG, TOKEN),
      ).rejects.toThrow('Connection timeout');
    });
  });
});
