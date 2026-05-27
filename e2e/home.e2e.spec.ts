import { test, expect, type Page } from '@playwright/test';

const VALID_REPO = 'golang/go';
const VALID_EMAIL = 'test@example.com';
const VALID_API_KEY = 'test-api-key';

async function fillAndSubmit(
  page: Page,
  fields: { repo?: string; email?: string; apiKey?: string },
): Promise<void> {
  if (fields.repo !== undefined)
    await page.getByLabel('Repository (owner/repo)').fill(fields.repo);
  if (fields.email !== undefined)
    await page.getByLabel('Email').fill(fields.email);
  if (fields.apiKey !== undefined)
    await page.getByLabel('API Key').fill(fields.apiKey);
  await page.getByRole('button', { name: 'Subscribe' }).click();
}

// Full-stack E2E: no page.route() mock — the real /api/subscribe endpoint
// is called, which hits the real DB and email service (MailHog in Docker).
// The only thing mocked is the external GitHub API (via the github-mock
// service in docker-compose.e2e.yml), so the test has no network dependency.
test.describe('home page (full-stack E2E)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('submits to the real API and shows success message', async ({
    page,
  }) => {
    await fillAndSubmit(page, {
      repo: VALID_REPO,
      email: VALID_EMAIL,
      apiKey: VALID_API_KEY,
    });

    const msg = page.locator('#msg');
    await expect(msg).toHaveText(
      'Subscription successful. Confirmation email sent.',
    );
    await expect(msg).toHaveClass('ok');

    // Form must be reset after a successful submission
    await expect(page.getByLabel('Repository (owner/repo)')).toHaveValue('');
    await expect(page.getByLabel('Email')).toHaveValue('');
    await expect(page.getByLabel('API Key')).toHaveValue('');
  });
});
