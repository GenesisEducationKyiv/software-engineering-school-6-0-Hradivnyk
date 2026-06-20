import { z } from 'zod';

/** Request contract for POST /api/notify/confirmation. */
export const ConfirmationRequestSchema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
  repo: z.string().min(1),
});

/** Request contract for POST /api/notify/release. */
export const ReleaseRequestSchema = z.object({
  email: z.string().email(),
  repo: z.string().min(1),
  tag: z.string().min(1),
  token: z.string().min(1),
});

export type ConfirmationRequest = z.infer<typeof ConfirmationRequestSchema>;
export type ReleaseRequest = z.infer<typeof ReleaseRequestSchema>;
