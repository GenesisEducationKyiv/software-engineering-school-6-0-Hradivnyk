import { EmailTemplateBuilder } from '../emailTemplateBuilder.js';

const EMAIL = 'user@example.com';
const REPO = 'owner/repo';
const TOKEN = 'abc123token';
const BASE_URL = 'http://localhost:3000';

describe('EmailTemplateBuilder', () => {
  let builder: EmailTemplateBuilder;

  beforeEach(() => {
    builder = new EmailTemplateBuilder(BASE_URL);
  });

  describe('confirmationEmail', () => {
    it('should set the recipient address', () => {
      const options = builder.confirmationEmail(EMAIL, TOKEN, REPO);

      expect(options.to).toBe(EMAIL);
    });

    it('should include the repo name in the subject', () => {
      const options = builder.confirmationEmail(EMAIL, TOKEN, REPO);

      expect(options.subject).toContain(REPO);
    });

    it('should include the confirmation URL with the token in the body', () => {
      const options = builder.confirmationEmail(EMAIL, TOKEN, REPO);

      expect(options.text).toContain(`${BASE_URL}/api/confirm/${TOKEN}`);
    });
  });

  describe('notificationEmail', () => {
    const TAG = 'v2.0.0';

    it('should set the recipient address', () => {
      const options = builder.notificationEmail(EMAIL, REPO, TAG, TOKEN);

      expect(options.to).toBe(EMAIL);
    });

    it('should include the repo name and tag in the subject', () => {
      const options = builder.notificationEmail(EMAIL, REPO, TAG, TOKEN);

      expect(options.subject).toContain(REPO);
      expect(options.subject).toContain(TAG);
    });

    it('should include the unsubscribe URL with the token in the body', () => {
      const options = builder.notificationEmail(EMAIL, REPO, TAG, TOKEN);

      expect(options.text).toContain(`${BASE_URL}/api/unsubscribe/${TOKEN}`);
    });
  });
});
