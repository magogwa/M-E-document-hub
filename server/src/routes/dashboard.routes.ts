import { Router } from 'express';
import { supabase } from '../libs/supabase.js';
import { AppError, asyncHandler } from '../libs/errors.js';
import { requireAuth, type AuthRequest } from '../middlewares/auth.js';
import { getClientByUserId } from '../services/user.service.js';
import { getSettings } from '../services/settings.service.js';

export const dashboardRouter = Router();

interface DocLight {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  file_size: number;
  file_type: string;
  version: number;
  status: string;
  category_id: string | null;
  uploaded_by?: string;
}

const RECENT_ACTIONS = ['document_download', 'document_preview', 'document_upload', 'access_granted'];

function monthsBreakdown(rows: Array<{ created_at: string }>): Array<{ month: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = row.created_at.slice(0, 7);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const now = new Date();
  const out: Array<{ month: string; count: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    out.push({ month: key, count: counts.get(key) ?? 0 });
  }
  return out;
}

/** GET /api/dashboard/admin - admin overview: totals, trend, recent uploads/activity */
dashboardRouter.get(
  '/admin',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    if (req.user?.role !== 'admin') throw AppError.forbidden('Access denied.');

    const [docsRes, clientsRes, accessRes, activityRes, settings] = await Promise.all([
      supabase.from('documents').select('id, title, created_at, updated_at, file_size, file_type, version, status, category_id, uploaded_by'),
      supabase.from('users').select('id, status').eq('role', 'client'),
      supabase.from('document_access').select('id'),
      supabase.from('activity_logs').select('id, action, timestamp, user_id, metadata').order('timestamp', { ascending: false }).limit(60),
      getSettings()
    ]);
    if (docsRes.error) throw docsRes.error;

    const docs = (docsRes.data ?? []) as DocLight[];
    const docsActive = docs.filter((d) => d.status === 'active');

    const monthStart = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), 1)).toISOString();
    const docsThisMonth = docs.filter((d) => d.created_at >= monthStart).length;
    const storageBytes = docs.reduce((sum, d) => sum + Number(d.file_size ?? 0), 0);

    const clients = (clientsRes.data ?? []) as Array<{ status: string }>;
    const activeClients = clients.filter((c) => c.status === 'active').length;

    const uploaderIds = [...new Set(docs.map((d) => d.uploaded_by ?? '').filter(Boolean))];
    const { data: uploaders } = uploaderIds.length
      ? await supabase.from('users').select('id, full_name').in('id', uploaderIds)
      : { data: [] };
    const nameByUploaderId = new Map((uploaders ?? []).map((u) => [u.id, u.full_name ?? '']));

    const { data: categories } = await supabase.from('categories').select('id, name');
    const categoryById = new Map((categories ?? []).map((c) => [c.id, c.name ?? '']));

    const todayKey = new Date().toISOString().slice(0, 10);
    const recentActivity = (activityRes.data ?? [])
      .filter((a) => RECENT_ACTIONS.includes(a.action))
      .slice(0, 10)
      .map((a) => ({
        id: a.id,
        action: a.action,
        timestamp: a.timestamp,
        actor_name: a.user_id ? nameByUploaderId.get(a.user_id) ?? null : null
      }));

    const recentUploads = [...docsActive]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 5)
      .map((d) => ({
        id: d.id,
        title: d.title,
        file_type: d.file_type,
        version: d.version,
        created_at: d.created_at,
        uploaded_by: nameByUploaderId.get(d.uploaded_by ?? '') ?? '',
        category: d.category_id ? categoryById.get(d.category_id) ?? '' : ''
      }));

    res.json({
      totals: {
        documents: docs.length,
        activeDocuments: docsActive.length,
        clients: clients.length,
        activeClients,
        clientsThisMonth: 0,
        documentsThisMonth: docsThisMonth,
        storageBytes,
        storageLimitMB: settings.storageLimitMB,
        accessGrants: accessRes.data?.length ?? 0,
        activityToday: (activityRes.data ?? []).filter((a) => a.timestamp?.slice(0, 10) === todayKey).length
      },
      monthlyUploads: monthsBreakdown(docs),
      recentUploads: recentUploads,
      recentActivity
    });
  })
);

/** GET /api/dashboard/client - client overview: shared count, recent docs, activity stats */
dashboardRouter.get(
  '/client',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    if (req.user?.role !== 'client') throw AppError.forbidden('Access denied.');
    const client = await getClientByUserId(req.user.id);
    if (!client) throw AppError.notFound('Client profile not found.');

    const [{ data: accessRows }, activityRes] = await Promise.all([
      supabase.from('document_access').select('document_id, granted_at').eq('client_id', client.id),
      supabase
        .from('activity_logs')
        .select('action, timestamp')
        .eq('user_id', req.user.id)
        .in('action', ['document_download', 'document_preview'])
        .order('timestamp', { ascending: false })
        .limit(500)
    ]);

    const documentIds = [...new Set((accessRows ?? []).map((r) => r.document_id))];
    const { data: docs } = documentIds.length
      ? await supabase
          .from('documents')
          .select('id, title, description, file_size, file_type, version, created_at, updated_at, category_id, categories(name)')
          .in('id', documentIds)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(15)
      : { data: [] };

    const lastGranted = (accessRows ?? []).reduce((max, r) => (r.granted_at > max ? r.granted_at : max), '');
    const byAction = (activityRes.data ?? []).reduce<Record<string, number>>((acc, row) => {
      acc[row.action] = (acc[row.action] ?? 0) + 1;
      return acc;
    }, {});

    res.json({
      totals: {
        sharedDocuments: documentIds.length,
        downloads: byAction['document_download'] ?? 0,
        previews: byAction['document_preview'] ?? 0,
        lastShareAt: lastGranted || null,
        storageMB: (docs ?? []).reduce((sum, d) => sum + Number(d.file_size ?? 0), 0) / (1024 * 1024)
      },
      recentDocuments: docs ?? [],
      categories: [
        ...new Set(
          ((docs ?? []) as unknown as Array<{ categories: { name: string } | null }>)
            .map((d) => d.categories?.name ?? '')
            .filter(Boolean)
        )
      ]
    });
  })
);