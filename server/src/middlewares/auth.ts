import type { NextFunction, Request, Response } from 'express';
import { supabase, authSupabase } from '../libs/supabase.js';
import { AppError, asyncHandler } from '../libs/errors.js';
import type { UserProfile } from '../types.js';

export interface AuthRequest extends Request {
  user?: UserProfile;
}

export function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

export const requireAuth = asyncHandler(
  async (req: AuthRequest, _res: Response, next: NextFunction) => {
    const token = extractBearer(req);
    if (!token) throw AppError.unauthorized('Your session has expired. Please sign in again.');

    const { data, error } = await authSupabase.auth.getUser(token);
    if (error || !data.user) {
      throw AppError.unauthorized('Your session has expired. Please sign in again.');
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, full_name, email, phone, role, status, created_at')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      throw AppError.unauthorized('Access denied. Your account could not be found.');
    }
    if (profile.status !== 'active') {
      if (profile.status === 'pending') {
        throw AppError.forbidden('Your account is pending approval by an administrator.');
      }
      throw AppError.forbidden('Access denied. Your account has been deactivated.');
    }

    req.user = profile as UserProfile;
    next();
  }
);

export function requireRole(...roles: Array<'admin' | 'client'>) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(AppError.forbidden('Access denied.'));
    }
    next();
  };
}