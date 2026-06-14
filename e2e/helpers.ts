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

// Polls the MailHog HTTP API until a confirmation email for `toEmail` arrives,
// then returns the 64-char hex token extracted from the confirm link.
// Throws if no matching email appears within `timeoutMs`.
export async function getConfirmationToken(
  mailhogUrl: string,
  toEmail: string,
  timeoutMs = 10_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const res = await fetch(`${mailhogUrl}/api/v2/messages`);
    const data = (await res.json()) as {
      items: Array<{
        To: Array<{ Mailbox: string; Domain: string }>;
        Content: { Body: string };
      }>;
    };

    const msg = data.items?.find((m) =>
      m.To?.some((t) => `${t.Mailbox}@${t.Domain}` === toEmail),
    );

    if (msg) {
      // Strip quoted-printable soft line breaks before matching — nodemailer
      // encodes text/plain as QP and wraps lines at 76 chars, so the 98-char
      // confirm URL is split across two lines in the raw MIME body.
      const body = msg.Content.Body.replace(/=\r?\n/g, '');
      const match = body.match(/\/api\/confirm\/([0-9a-f]{64})/);
      if (match) return match[1];
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  throw new Error(
    `No confirmation email for ${toEmail} arrived within ${timeoutMs}ms`,
  );
}
