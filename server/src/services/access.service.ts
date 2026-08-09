import { supabase } from '../libs/supabase.js';
import { sendEmail } from './email.service.js';
import { logActivity, ACTIVITY_ACTIONS } from './activity.service.js';
import { logError } from '../libs/logger.js';
import type { ClientRow } from '../types.js';
import { env } from '../config/env.js';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Grants document access to clients, logs the activity and sends
 * email notifications when notifications are enabled.
 */
export async function grantAccessClients(input: {
  documentId: string;
  clientIds: string[];
  grantedById: string;
  ip?: string | null;
  appName?: string;
  emailNotifications?: boolean;
}): Promise<string[]> {
  if (input.clientIds.length === 0) return [];

  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('*')
    .in('id', input.clientIds);
  if (clientsError) throw clientsError;
  if (!clients || clients.length === 0) return [];

  const appName = input.appName ?? env.APP_NAME;
  const notify = input.emailNotifications ?? true;
  const granted: string[] = [];

  const userIds = [...new Set((clients as ClientRow[]).map((c) => c.user_id))];
  const { data: userRows } = await supabase
    .from('users')
    .select('id, email, full_name')
    .in('id', userIds);
  const userById = new Map((userRows ?? []).map((u) => [u.id, u]));

  for (const client of clients as ClientRow[]) {
    const { error } = await supabase.from('document_access').upsert(
      { document_id: input.documentId, client_id: client.id, granted_by: input.grantedById },
      { onConflict: 'document_id,client_id' }
    );
    if (error) {
      logError('Access grant failed:', error.message);
      continue;
    }
    granted.push(client.id);

    await logActivity({
      userId: input.grantedById,
      documentId: input.documentId,
      action: ACTIVITY_ACTIONS.ACCESS_GRANTED,
      metadata: { clientId: client.id },
      ipAddress: input.ip ?? null
    });

    const profile = userById.get(client.user_id);
    if (profile && notify) {
      try {
        await sendEmail({
          to: profile.email,
          subject: 'You have been given access to a new document',
          html: `
            <p>Hello ${escapeHtml(profile.full_name)},</p>
            <p>You have been given access to a new document in <strong>${escapeHtml(appName)}</strong>.</p>
            <p><a href="${env.CLIENT_URL}/login">Sign in to view and download your documents.</a></p>
            <p>This link is secure - you must sign in with your account to access it.</p>
          `
        });
      } catch (err) {
        logError('Grant notification email failed:', err);
      }
    }
  }
  return granted;
}