import { test, expect } from '@playwright/test';

test.describe('OpenAPI docs', () => {
  test('serves Swagger UI', async ({ page }) => {
    await page.goto('/api/docs');

    await expect(page.locator('.swagger-ui')).toBeVisible({ timeout: 30_000 });
  });
});
