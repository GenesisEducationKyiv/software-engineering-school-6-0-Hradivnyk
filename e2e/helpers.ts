import { type Page } from '@playwright/test';

export async function fillAndSubmit(
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
