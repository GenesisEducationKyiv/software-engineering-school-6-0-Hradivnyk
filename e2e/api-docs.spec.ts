import { test, expect } from '@playwright/test';

test.describe('OpenAPI docs', () => {
  test('serves Swagger UI', async ({ page }) => {
    await page.goto('/api/docs');

    await expect(
      page.getByRole('heading', { name: /GitHub Release Notification API/i }),
    ).toBeVisible();
  });
});
