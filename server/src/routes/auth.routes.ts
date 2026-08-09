import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../libs/supabase.js';
import { AppError, asyncHandler } from '../libs/errors.js';
import { authLimiter } from '../middlewares/rateLimit.js';
import { requireAuth, type AuthRequest } from '../middlewares/auth.js';
import { logActivity, ACTIVITY_ACTIONS } from '../services/activity.service.js';
import { sendEmail } from '../services/email.service.js';
import { env } from '../config/env.js';
import { getSettings } from '../services/settings.service.js';
import {
  createAuthUser,
  ensureClientRow,
  findAuthUserByEmail,
  getClientByUserId,
  getProfileById,
  countAdmins
} from '../services/user.service.js';
import type { UserProfile } from '../types.js';

export const authRouter = Router();

const registerSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email().max(254),
  phone: z.string().max(40).optional().or(z.literal('')),
  password: z.string().min(8).max(128)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(256)
});

const resetSchema = z.object({
  token: z.string().min(20).max(200),
  email: z.string().email(),
  newPassword: z.string().min(8).max(128)
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(8).max(128)
});

const setupSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(120),
  password: z.string().min(8).max(128)
});

function ipFor(req: AuthRequest): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  const agent = req.socket?.remoteAddress;
  return (Array.isArray(forwarded) ? forwarded[0] : forwarded) || agent || null;
}

authRouter.post(
  '/register',
  authLimiter,
  asyncHandler(async (req: AuthRequest, res) => {
    const body = registerSchema.parse(req.body);
    const settings = await getSettings();
    if (!settings.allowClientRegistration) {
      throw AppError.forbidden('Registration is currently disabled. Contact an administrator.');
    }
    const account = await createAuthUser({ email: body.email, password: body.password, fullName: body.fullName });
    if (body.phone) {
      await supabase
        .from('users')
        .update({ full_name: body.fullName, phone: body.phone })
        .eq('id', account.id);
    }
    await ensureClientRow(account.id);
    await logActivity({
      userId: account.id,
      action: ACTIVITY_ACTIONS.REGISTER,
      ipAddress: ipFor(req)
    });
    res.status(201).json({
      success: true,
      message: 'Account created. An administrator will activate your access.'
    });
  })
);

authRouter.post(
  '/login',
  authLimiter,
  asyncHandler(async (req: AuthRequest, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session?.user) {
      throw AppError.forbidden('Invalid email or password.');
    }
    const user = data.session.user;
    await supabase.auth.signOut({ scope: 'local' });
    const profile = await getProfileById(user.id);
    if (!profile) throw AppError.forbidden('Access denied. Your account could not be found.');
    if (profile.status !== 'active') {
      if (profile.status === 'pending') {
        await supabase.auth.signOut({ scope: 'local' });
        throw AppError.forbidden('Your account is pending approval by an administrator.');
      }
      await supabase.auth.signOut({ scope: 'local' });
      throw AppError.forbidden('Access denied. Your account has been deactivated.');
    }

    const client = profile.role === 'client' ? await ensureClientRow(user.id) : null;

    await logActivity({
      userId: user.id,
      action: ACTIVITY_ACTIONS.LOGIN,
      ipAddress: ipFor(req)
    });

    res.json({
      success: true,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: Date.now() + data.session.expires_in * 1000,
      user: profile,
      client
    });
  })
);

authRouter.post(
  '/refresh',
  authLimiter,
  asyncHandler(async (req: AuthRequest, res) => {
    const schema = z.object({ refreshToken: z.string().min(10) });
    const { refreshToken } = schema.parse(req.body);
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) {
      throw AppError.unauthorized('Your session has expired. Please sign in again.');
    }
    await supabase.auth.signOut({ scope: 'local' });
    const profile = await getProfileById(data.session.user.id);
    if (!profile || profile.status !== 'active') {
      throw AppError.forbidden('Access denied. Your account is not active.');
    }
    res.json({
      success: true,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: Date.now() + data.session.expires_in * 1000,
      user: profile,
      client: profile.role === 'client' ? await getClientByUserId(profile.id) : null
    });
  })
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = req.user as UserProfile;
    res.json({
      success: true,
      user,
      client: user.role === 'client' ? await getClientByUserId(user.id) : null
    });
  })
);

authRouter.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    await logActivity({
      userId: req.user?.id,
      action: ACTIVITY_ACTIONS.LOGOUT,
      ipAddress: ipFor(req)
    });
    try {
      const token = req.headers.authorization?.slice(7);
      if (token) {
        await supabase.auth.admin.signOut(token);
      }
    } catch {
      // best-effort server-side session invalidation
    }
    res.json({ success: true });
  })
);

authRouter.post(
  '/forgot-password',
  authLimiter,
  asyncHandler(async (req: AuthRequest, res) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const account = await findAuthUserByEmail(email);
    if (!account) {
      return res.json({
        success: true,
        message: 'If that email is registered, a reset link has been sent.'
      });
    }
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await supabase.from('password_resets').insert({ token, email: account.email, expires_at: expiresAt });

    const resetUrl = `${env.CLIENT_URL}/reset-password?token=${token}&email=${encodeURIComponent(account.email)}`;
    await sendEmail({
      to: account.email,
      subject: 'Reset your password',
      html: `
        <p>You requested a password reset for <strong>${env.APP_NAME}</strong>.</p>
        <p><a href="${resetUrl}">Reset your password</a> (valid for 1 hour).</p>
        <p>If you did not request this, you can ignore this email.</p>
      `
    });

    await logActivity({
      userId: account.id,
      action: ACTIVITY_ACTIONS.PASSWORD_RESET,
      metadata: { requested: true },
      ipAddress: ipFor(req)
    });

    res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
  })
);

authRouter.post(
  '/reset-password',
  authLimiter,
  asyncHandler(async (req: AuthRequest, res) => {
    const { token, email, newPassword } = resetSchema.parse(req.body);
    const normalizedEmail = email.toLowerCase();
    const { data: resetRow, error: rowError } = await supabase
      .from('password_resets')
      .select('*')
      .eq('token', token)
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (rowError || !resetRow) throw AppError.badRequest('This reset link is invalid or has already been used.');
    if (new Date(resetRow.expires_at).getTime() < Date.now()) {
      throw AppError.badRequest('This reset link has expired. Please request a new one.');
    }

    const account = await findAuthUserByEmail(normalizedEmail);
    if (!account) throw AppError.badRequest('This reset link is invalid.');

    const { error: updateError } = await supabase.auth.admin.updateUserById(account.id, {
      password: newPassword
    });
    if (updateError) throw new Error(`Could not update password: ${updateError.message}`);

    await supabase.from('password_resets').delete().eq('token', token);
    await logActivity({
      userId: account.id,
      action: ACTIVITY_ACTIONS.PASSWORD_CHANGED,
      metadata: { viaReset: true },
      ipAddress: ipFor(req)
    });

    res.json({ success: true, message: 'Password updated. You can now sign in.' });
  })
);

authRouter.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const user = req.user as UserProfile;
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword
    });
    if (verifyError) throw AppError.forbidden('Current password is incorrect.');

    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: newPassword
    });
    if (updateError) throw new Error(`Could not update password: ${updateError.message}`);
    await logActivity({
      userId: user.id,
      action: ACTIVITY_ACTIONS.PASSWORD_CHANGED,
      metadata: { viaReset: false },
      ipAddress: ipFor(req)
    });
    res.json({ success: true, message: 'Password updated successfully.' });
  })
);

authRouter.post(
  '/setup-admin',
  authLimiter,
  asyncHandler(async (req: AuthRequest, res) => {
    const body = setupSchema.parse(req.body);
    const adminCount = await countAdmins();
    if (adminCount > 0) {
      throw AppError.forbidden('An administrator already exists.');
    }
    const account = await createAuthUser({ email: body.email, password: body.password, fullName: body.fullName });
    await supabase
      .from('users')
      .update({ role: 'admin', status: 'active', full_name: body.fullName })
      .eq('id', account.id);
    await logActivity({
      userId: account.id,
      action: 'admin_created',
      ipAddress: ipFor(req)
    });
    res.status(201).json({ success: true, message: 'Administrator account created. You can now sign in.' });
  })
);