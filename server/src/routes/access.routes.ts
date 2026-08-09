import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../libs/supabase.js';
import { AppError, asyncHandler } from '../libs/errors.js';
import { requireAuth, type AuthRequest } from '../middlewares/auth.js';
import { logActivity, ACTIVITY_ACTIONS } from '../services/activity.service.js';
import { grantAccessClients } from '../services/access.service.js';
import { getSettings } from '../services/settings.service.js';

export const accessRouter = Router();

const grantSchema = z.object({
  documentId: z.string().uuid(),
  clientIds: z.array(z.string().uuid()).min(1).max(400).optional(),
  grantToAll: z.boolean().optional()
});

const revokeByPairSchema = z.object({
  documentId: z.string().uuid(),
  clientId: z.string().uuid()
});

function ipOf(req: AuthRequest): string | undefined {
  const f = req.headers['x-forwarded-for'];
  return (Array.isArray(f) ? f[0] : f) ?? req.socket?.remoteAddress ?? undefined;
}

/** GET /api/access - list grants (admin), filter by ?documentId= or ?clientId= */
accessRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    if (req.user?.role !== 'admin') throw AppError.forbidden('Access denied.');
    const documentId = typeof req.query.documentId === 'string' ? req.query.documentId : '';
    const clientId = typeof req.query.clientId === 'string' ? req.query.clientId : '';

    let query = supabase
      .from('document_access')
      .select(
        `id, document_id, client_id, granted_at,
         documents:documents!document_access_document_id_fkey(id, title, status),
         clients:clients!document_access_client_id_fkey(id, user_id, organization)`
      )
      .order('granted_at', { ascending: false })
      .limit(500);
    if (documentId) query = query.eq('document_id', documentId);
    if (clientId) query = query.eq('client_id', clientId);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as unknown as Array<{
      id: string;
      document_id: string;
      client_id: string;
      granted_at: string;
      documents: { id: string; title: string; status: string } | null;
      clients: { id: string; user_id: string; organization: string | null } | null;
    }>;

    const userIds = [...new Set(rows.map((r) => r.clients?.user_id).filter(Boolean))] as string[];
    const { data: users } = userIds.length
      ? await supabase.from('users').select('id, full_name, email, status').in('id', userIds)
      : { data: [] };
    const profileById = new Map((users ?? []).map((u) => [u.id, u]));

    const items = rows.map((row) => {
      const client = row.clients;
      const profile = client ? profileById.get(client.user_id) : undefined;
      return {
        id: row.id,
        document_id: row.document_id,
        document_title: row.documents?.title ?? '(deleted document)',
        document_status: row.documents?.status ?? 'deleted',
        client_id: row.client_id,
        client_org: client?.organization ?? '',
        client_name: profile?.full_name ?? '',
        client_email: profile?.email ?? '',
        client_status: profile?.status ?? '',
        granted_at: row.granted_at
      };
    });
    res.json({ items });
  })
);

/** POST /api/access - grant one document to one or many clients (or all active clients) */
accessRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    if (req.user?.role !== 'admin') throw AppError.forbidden('Access denied.');
    const { documentId, clientIds, grantToAll } = grantSchema.parse(req.body ?? {});
    const { data: doc } = await supabase.from('documents').select('id, title').eq('id', documentId).maybeSingle();
    if (!doc) throw AppError.notFound('Document not found.');

    let targetClientIds = clientIds;
    if (grantToAll) {
      const { data: activeUsers } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'client')
        .eq('status', 'active');
      const activeUserIds = (activeUsers ?? []).map((u) => u.id);
      const { data: activeClients } = activeUserIds.length
        ? await supabase.from('clients').select('id').in('user_id', activeUserIds)
        : { data: [] };
      targetClientIds = (activeClients ?? []).map((c) => c.id);
    }

    if (!targetClientIds || targetClientIds.length === 0) {
      throw AppError.badRequest('Provide at least one client or use grantToAll.');
    }

    const settings = await getSettings();
    const granted = await grantAccessClients({
      documentId,
      clientIds: targetClientIds,
      grantedById: req.user.id,
      ip: ipOf(req),
      appName: settings.appName,
      emailNotifications: settings.emailNotifications
    });
    res.status(201).json({ success: true, granted, grantedToAll: granted.length === targetClientIds.length });
  })
);

/** DELETE /api/access/:id - revoke a single grant by its id */
accessRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    if (req.user?.role !== 'admin') throw AppError.forbidden('Access denied.');
    const { data: row } = await supabase
      .from('document_access')
      .select('id, document_id, client_id')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!row) throw AppError.notFound('Access grant not found.');

    await supabase.from('document_access').delete().eq('id', row.id);
    await logActivity({
      userId: req.user.id,
      documentId: row.document_id,
      action: ACTIVITY_ACTIONS.ACCESS_REVOKED,
      metadata: { clientId: row.client_id },
      ipAddress: ipOf(req)
    });
    res.json({ success: true, message: 'Access removed.' });
  })
);

/** DELETE /api/access - revoke by { documentId, clientId } pair */
accessRouter.delete(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    if (req.user?.role !== 'admin') throw AppError.forbidden('Access denied.');
    const { documentId, clientId } = revokeByPairSchema.parse(req.body ?? {});
    const { data: row } = await supabase
      .from('document_access')
      .select('id')
      .eq('document_id', documentId)
      .eq('client_id', clientId)
      .maybeSingle();
    if (row) {
      await supabase.from('document_access').delete().eq('id', row.id);
      await logActivity({
        userId: req.user.id,
        documentId,
        action: ACTIVITY_ACTIONS.ACCESS_REVOKED,
        metadata: { clientId },
        ipAddress: ipOf(req)
      });
    }
    res.json({ success: true, message: 'Access removed.' });
  })
);