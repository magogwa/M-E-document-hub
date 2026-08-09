import { Router } from 'express';
import { supabase } from '../libs/supabase.js';
import { AppError, asyncHandler } from '../libs/errors.js';
import { requireAuth, type AuthRequest } from '../middlewares/auth.js';
import { parsePagination } from '../libs/pagination.js';
import type { UserProfile } from '../types.js';

export const notificationRouter = Router();

function param(req: AuthRequest, key: string): string {
  const value = req.params[key];
  return typeof value === 'string' ? value : '';
}

// ============================================================================
// GET /api/notifications?page=&limit= - my notifications (newest first)
// ============================================================================
notificationRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = req.user as UserProfile;
    const { page, limit, offset } = parsePagination(req.query as Record<string, string>);

    const { data, error, count } = await supabase
      .from('notifications')
      .select(
        `id, user_id, actor_id, type, title, body, document_id, read_at, created_at,
         actor:users(id, full_name)`,
        { count: 'exact' }
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;

    const { count: unread } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null);

    res.json({ items: data ?? [], total: count ?? 0, page, limit, unread: unread ?? 0 });
  })
);

// ============================================================================
// GET /api/notifications/unread-count
// ============================================================================
notificationRouter.get(
  '/unread-count',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = req.user as UserProfile;
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null);
    if (error) throw error;
    res.json({ count: count ?? 0 });
  })
);

// ============================================================================
// POST /api/notifications/:id/read - mark one notification as read
// ============================================================================
notificationRouter.post(
  '/:id/read',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = req.user as UserProfile;
    const { data, error } = await supabase
      .from('notifications')
      .select('id')
      .eq('id', param(req, 'id'))
      .eq('user_id', user.id)
      .maybeSingle();
    if (error || !data) throw AppError.notFound('Notification not found.');

    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', data.id);
    res.json({ success: true });
  })
);

// ============================================================================
// POST /api/notifications/read-all - mark everything as read
// ============================================================================
notificationRouter.post(
  '/read-all',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = req.user as UserProfile;
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null);
    if (error) throw error;
    res.json({ success: true });
  })
);