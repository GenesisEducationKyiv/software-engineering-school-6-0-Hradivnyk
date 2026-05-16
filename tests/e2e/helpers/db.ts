import type { Client } from 'pg';

type SubscriptionTokens = {
  confirmToken: string;
  unsubscribeToken: string;
};

export async function getSubscriptionTokens(
  db: Client,
  email: string,
  repo: string,
): Promise<SubscriptionTokens> {
  const result = await db.query<{
    confirm_token: string;
    unsubscribe_token: string;
  }>(
    `SELECT confirm_token, unsubscribe_token
     FROM subscriptions
     WHERE email = $1 AND repo = $2`,
    [email, repo],
  );

  if (result.rows.length === 0) {
    throw new Error(`No subscription found for ${email} / ${repo}`);
  }

  return {
    confirmToken: result.rows[0].confirm_token,
    unsubscribeToken: result.rows[0].unsubscribe_token,
  };
}

export async function deleteSubscriptions(
  db: Client,
  email: string,
): Promise<void> {
  await db.query('DELETE FROM subscriptions WHERE email = $1', [email]);
}
