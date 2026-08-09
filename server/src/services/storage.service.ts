import { supabase } from '../libs/supabase.js';
import { env } from '../config/env.js';
import { AppError } from '../libs/errors.js';
import { logError } from '../libs/logger.js';

export const BUCKET = env.BUCKET_NAME;

export async function ensureBucket() {
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: env.MAX_FILE_SIZE_MB * 1024 * 1024
  });
  if (error && error.message !== 'Bucket already exists') {
    throw new Error(`Could not create storage bucket: ${error.message}`);
  }
  const { error: updateError } = await supabase.storage.updateBucket(BUCKET, {
    public: false,
    fileSizeLimit: env.MAX_FILE_SIZE_MB * 1024 * 1024
  });
  if (updateError) throw new Error(`Could not configure storage bucket: ${updateError.message}`);
}

export async function uploadFile(file: Buffer, path: string, contentType: string) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType,
    cacheControl: '3600',
    upsert: false
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return path;
}

export async function createSignedUrl(
  filePath: string,
  expiresInSeconds = 900,
  download = false
) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, expiresInSeconds, download ? { download: true } : undefined);
  if (error || !data) throw new Error(`Could not create download link: ${error?.message ?? 'unknown'}`);
  return data.signedUrl;
}

export async function deleteFile(filePath: string) {
  const { error } = await supabase.storage.from(BUCKET).remove([filePath]);
  if (error) logError('Storage delete failed:', error.message);
}

export async function deleteFiles(filePaths: string[]) {
  if (filePaths.length === 0) return;
  const { error } = await supabase.storage.from(BUCKET).remove(filePaths);
  if (error) logError('Storage batch delete failed', error.message);
}

export function buildObjectPath(payload: {
  documentId: string;
  version: number;
  fileName: string;
}): string {
  const uuid = crypto.randomUUID();
  const safe = payload.fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  return `documents/${payload.documentId}/v${payload.version}/${uuid}_${safe}`;
}

export async function getUploadErrorAsAppError(err: unknown): Promise<AppError> {
  const message = err instanceof Error ? err.message : String(err);
  logError('Upload failed:', message);
  if (message.includes('Payload too large') || message.includes('exceeds')) {
    return AppError.tooLarge(`Unable to upload document. The file exceeds the ${env.MAX_FILE_SIZE_MB} MB limit.`);
  }
  return new AppError(400, 'Unable to upload document. Please try again.', 'UPLOAD_FAILED');
}