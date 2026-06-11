import { test, expect } from '@playwright/test';
import { fillAndSubmit, getConfirmationToken } from './helpers.js';

const MAILHOG_URL = process.env.MAILHOG_URL ?? 'http://localhost:8025';

// Use a distinct email so this test doesn't collide with home.e2e.spec.ts
// on the (email, repo) unique constraint within the same DB session.
const VALID_REPO = 'golang/go';
const VALID_EMAIL = 'confirm-flow@example.com';
const VALID_API_KEY = 'test-api-key';

test.describe('confirm-email flow (full-stack E2E)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('clicking the confirmation link marks the subscription as confirmed', async ({
    page,
  }) => {
    // Step 1: subscribe — triggers a confirmation email sent to MailHog.
    await fillAndSubmit(page, {
      repo: VALID_REPO,
      email: VALID_EMAIL,
      apiKey: VALID_API_KEY,
    });

    await expect(page.locator('#msg')).toHaveText(
      'Subscription successful. Confirmation email sent.',
    );

    // Step 2: retrieve the confirmation token from the captured email.
    const token = await getConfirmationToken(MAILHOG_URL, VALID_EMAIL);

    // Step 3: follow the confirmation link the same way a real user would.
    await page.goto(`/api/confirm/${token}`);

    // Step 4: the API returns JSON — assert the success message is present.
    await expect(page.locator('body')).toContainText(
      'Subscription confirmed successfully.',
    );
  });
});
