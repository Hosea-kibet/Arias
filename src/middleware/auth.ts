import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { AppError } from '../errors.js';

export function requireApiKey(apiKey: string) {
  const expected = Buffer.from(`Bearer ${apiKey}`);
  return async (request: FastifyRequest) => {
    const actual = Buffer.from(request.headers.authorization ?? '');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new AppError(401, 'Invalid or missing API key');
    }
  };
}
