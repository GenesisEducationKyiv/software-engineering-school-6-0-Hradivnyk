import { test, expect } from '@playwright/test';

test.describe('home page', () => {
  test('loads subscription form', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: 'Subscribe to GitHub Releases' }),
    ).toBeVisible();

    await expect(page.getByLabel('Repository (owner/repo)')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Subscribe' })).toBeVisible();
  });
});
