import { Router } from 'express';
import { supabase } from '../libs/supabase.js';
import { AppError, asyncHandler } from '../libs/errors.js';
import { requireAuth, type AuthRequest } from '../middlewares/auth.js';
import { parsePagination } from '../libs/pagination.js';
import type { ActivityRow } from '../types.js';

export const activityRouter = Router();

const ACTION_VALUES = new Set([
  'login', 'logout', 'register', 'document_upload', 'document_download',
  'document_preview', 'document_delete', 'document_update', 'document_version_upload',
  'access_granted', 'access_revoked', 'client_created', 'client_updated',
  'client_status_changed', 'password_reset', 'password_changed', 'settings_updated'
]);

/** GET /api/activity?action=&userId=&page=&limit= - admin activity log */
activityRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    if (req.user?.role !== 'admin') throw AppError.forbidden('Access denied.');
    const q = req.query as Record<string, string>;
    const { page, limit, offset } = parsePagination(q);

    let query = supabase
      .from('activity_logs')
      .select(
        `id, action, timestamp, ip_address, metadata,
         user_id, profile:users!activity_logs_user_id_fkey(id, full_name, email),
         document_id, documents:documents!activity_logs_document_id_fkey(id, title)`,
        { count: 'exact' }
      );

    const action = q.action ?? '';
    if (action && ACTION_VALUES.has(action)) query = query.eq('action', action);
    if (q.userId) query = query.eq('user_id', q.userId);

    const { data, error, count } = await query
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    const rows = data as unknown as Array<{
      id: number;
      action: string;
      timestamp: string;
      ip_address: string | null;
      metadata: Record<string, unknown> | null;
      profile: { id: string; full_name: string; email: string } | null;
      documents: { id: string; title: string } | null;
    }>;
    res.json({
      items: rows.map((row) => ({
        id: row.id,
        action: row.action,
        timestamp: row.timestamp,
        ip_address: row.ip_address,
        metadata: row.metadata,
        user: row.profile ? { id: row.profile.id, full_name: row.profile.full_name, email: row.profile.email } : null,
        document: row.documents ? { id: row.documents.id, title: row.documents.title } : null
      })),
      total: count ?? 0,
      page,
      limit
    });
  })
);

/** GET /api/activity/actions - allowed action values for filter UI */
activityRouter.get(
  '/actions',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    if (req.user?.role !== 'admin') throw AppError.forbidden('Access denied.');
    res.json({ actions: [...ACTION_VALUES] });
  })
);