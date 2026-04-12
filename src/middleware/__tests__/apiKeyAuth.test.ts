import type { Request, Response, NextFunction } from 'express';
import { apiKeyAuth } from '../apiKeyAuth.js';
import { UnauthorizedError } from '../../errors.js';

function mockReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

const mockRes = {} as Response;

describe('apiKeyAuth middleware', () => {
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    next = jest.fn();
  });

  describe('when API_KEY is not configured', () => {
    beforeEach(() => {
      process.env.API_KEY = '';
    });

    afterEach(() => {
      process.env.API_KEY = 'test-api-key';
    });

    it('should call next() without error when no header is provided', () => {
      apiKeyAuth(mockReq(), mockRes, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should call next() without error even with a wrong key', () => {
      apiKeyAuth(mockReq({ 'x-api-key': 'anything' }), mockRes, next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('when API_KEY is configured', () => {
    const CONFIGURED_KEY = 'test-api-key';

    beforeEach(() => {
      process.env.API_KEY = CONFIGURED_KEY;
    });

    it('should call next() when the correct key is provided', () => {
      apiKeyAuth(mockReq({ 'x-api-key': CONFIGURED_KEY }), mockRes, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should call next(UnauthorizedError) when no header is provided', () => {
      apiKeyAuth(mockReq(), mockRes, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('should call next(UnauthorizedError) when an empty string is provided', () => {
      apiKeyAuth(mockReq({ 'x-api-key': '' }), mockRes, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('should call next(UnauthorizedError) when a wrong key is provided', () => {
      apiKeyAuth(mockReq({ 'x-api-key': 'wrong-key' }), mockRes, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('should call next(UnauthorizedError) when a key of different length is provided', () => {
      apiKeyAuth(
        mockReq({ 'x-api-key': CONFIGURED_KEY + 'extra' }),
        mockRes,
        next,
      );

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('should respond with 401 status via error handler', () => {
      apiKeyAuth(mockReq({ 'x-api-key': 'bad' }), mockRes, next);

      const err = (next as jest.Mock).mock.calls[0][0] as UnauthorizedError;
      expect(err.statusCode).toBe(401);
      expect(err.message).toBe('Unauthorized');
    });
  });
});
