import { z } from 'zod';

export const subscribeSchema = z.object({
  email: z.string().email('Invalid email format'),
  repo: z
    .string()
    .regex(
      /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/,
      'repo must be in owner/repo format (e.g., golang/go)',
    ),
});

export const tokenSchema = z.object({
  token: z.uuid('Invalid token format'),
});

export const emailQuerySchema = z.object({
  email: z.string().email('Invalid email format'),
});
