import { test, expect, type Page } from '@playwright/test';
import { fillAndSubmit } from './helpers.js';

const VALID_REPO = 'golang/go';
const VALID_EMAIL = 'test@example.com';
const VALID_API_KEY = 'test-api-key';

async function mockSubscribe(
  page: Page,
  status: number,
  body: Record<string, string>,
): Promise<void> {
  await page.route('**/api/subscribe', async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

test.describe('home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads subscription form', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Subscribe to GitHub Releases' }),
    ).toBeVisible();
    await expect(page.getByLabel('Repository (owner/repo)')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Subscribe' })).toBeVisible();
  });

  test.describe('browser validation', () => {
    test('does not submit when repo is empty', async ({ page }) => {
      await fillAndSubmit(page, { email: VALID_EMAIL });
      await expect(page.locator('#msg')).toBeEmpty();
    });

    test('does not submit when email is empty', async ({ page }) => {
      await fillAndSubmit(page, { repo: VALID_REPO });
      await expect(page.locator('#msg')).toBeEmpty();
    });
  });

  test.describe('successful subscription', () => {
    // UI-only: verifies that the JS correctly reads data.message and applies
    // the .ok class — independent of the backend response format.
    test('shows success message and resets form (UI mock)', async ({
      page,
    }) => {
      await mockSubscribe(page, 200, {
        message: 'Subscription successful. Confirmation email sent.',
      });

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

      await expect(page.getByLabel('Repository (owner/repo)')).toHaveValue('');
      await expect(page.getByLabel('Email')).toHaveValue('');
      await expect(page.getByLabel('API Key')).toHaveValue('');
    });
  });

  test.describe('server errors', () => {
    test('shows error on invalid repo format (400)', async ({ page }) => {
      await mockSubscribe(page, 400, { error: 'Invalid repository format' });

      await fillAndSubmit(page, {
        repo: 'notarepo',
        email: VALID_EMAIL,
        apiKey: VALID_API_KEY,
      });

      const msg = page.locator('#msg');
      await expect(msg).toHaveText('Invalid repository format');
      await expect(msg).toHaveClass('err');
    });

    test('shows error when repo does not exist (404)', async ({ page }) => {
      await mockSubscribe(page, 404, {
        error: `Repository not found: ${VALID_REPO}`,
      });

      await fillAndSubmit(page, {
        repo: VALID_REPO,
        email: VALID_EMAIL,
        apiKey: VALID_API_KEY,
      });

      const msg = page.locator('#msg');
      await expect(msg).toContainText('Repository not found');
      await expect(msg).toHaveClass('err');
    });

    test('shows error on duplicate subscription (409)', async ({ page }) => {
      await mockSubscribe(page, 409, {
        error: `Email ${VALID_EMAIL} is already subscribed to ${VALID_REPO}`,
      });

      await fillAndSubmit(page, {
        repo: VALID_REPO,
        email: VALID_EMAIL,
        apiKey: VALID_API_KEY,
      });

      const msg = page.locator('#msg');
      await expect(msg).toContainText('already subscribed');
      await expect(msg).toHaveClass('err');
    });

    test('shows error on missing or invalid API key (401)', async ({
      page,
    }) => {
      await mockSubscribe(page, 401, { error: 'Unauthorized' });

      await fillAndSubmit(page, {
        repo: VALID_REPO,
        email: VALID_EMAIL,
        apiKey: 'wrong-key',
      });

      const msg = page.locator('#msg');
      await expect(msg).toHaveText('Unauthorized');
      await expect(msg).toHaveClass('err');
    });

    test('shows fallback message on network failure', async ({ page }) => {
      await page.route('**/api/subscribe', async (route) => {
        await route.abort();
      });

      await fillAndSubmit(page, {
        repo: VALID_REPO,
        email: VALID_EMAIL,
        apiKey: VALID_API_KEY,
      });

      const msg = page.locator('#msg');
      await expect(msg).toHaveText('Network error. Please try again.');
      await expect(msg).toHaveClass('err');
    });
  });
});
