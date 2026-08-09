import { supabase } from '../libs/supabase.js';
import { logError } from '../libs/logger.js';

export const NOTIFICATION_TYPES = {
  DOCUMENT_UPLOAD: 'document_upload'
} as const;

/**
 * Create one notification per recipient in a single batch.
 * Never throws - notification failures are logged and must not break the main flow.
 */
export async function notifyUsers(input: {
  userIds: string[];
  actorId: string;
  type: string;
  title: string;
  body?: string | null;
  documentId?: string | null;
}): Promise<void> {
  const batch = input.userIds.filter((id) => id && id !== input.actorId);
  if (batch.length === 0) return;

  const rows = batch.map((userId) => ({
    user_id: userId,
    actor_id: input.actorId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    document_id: input.documentId ?? null
  }));

  try {
    const { error } = await supabase.from('notifications').insert(rows);
    if (error) logError('Could not create notifications:', error.message);
  } catch (err) {
    logError('Could not create notifications:', err);
  }
}

/** Notify every active user (except the uploader) that a document was uploaded. */
export async function notifyDocumentUpload(input: {
  actorId: string;
  actorName: string;
  documentId: string;
  documentTitle: string;
}): Promise<void> {
  const { data, error } = await supabase.from('users').select('id').eq('status', 'active');
  if (error) {
    logError('Could not load recipients for upload notification:', error.message);
    return;
  }
  const recipientIds = (data ?? []).map((u) => u.id);
  await notifyUsers({
    userIds: recipientIds,
    actorId: input.actorId,
    type: NOTIFICATION_TYPES.DOCUMENT_UPLOAD,
    title: 'New document uploaded',
    body: `"${input.documentTitle}" was uploaded by ${input.actorName}.`,
    documentId: input.documentId
  });
}