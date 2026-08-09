import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../libs/errors.js';
import { logError } from '../libs/logger.js';
import { env } from '../config/env.js';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ message: 'Endpoint not found.' });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      message: err.message,
      code: err.code,
      success: false
    });
  }

  if (err instanceof ZodError) {
    const first = err.issues[0];
    const message = first
      ? `${first.path.join('.') || 'Value'}: ${first.message}`
      : 'Invalid input provided.';
    return res.status(400).json({ message, code: 'VALIDATION_ERROR', success: false });
  }

  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code: unknown }).code);
    if (code === 'PGRST301' || code === 'PGRST116') {
      return res.status(404).json({ message: 'Not found.', code: 'NOT_FOUND', success: false });
    }
    if (code === '23505') {
      return res.status(409).json({ message: 'A record with that value already exists.', code: 'CONFLICT', success: false });
    }
  }

  if (err instanceof Error && (err as { type?: string }).type === 'entity.too.large') {
    return res.status(413).json({ message: 'Unable to upload document. Request body is too large.', code: 'PAYLOAD_TOO_LARGE', success: false });
  }

  logError('Unhandled error:', err);
  const message =
    env.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Please try again.'
      : err instanceof Error
        ? err.message
        : String(err);
  res.status(500).json({ message, code: 'INTERNAL_ERROR', success: false });
}