import { supabase } from '../libs/supabase.js';
import type { ActivityRow } from '../types.js';
import { logError } from '../libs/logger.js';

export const ACTIVITY_ACTIONS = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  REGISTER: 'register',
  UPLOAD: 'document_upload',
  DOWNLOAD: 'document_download',
  PREVIEW: 'document_preview',
  DELETE: 'document_delete',
  UPDATE: 'document_update',
  VERSION_UPLOAD: 'document_version_upload',
  ACCESS_GRANTED: 'access_granted',
  ACCESS_REVOKED: 'access_revoked',
  CLIENT_CREATED: 'client_created',
  CLIENT_UPDATED: 'client_updated',
  CLIENT_STATUS: 'client_status_changed',
  PASSWORD_RESET: 'password_reset',
  PASSWORD_CHANGED: 'password_changed',
  SETTINGS_UPDATED: 'settings_updated'
} as const;

export async function logActivity(input: {
  userId?: string | null;
  documentId?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    await supabase.from('activity_logs').insert({
      user_id: input.userId ?? null,
      document_id: input.documentId ?? null,
      action: input.action,
      metadata: input.metadata ?? {},
      ip_address: input.ipAddress ?? null
    });
  } catch (err) {
    logError('Failed to write activity log:', err);
  }
}

export async function listActivity(input: {
  page: number;
  limit: number;
  offset: number;
  action?: string;
  userId?: string;
  search?: string;
}) {
  let query = supabase
    .from('activity_logs')
    .select(
      `id, action, timestamp, ip_address, metadata,
       user_id, users:users!activity_logs_user_id_fkey(id, full_name, email, role),
       document_id, documents:documents!activity_logs_document_id_fkey(id, title)`,
      { count: 'exact' }
    );

  if (input.action) query = query.eq('action', input.action);
  if (input.userId) query = query.eq('user_id', input.userId);

  const { data, error, count } = await query
    .order('timestamp', { ascending: false })
    .range(input.offset, input.offset + input.limit - 1);

  if (error) throw error;
  return { rows: data as unknown as ActivityRow[], total: count ?? 0 };
}