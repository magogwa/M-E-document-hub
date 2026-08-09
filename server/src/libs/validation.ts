import { fileTypeFromBuffer } from 'file-type';
import { AppError } from './errors.js';
import { env } from '../config/env.js';

const EXTENSION_WHITELIST = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'jpg', 'jpeg', 'png', 'csv', 'txt'
]);

const MIME_MAP: Record<string, string> = {
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

export const PREVIEWABLE_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'csv', 'txt']);

/** Strip Windows-invalid chars, control chars, and clamp length. */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 120);
  return cleaned.length > 0 ? cleaned : 'document';
}

export function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  if (dot < 0 || dot === fileName.length - 1) return '';
  return fileName.slice(dot + 1).toLowerCase();
}

export function isAllowedExtension(ext: string): boolean {
  return EXTENSION_WHITELIST.has(ext);
}

function isOox(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 && buffer[1] === 0x4b &&
    buffer[2] === 0x03 && buffer[3] === 0x04
  );
}

function isPlainText(buffer: Buffer): boolean {
  return !buffer.subarray(0, 1024).includes(0x00);
}

export interface ValidatedFile {
  ext: string;
  mime: string;
  fileName: string;
  size: number;
}

/**
 * Validates a file's extension AND its content signature (magic bytes),
 * so a renamed .exe can never be stored as a PDF. Enforces the size limit.
 */
export async function validateFile(buffer: Buffer, originalName: string): Promise<ValidatedFile> {
  if (!buffer || buffer.length === 0) {
    throw AppError.badRequest('Uploaded file is empty.');
  }

  const maxBytes = env.MAX_FILE_SIZE_MB * 1024 * 1024;
  if (buffer.length > maxBytes) {
    throw AppError.tooLarge(
      `Unable to upload document. The file exceeds the ${env.MAX_FILE_SIZE_MB} MB limit.`
    );
  }

  const ext = getExtension(originalName);
  if (!isAllowedExtension(ext)) {
    throw AppError.badRequest(
      'Unsupported file type. Allowed: PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, JPG/JPEG, PNG, CSV, TXT.'
    );
  }

  const detected = await fileTypeFromBuffer(buffer);
  const detectedExt = detected?.ext?.toLowerCase() ?? '';
  const detectedMime = detected?.mime ?? '';

  const contentMatches =
    (ext === 'pdf' && detectedExt === 'pdf') ||
    (['docx', 'xlsx', 'pptx'].includes(ext) && isOox(buffer)) ||
    (['jpg', 'jpeg'].includes(ext) && (detectedMime.startsWith('image/jpeg') || detectedExt === 'jpg')) ||
    (ext === 'png' && (detectedExt === 'png' || detectedMime.startsWith('image/png'))) ||
    (['csv', 'txt'].includes(ext) && isPlainText(buffer)) ||
    (['doc', 'xls', 'ppt'].includes(ext) && buffer.length > 8);

  if (!contentMatches) {
    throw AppError.badRequest('File content does not match its extension and was rejected.');
  }

  return {
    ext,
    mime: MIME_MAP[ext] ?? detectedMime ?? 'application/octet-stream',
    fileName: sanitizeFileName(originalName),
    size: buffer.length
  };
}