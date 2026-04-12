import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { UnauthorizedError } from '../errors.js';

export function apiKeyAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const configuredKey = process.env.API_KEY ?? '';

  if (!configuredKey) {
    next();
    return;
  }

  const provided = req.headers['x-api-key'];

  if (typeof provided !== 'string' || provided.length === 0) {
    next(new UnauthorizedError());
    return;
  }

  const configuredBuf = Buffer.from(configuredKey);
  const providedBuf = Buffer.from(provided);

  if (
    configuredBuf.length !== providedBuf.length ||
    !timingSafeEqual(configuredBuf, providedBuf)
  ) {
    next(new UnauthorizedError());
    return;
  }

  next();
}
