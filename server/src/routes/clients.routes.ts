import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../libs/supabase.js';
import { AppError, asyncHandler } from '../libs/errors.js';
import { requireAuth, type AuthRequest } from '../middlewares/auth.js';
import { logActivity, ACTIVITY_ACTIONS } from '../services/activity.service.js';
import { createAuthUser, ensureClientRow } from '../services/user.service.js';
import type { ClientRow, UserProfile } from '../types.js';

export const clientRouter = Router();

const createClientSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  organization: z.string().max(200).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  phone: z.string().max(40).optional().or(z.literal(''))
});

const updateClientSchema = z.object({
  organization: z.string().max(200).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  phone: z.string().max(40).optional().or(z.literal('')),
  fullName: z.string().min(2).max(120).optional()
});

const statusSchema = z.object({
  status: z.enum(['active', 'pending', 'inactive'])
});

function ipOf(req: AuthRequest): string | null {
  const f = req.headers['x-forwarded-for'];
  return (Array.isArray(f) ? f[0] : f) ?? req.socket?.remoteAddress ?? null;
}

async function accessStats() {
  const { data } = await supabase.from('document_access').select('client_id');
  const perClient = new Map<string, number>();
  for (const row of data ?? []) {
    perClient.set(row.client_id, (perClient.get(row.client_id) ?? 0) + 1);
  }
  return perClient;
}

function requireAdmin(user: UserProfile | undefined) {
  if (!user || user.role !== 'admin') throw AppError.forbidden('Access denied.');
}

/** Grant an activated client access to every document in the hub (idempotent). */
async function grantAllDocumentsToClient(clientId: string, grantedById: string, ip: string | null, logLabel: string) {
  const { data: documents } = await supabase.from('documents').select('id');
  const documentIds = (documents ?? []).map((d) => d.id);
  if (documentIds.length === 0) return 0;

  const { data: existing } = await supabase
    .from('document_access')
    .select('document_id')
    .eq('client_id', clientId);
  const existingSet = new Set((existing ?? []).map((r) => r.document_id));

  const rows = documentIds
    .filter((documentId) => !existingSet.has(documentId))
    .map((documentId) => ({ document_id: documentId, client_id: clientId, granted_by: grantedById }));
  if (rows.length === 0) return 0;

  const { error } = await supabase.from('document_access').upsert(rows, { onConflict: 'document_id,client_id' });
  if (error) throw error;
  await logActivity({
    userId: grantedById,
    action: ACTIVITY_ACTIONS.CLIENT_ACCESS_GRANTED_ALL,
    metadata: { clientId, label: logLabel, documents: rows.length },
    ipAddress: ip
  });
  return rows.length;
}

/** Shared activation routine: set status/can_upload + auto-share every document. */
async function activateClient(clientRow: ClientRow, adminId: string, ip: string | null, logLabel: string) {
  await supabase.from('users').update({ status: 'active' }).eq('id', clientRow.user_id);
  await supabase.from('clients').update({ can_upload: true }).eq('id', clientRow.id);
  await grantAllDocumentsToClient(clientRow.id, adminId, ip, logLabel);
}

async function deactivateClient(clientRow: ClientRow) {
  await supabase.from('users').update({ status: 'inactive' }).eq('id', clientRow.user_id);
  await supabase.from('clients').update({ can_upload: false }).eq('id', clientRow.id);
}

async function setClientPending(clientRow: ClientRow) {
  await supabase.from('users').update({ status: 'pending' }).eq('id', clientRow.user_id);
  await supabase.from('clients').update({ can_upload: false }).eq('id', clientRow.id);
}

/** GET /api/clients - list (admin) */
clientRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    requireAdmin(req.user);
    const { data, error } = await supabase
      .from('clients')
      .select(
        `id, organization, address, phone, created_at, updated_at,
         profile:users(id, full_name, email, role, status, created_at)`
      )
      .order('created_at', { ascending: false });
    if (error) throw error;

    const accessCounts = await accessStats();
    const { data: lastLogins } = await supabase
      .from('activity_logs')
      .select('user_id, timestamp')
      .eq('action', 'login');
    const lastLoginByUser = new Map<string, string>();
    for (const row of lastLogins ?? []) {
      const current = lastLoginByUser.get(row.user_id);
      if (!current || row.timestamp > current) lastLoginByUser.set(row.user_id, row.timestamp);
    }

    const rows = (data ?? []) as unknown as Array<{
      id: string;
      organization: string | null;
      address: string | null;
      phone: string | null;
      created_at: string;
      updated_at: string;
      profile: { id: string; full_name: string; email: string; status: string } | null;
    }>;

    const items = rows.map((row) => ({
      id: row.id,
      organization: row.organization,
      address: row.address,
      phone: row.phone,
      created_at: row.created_at,
      profile: row.profile
        ? {
            id: row.profile.id,
            full_name: row.profile.full_name,
            email: row.profile.email,
            status: row.profile.status
          }
        : undefined,
      access_count: accessCounts.get(row.id) ?? 0,
      last_login: lastLoginByUser.get(row.profile?.id ?? '') ?? null
    }));
    res.json({ clients: items });
  })
);

/** GET /api/clients/:id - detail + activity history (admin) */
clientRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    requireAdmin(req.user);
    const { data: client, error } = await supabase.from('clients').select('*').eq('id', req.params.id).maybeSingle();
    if (error || !client) throw AppError.notFound('Member not found.');

    const { data: profile } = await supabase
      .from('users')
      .select('id, full_name, email, phone, status, role, created_at, updated_at')
      .eq('id', client.user_id)
      .maybeSingle();
    const { count: docCount } = await supabase
      .from('document_access')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', client.id);
    const { data: activity } = await supabase
      .from('activity_logs')
      .select('id, action, timestamp, ip_address, metadata')
      .eq('user_id', client.user_id)
      .order('timestamp', { ascending: false })
      .limit(30);

    const { data: accessRows } = await supabase
      .from('document_access')
      .select('document_id, granted_at')
      .eq('client_id', client.id);
    const documentIds = [...new Set((accessRows ?? []).map((r) => r.document_id))];
    const { data: docs } = documentIds.length
      ? await supabase.from('documents').select('id, title, version, status, file_type')
      : { data: [] };

    res.json({
      client: client as ClientRow,
      profile,
      activity: activity ?? [],
      document_ids: documentIds,
      documents: docs ?? [],
      document_count: docCount ?? 0
    });
  })
);

/** POST /api/clients - admin creates a client account */
clientRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    requireAdmin(req.user);
    const body = createClientSchema.parse(req.body ?? {});
    const account = await createAuthUser({ email: body.email, password: body.password, fullName: body.fullName });
    await supabase
      .from('users')
      .update({ full_name: body.fullName, phone: body.phone || null, status: 'active' })
      .eq('id', account.id);
    const { data: client, error } = await supabase
      .from('clients')
      .upsert(
        {
          user_id: account.id,
          organization: body.organization || null,
          address: body.address || null,
          phone: body.phone || null,
          can_upload: true
        },
        { onConflict: 'user_id' }
      )
      .select('*')
      .single();
    if (error) throw error;
    await grantAllDocumentsToClient((client as ClientRow).id, req.user?.id ?? account.id, ipOf(req), 'admin_created');
    await logActivity({
      userId: req.user?.id,
      action: ACTIVITY_ACTIONS.CLIENT_CREATED,
      metadata: { clientId: (client as ClientRow).id, email: body.email },
      ipAddress: ipOf(req)
    });
    res.status(201).json({ success: true, client });
  })
);

/** POST /api/clients/activate-all - activate every pending client at once (admin) */
clientRouter.post(
  '/activate-all',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    requireAdmin(req.user);
    const { data: pending } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'client')
      .eq('status', 'pending');
    const ids = (pending ?? []).map((u) => u.id);
    const adminId = req.user?.id ?? '';

    let grantedDocs = 0;
    if (ids.length > 0) {
      const { data: clientRows } = await supabase
        .from('clients')
        .select('*')
        .in('user_id', ids);
      for (const client of clientRows as ClientRow[]) {
        grantedDocs += await grantAllDocumentsToClient(client.id, adminId, ipOf(req), 'activate_all');
      }
      const { error } = await supabase.from('users').update({ status: 'active' }).in('id', ids);
      if (error) throw error;
      const { error: uploadError } = await supabase.from('clients').update({ can_upload: true }).in('user_id', ids);
      if (uploadError) throw uploadError;
    }
    await logActivity({
      userId: adminId,
      action: ACTIVITY_ACTIONS.CLIENT_STATUS,
      metadata: { bulk: true, count: ids.length, status: 'active', documentsGranted: grantedDocs },
      ipAddress: ipOf(req)
    });
    res.json({ success: true, activated: ids.length, documentsGranted: grantedDocs });
  })
);

/** PATCH /api/clients/:id - update profile/org info (admin) */
clientRouter.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    requireAdmin(req.user);
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();
    if (clientError || !client) throw AppError.notFound('Member not found.');
    const body = updateClientSchema.parse(req.body ?? {});

    const updates: Record<string, unknown> = {};
    if (body.organization !== undefined) updates.organization = body.organization || null;
    if (body.address !== undefined) updates.address = body.address || null;
    if (body.phone !== undefined) updates.phone = body.phone || null;
    const { data: updated, error } = await supabase.from('clients').update(updates).eq('id', client.id).select('*').single();
    if (error) throw error;

    if (body.fullName !== undefined) {
      await supabase.from('users').update({ full_name: body.fullName }).eq('id', client.user_id);
    }
    await logActivity({
      userId: req.user?.id,
      action: ACTIVITY_ACTIONS.CLIENT_UPDATED,
      metadata: { clientId: client.id },
      ipAddress: ipOf(req)
    });
    res.json({ success: true, client: updated ?? client });
  })
);

/** POST /api/clients/:id/status - activate / deactivate / pending (admin) */
clientRouter.post(
  '/:id/status',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    requireAdmin(req.user);
    const { status } = statusSchema.parse(req.body ?? {});
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();
    if (clientError || !client) throw AppError.notFound('Member not found.');
    const clientRow = client as ClientRow;

    if (status === 'active') {
      await activateClient(clientRow, req.user?.id ?? '', ipOf(req), 'single_activate');
    } else if (status === 'inactive') {
      await deactivateClient(clientRow);
    } else {
      await setClientPending(clientRow);
    }

    await logActivity({
      userId: req.user?.id,
      action: ACTIVITY_ACTIONS.CLIENT_STATUS,
      metadata: { clientId: clientRow.id, status },
      ipAddress: ipOf(req)
    });
    res.json({ success: true, message: `Member ${status === 'active' ? 'activated' : status === 'inactive' ? 'deactivated' : 'set to pending'}.` });
  })
);