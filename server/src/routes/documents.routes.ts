import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../libs/supabase.js';
import { AppError, asyncHandler } from '../libs/errors.js';
import { requireAuth, type AuthRequest } from '../middlewares/auth.js';
import { uploadLimiter } from '../middlewares/rateLimit.js';
import { env } from '../config/env.js';
import { validateFile } from '../libs/validation.js';
import { parsePagination } from '../libs/pagination.js';
import { logActivity, ACTIVITY_ACTIONS } from '../services/activity.service.js';
import { getClientByUserId } from '../services/user.service.js';
import { getSettings } from '../services/settings.service.js';
import { buildObjectPath, createSignedUrl, uploadFile, deleteFiles } from '../services/storage.service.js';
import { sendEmail } from '../services/email.service.js';
import { notifyDocumentUpload } from '../services/notifications.service.js';
import { logError } from '../libs/logger.js';
import type { ClientRow, DocumentRow, DocumentVersion, UserProfile } from '../types.js';

export const documentRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024,
    files: 1,
    fields: 60
  }
});

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  csv: 'text/csv',
  txt: 'text/plain'
};

function mimeFromExtension(ext: string): string {
  return MIME_BY_EXT[ext.toLowerCase()] ?? `application/${ext.toLowerCase()}`;
}

const createSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(5000).trim().optional().or(z.literal('')),
  categoryId: z.string().uuid().nullable().optional(),
  clientIds: z.array(z.string().uuid()).max(500).optional(),
  status: z.enum(['active', 'archived']).optional()
});

const updateSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(5000).trim().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  status: z.enum(['active', 'archived']).optional()
});

const SORTABLE = new Set(['created_at', 'updated_at', 'title', 'file_size', 'version', 'status']);

function ipOf(req: AuthRequest): string | null {
  const f = req.headers['x-forwarded-for'];
  return (Array.isArray(f) ? f[0] : f) ?? req.socket?.remoteAddress ?? null;
}

function param(req: AuthRequest, key: string): string {
  const value = req.params[key];
  return typeof value === 'string' ? value : '';
}

function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function splitIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(isUuid);
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((s) => s.trim()).filter(isUuid);
  }
  return [];
}

function escapeForLike(value: string): string {
  return value.replace(/[%_\\]/g, '');
}

async function capacityCheck(additionalBytes: number) {
  const settings = await getSettings();
  if (!settings.storageLimitMB || settings.storageLimitMB <= 0) return;
  const { data, error } = await supabase.from('documents').select('file_size').eq('status', 'active');
  if (error) throw error;
  const used = (data ?? []).reduce((sum, row) => sum + Number(row.file_size ?? 0), 0);
  if (used + additionalBytes > settings.storageLimitMB * 1024 * 1024) {
    throw AppError.badRequest('Storage limit reached. Delete some documents or increase the limit in Settings.');
  }
}

async function findDocument(id: string): Promise<DocumentRow> {
  const { data, error } = await supabase.from('documents').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw AppError.notFound('Document not found.');
  return data as DocumentRow;
}

async function clientOfUser(user: UserProfile): Promise<ClientRow | null> {
  return getClientByUserId(user.id);
}

async function readableByUser(user: UserProfile, document: DocumentRow): Promise<boolean> {
  if (user.role === 'admin') return true;
  const client = await clientOfUser(user);
  if (!client) return false;
  const { data, error } = await supabase
    .from('document_access')
    .select('id')
    .eq('document_id', document.id)
    .eq('client_id', client.id)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function accessibleDocumentIds(user: UserProfile): Promise<string[] | null> {
  if (user.role === 'admin') return null;
  const client = await clientOfUser(user);
  if (!client) return null;
  const { data, error } = await supabase.from('document_access').select('document_id').eq('client_id', client.id);
  if (error) throw error;
  return (data ?? []).map((row) => row.document_id);
}

async function grantDocumentAccess(documentId: string, clientIds: string[], grantedById: string, ip: string | null) {
  if (clientIds.length === 0) return;
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('*')
    .in('id', clientIds);
  if (clientsError) throw clientsError;
  if (!clients || clients.length === 0) return;

  const settings = await getSettings();
  const grantedClientIds: string[] = [];
  const { data: userIds } = await supabase
    .from('users')
    .select('id, email, full_name')
    .in(
      'id',
      (clients as ClientRow[]).map((c) => c.user_id)
    );

  const userById = new Map((userIds ?? []).map((u) => [u.id, u]));

  for (const client of clients as ClientRow[]) {
    const { error } = await supabase.from('document_access').upsert(
      { document_id: documentId, client_id: client.id, granted_by: grantedById },
      { onConflict: 'document_id,client_id' }
    );
    if (error) {
      logError('Access grant failed:', error.message);
      continue;
    }
    grantedClientIds.push(client.id);
    await logActivity({
      userId: grantedById,
      documentId,
      action: ACTIVITY_ACTIONS.ACCESS_GRANTED,
      metadata: { clientId: client.id },
      ipAddress: ip
    });

    const profile = userById.get(client.user_id);
    if (profile && settings.emailNotifications) {
      try {
        await sendEmail({
          to: profile.email,
          subject: 'You have been given access to a new document',
          html: `
            <p>Hello ${escapeHtml(profile.full_name)},</p>
            <p>You have been given access to a new document in <strong>${escapeHtml(settings.appName)}</strong>.</p>
            <p><a href="${env.CLIENT_URL}/login">Sign in to view and download your documents.</a></p>
            <p>This link is secure - you must sign in with your account to access it.</p>
          `
        });
      } catch (err) {
        logError('Grant notification email failed:', err);
      }
    }
  }
  return grantedClientIds;
}

// ============================================================================
// POST /api/documents/upload  (multipart: file + json fields)
// ============================================================================
documentRouter.post(
  '/upload',
  requireAuth,
  uploadLimiter,
  upload.single('file'),
  asyncHandler(async (req: AuthRequest, res) => {
    const user = req.user as UserProfile;

    const meta = createSchema.parse({
      title: req.body?.title ?? req.body?.json_title,
      description: req.body?.description ?? '',
      categoryId: req.body?.categoryId ? String(req.body.categoryId) : null,
      clientIds: splitIds(req.body?.clientIds),
      status: req.body?.status
    });

    if (!req.file || req.file.buffer.length === 0) {
      throw AppError.badRequest('No file was uploaded. Please select a file to upload.');
    }

    const validated = await validateFile(req.file.buffer, req.file.originalname);

    let categoryId: string | null = null;
    if (isUuid(meta.categoryId)) {
      const { data: cat } = await supabase.from('categories').select('id').eq('id', meta.categoryId).maybeSingle();
      if (cat) categoryId = meta.categoryId;
    }

    const documentId = randomUUID();
    const objectPath = buildObjectPath({ documentId, version: 1, fileName: validated.fileName });

    await capacityCheck(validated.size);
    await uploadFile(req.file.buffer, objectPath, validated.mime);

    let clientIds: string[] = [];
    if (user.role === 'admin') {
      clientIds = meta.clientIds ?? [];
    }
    if (clientIds.length === 0) {
      const { data: activeUsers } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'client')
        .eq('status', 'active');
      const activeUserIds = (activeUsers ?? []).map((u) => u.id);
      const { data: activeClients } = activeUserIds.length
        ? await supabase.from('clients').select('id').in('user_id', activeUserIds)
        : { data: [] };
      clientIds = (activeClients ?? []).map((c) => c.id);
    }

    const { data: document, error: insertError } = await supabase
      .from('documents')
      .insert({
        id: documentId,
        title: meta.title,
        description: meta.description || null,
        file_name: validated.fileName,
        file_url: objectPath,
        file_type: validated.mime,
        file_size: validated.size,
        category_id: categoryId,
        uploaded_by: user.id,
        version: 1,
        status: user.role === 'client' ? 'active' : (meta.status ?? 'active')
      })
      .select('*')
      .single();

    if (insertError) {
      await deleteFiles([objectPath]);
      throw new Error(`Could not save document: ${insertError.message}`);
    }

    await supabase.from('document_versions').insert({
      document_id: documentId,
      version: 1,
      file_name: validated.fileName,
      file_url: objectPath,
      file_type: validated.mime,
      file_size: validated.size,
      uploaded_by: user.id
    });

    await logActivity({
      userId: user.id,
      documentId,
      action: ACTIVITY_ACTIONS.UPLOAD,
      metadata: { version: 1, size: validated.size },
      ipAddress: ipOf(req)
    });

    if (clientIds.length > 0) {
      await grantDocumentAccess(documentId, clientIds, user.id, ipOf(req));
    }

    await notifyDocumentUpload({
      actorId: user.id,
      actorName: user.full_name,
      documentId,
      documentTitle: meta.title
    });

    res.status(201).json({ success: true, document, clientIds });
  })
);

// ============================================================================
// GET /api/documents?search=&categoryId=&fileType=&clientId=&status=&startDate=&endDate=&sortBy=&order=&page=&limit=
// ============================================================================
documentRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = req.user as UserProfile;
    const q = req.query as Record<string, string>;
    const { page, limit, offset } = parsePagination(q);

    const search = (q.search ?? '').trim();
    const categoryId = q.categoryId?.trim() || '';
    const fileType = q.fileType?.trim() || '';
    const statusFilter = q.status === 'archived' ? 'archived' : 'active';
    const startDate = q.startDate?.trim() || '';
    const endDate = q.endDate?.trim() || '';
    const clientFilter = q.clientId?.trim() || '';
    const sortBy = SORTABLE.has(q.sortBy ?? '') ? (q.sortBy as string) : 'created_at';
    const ascending = q.order === 'asc';

    const accessibleIds = await accessibleDocumentIds(user);

    let query = supabase
      .from('documents')
      .select(
        `id, title, description, file_name, file_type, file_size, version, status,
         created_at, updated_at, category_id, categories(id, name),
         uploader:users!documents_uploaded_by_fkey(full_name, email)`,
        { count: 'exact' }
      )
      .eq('status', statusFilter);

    if (user.role === 'client') {
      if (!accessibleIds || accessibleIds.length === 0) {
        return res.json({ items: [], total: 0, page, limit });
      }
      query = query.in('id', accessibleIds.slice(0, 2000));
    }

    if (search) {
      const term = escapeForLike(search);
      query = query.or(
        `title.ilike.%${term}%,file_name.ilike.%${term}%,description.ilike.%${term}%`
      );
    }
    if (categoryId) query = query.eq('category_id', categoryId);
    if (fileType) query = query.eq('file_type', mimeFromExtension(fileType));

    if (clientFilter && user.role === 'admin') {
      const { data: accessRows } = await supabase
        .from('document_access')
        .select('document_id')
        .eq('client_id', clientFilter);
      if (!accessRows || accessRows.length === 0) {
        return res.json({ items: [], total: 0, page, limit });
      }
      query = query.in(
        'id',
        accessRows.map((r) => r.document_id)
      );
    }

    if (startDate) query = query.gte('created_at', `${startDate}T00:00:00`);
    if (endDate) query = query.lte('created_at', `${endDate}T23:59:59`);

    const { data, error, count } = await query
      .order(sortBy, { ascending })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    res.json({ items: data ?? [], total: count ?? 0, page, limit });
  })
);

// ============================================================================
// GET /api/documents/:id
// ============================================================================
documentRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = req.user as UserProfile;
    const document = await findDocument(param(req, 'id'));
    if (!(await readableByUser(user, document))) {
      throw AppError.forbidden('Access denied. This document is not shared with you.');
    }

    const [{ data: category }, { data: versions }, { data: access }] = await Promise.all([
      document.category_id
        ? supabase.from('categories').select('id, name').eq('id', document.category_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('document_versions').select('*').eq('document_id', document.id).order('version', { ascending: false }),
      user.role === 'admin'
        ? supabase.from('document_access').select('*').eq('document_id', document.id)
        : Promise.resolve({ data: [] })
    ]);

    let accessList: Array<Record<string, unknown>> = [];
    if (user.role === 'admin' && access?.length) {
      const { data: clients } = await supabase
        .from('clients')
        .select('id, user_id, organization, phone')
        .in('id', (access as Array<{ client_id: string }>).map((a) => a.client_id));
      const { data: profiles } = await supabase
        .from('users')
        .select('id, full_name, email')
        .in('id', (clients ?? []).map((c) => c.user_id));
      const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
      accessList = (access as Array<Record<string, unknown>>).map((row) => {
        const client = (clients ?? []).find((c) => c.id === row.client_id);
        const profile = client ? profileById.get(client.user_id) : undefined;
        return { ...row, client_org: client?.organization ?? '', client_name: profile?.full_name ?? '', client_email: profile?.email ?? '' };
      });
    }

    res.json({ document, category, versions: versions ?? [], access: accessList });
  })
);

// ============================================================================
// PATCH /api/documents/:id  (metadata)
// ============================================================================
documentRouter.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = req.user as UserProfile;
    if (user.role !== 'admin') throw AppError.forbidden('Access denied.');
    const document = await findDocument(param(req, 'id'));
    const body = updateSchema.parse(req.body ?? {});

    let categoryId: string | null = document.category_id;
    if (body.categoryId && isUuid(body.categoryId) && body.categoryId !== document.category_id) {
      const { data: cat } = await supabase.from('categories').select('id').eq('id', body.categoryId).maybeSingle();
      if (cat) categoryId = body.categoryId;
    }

    const { data: updated, error } = await supabase
      .from('documents')
      .update({
        title: body.title ?? document.title,
        description: body.description !== undefined ? body.description || null : document.description,
        category_id: categoryId,
        status: body.status ?? document.status
      })
      .eq('id', document.id)
      .select('*')
      .single();
    if (error) throw error;
    await logActivity({
      userId: user.id,
      documentId: document.id,
      action: ACTIVITY_ACTIONS.UPDATE,
      metadata: { changed: Object.keys(body) },
      ipAddress: ipOf(req)
    });
    res.json({ success: true, document: updated });
  })
);

// ============================================================================
// DELETE /api/documents/:id
// ============================================================================
documentRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = req.user as UserProfile;
    if (user.role !== 'admin') throw AppError.forbidden('Access denied.');
    const document = await findDocument(param(req, 'id'));

    const pathsToDelete = [document.file_url];
    const { data: versions } = await supabase.from('document_versions').select('file_url').eq('document_id', document.id);
    for (const v of versions ?? []) pathsToDelete.push(v.file_url);
    await deleteFiles([...new Set(pathsToDelete)]);

    await supabase.from('document_versions').delete().eq('document_id', document.id);
    await supabase.from('document_access').delete().eq('document_id', document.id);
    await supabase.from('documents').delete().eq('id', document.id);

    await logActivity({
      userId: user.id,
      documentId: document.id,
      action: ACTIVITY_ACTIONS.DELETE,
      metadata: { title: document.title },
      ipAddress: ipOf(req)
    });
    res.json({ success: true, message: 'Document deleted.' });
  })
);

// ============================================================================
// POST /api/documents/:id/versions - upload a new version (admin only)
// ============================================================================
documentRouter.post(
  '/:id/versions',
  requireAuth,
  uploadLimiter,
  upload.single('file'),
  asyncHandler(async (req: AuthRequest, res) => {
    const user = req.user as UserProfile;
    if (user.role !== 'admin') throw AppError.forbidden('Access denied.');
    const document = await findDocument(param(req, 'id'));
    if (!req.file || req.file.buffer.length === 0) {
      throw AppError.badRequest('No file was uploaded. Please select a file.');
    }

    const validated = await validateFile(req.file.buffer, req.file.originalname);
    await capacityCheck(validated.size);

    const nextVersion = document.version + 1;
    const objectPath = buildObjectPath({ documentId: document.id, version: nextVersion, fileName: validated.fileName });

    await uploadFile(req.file.buffer, objectPath, validated.mime);

    await supabase.from('document_versions').insert({
      document_id: document.id,
      version: document.version,
      file_name: document.file_name,
      file_url: document.file_url,
      file_type: document.file_type,
      file_size: document.file_size,
      uploaded_by: document.uploaded_by
    });

    const { data: updated, error } = await supabase
      .from('documents')
      .update({
        file_name: validated.fileName,
        file_url: objectPath,
        file_type: validated.mime,
        file_size: validated.size,
        version: nextVersion
      })
      .eq('id', document.id)
      .select('*')
      .single();
    if (error) {
      await deleteFiles([objectPath]);
      throw new Error(`Could not update document: ${error.message}`);
    }

    await logActivity({
      userId: user.id,
      documentId: document.id,
      action: ACTIVITY_ACTIONS.VERSION_UPLOAD,
      metadata: { version: nextVersion, size: validated.size },
      ipAddress: ipOf(req)
    });
    res.json({ success: true, document: updated });
  })
);

// ============================================================================
// GET /api/documents/:id/download  and  GET /api/documents/:id/preview
// ============================================================================
async function signedUrlFor(user: UserProfile, document: DocumentRow, req: AuthRequest, action: string, expires: number, download = false) {
  if (!(await readableByUser(user, document))) {
    throw AppError.forbidden('Access denied. This document is not shared with you.');
  }
  const signedUrl = await createSignedUrl(document.file_url, expires, download);
  await logActivity({
    userId: user.id,
    documentId: document.id,
    action,
    metadata: { fileName: document.file_name },
    ipAddress: ipOf(req)
  });
  return signedUrl;
}

documentRouter.get(
  '/:id/download',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = req.user as UserProfile;
    const document = await findDocument(param(req, 'id'));
    const signedUrl = await signedUrlFor(user, document, req, ACTIVITY_ACTIONS.DOWNLOAD, 900, true);
    res.json({ success: true, signedUrl, fileName: document.file_name, fileType: document.file_type });
  })
);

documentRouter.get(
  '/:id/preview',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = req.user as UserProfile;
    const document = await findDocument(param(req, 'id'));
    const signedUrl = await signedUrlFor(user, document, req, ACTIVITY_ACTIONS.PREVIEW, 300);
    res.json({ success: true, signedUrl, fileName: document.file_name, fileType: document.file_type, size: document.file_size });
  })
);

// ============================================================================
// GET /api/documents/:id/versions/:versionId - previous version download
// ============================================================================
documentRouter.get(
  '/:id/versions/:versionId',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = req.user as UserProfile;
    const document = await findDocument(param(req, 'id'));
    if (!(await readableByUser(user, document))) {
      throw AppError.forbidden('Access denied. This document is not shared with you.');
    }
    const { data: version, error } = await supabase
      .from('document_versions')
      .select('*')
      .eq('id', param(req, 'versionId'))
      .eq('document_id', document.id)
      .maybeSingle();
    if (error || !version) throw AppError.notFound('Version not found.');

    const signedUrl = await createSignedUrl((version as DocumentVersion).file_url, 900, true);
    await logActivity({
      userId: user.id,
      documentId: document.id,
      action: ACTIVITY_ACTIONS.DOWNLOAD,
      metadata: { fileName: (version as DocumentVersion).file_name, version: (version as DocumentVersion).version },
      ipAddress: ipOf(req)
    });
    res.json({ success: true, signedUrl, fileName: (version as DocumentVersion).file_name });
  })
);

// ============================================================================
// DOCUMENT COMMENTS - anyone with access to the document can comment
// ============================================================================
const commentSchema = z.object({
  content: z.string().min(1).max(2000).trim()
});

documentRouter.get(
  '/:id/comments',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = req.user as UserProfile;
    const document = await findDocument(param(req, 'id'));
    if (!(await readableByUser(user, document))) {
      throw AppError.forbidden('Access denied. This document is not shared with you.');
    }

    const { data, error } = await supabase
      .from('document_comments')
      .select(`id, content, created_at, user_id, author:users(id, full_name, email, role)`)
      .eq('document_id', document.id)
      .order('created_at', { ascending: true })
      .limit(500);
    if (error) throw error;
    res.json({ items: data ?? [] });
  })
);

documentRouter.post(
  '/:id/comments',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = req.user as UserProfile;
    const document = await findDocument(param(req, 'id'));
    if (!(await readableByUser(user, document))) {
      throw AppError.forbidden('Access denied. This document is not shared with you.');
    }
    const { content } = commentSchema.parse(req.body ?? {});

    const { data: comment, error } = await supabase
      .from('document_comments')
      .insert({ document_id: document.id, user_id: user.id, content })
      .select(`id, content, created_at, user_id, author:users(id, full_name, email, role)`)
      .single();
    if (error) throw error;

    await logActivity({
      userId: user.id,
      documentId: document.id,
      action: ACTIVITY_ACTIONS.COMMENT_ADDED,
      metadata: { commentId: (comment as Record<string, unknown>).id },
      ipAddress: ipOf(req)
    });
    res.status(201).json({ success: true, comment });
  })
);

documentRouter.delete(
  '/:id/comments/:commentId',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = req.user as UserProfile;
    const document = await findDocument(param(req, 'id'));
    if (!(await readableByUser(user, document))) {
      throw AppError.forbidden('Access denied. This document is not shared with you.');
    }

    const { data: comment, error: findError } = await supabase
      .from('document_comments')
      .select('id, user_id')
      .eq('id', param(req, 'commentId'))
      .eq('document_id', document.id)
      .maybeSingle();
    if (findError || !comment) throw AppError.notFound('Comment not found.');

    if (user.role !== 'admin' && comment.user_id !== user.id) {
      throw AppError.forbidden('You can only delete your own comments.');
    }
    await supabase.from('document_comments').delete().eq('id', comment.id);

    await logActivity({
      userId: user.id,
      documentId: document.id,
      action: ACTIVITY_ACTIONS.COMMENT_DELETED,
      metadata: { commentId: comment.id },
      ipAddress: ipOf(req)
    });
    res.json({ success: true, message: 'Comment deleted.' });
  })
);