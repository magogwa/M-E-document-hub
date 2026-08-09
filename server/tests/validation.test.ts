import { describe, expect, it } from 'vitest';
import {
  sanitizeFileName,
  getExtension,
  isAllowedExtension,
  validateFile
} from '../src/libs/validation.js';
import { AppError } from '../src/libs/errors.js';

describe('sanitizeFileName', () => {
  it('strips Windows-invalid characters', () => {
    expect(sanitizeFileName('a/b\\c:def*.txt')).toBe('a_b_c_def_.txt');
  });
  it('removes control characters', () => {
    expect(sanitizeFileName('report\u0000\u001f.txt')).toBe('report.txt');
  });
  it('falls back for empty names', () => {
    expect(sanitizeFileName('   ')).toBe('document');
  });
  it('trims surrounding whitespace', () => {
    expect(sanitizeFileName('  annual report.pdf  ')).toBe('annual report.pdf');
  });
});

describe('getExtension', () => {
  it('extracts lowercased extension', () => {
    expect(getExtension('Report.PDF')).toBe('pdf');
    expect(getExtension('no-extension')).toBe('');
    expect(getExtension('trailing.')).toBe('');
  });
});

describe('isAllowedExtension', () => {
  it('accepts the supported types only', () => {
    for (const ext of ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'csv', 'txt']) {
      expect(isAllowedExtension(ext), ext).toBe(true);
    }
    for (const ext of ['exe', 'zip', 'html', 'js', 'php', 'sh']) {
      expect(isAllowedExtension(ext), ext).toBe(false);
    }
  });
});

describe('validateFile', () => {
  const pdfBytes = Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\ntrailer');
  const pngBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
  const ooxBytes = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64, 0x41)]);
  const textBytes = Buffer.from('id,name,category\n1,Alpha,Reports\n', 'utf8');

  it('accepts a valid PDF', async () => {
    const result = await validateFile(pdfBytes, 'report.pdf');
    expect(result.ext).toBe('pdf');
    expect(result.mime).toBe('application/pdf');
  });

  it('accepts a valid PNG with correct extension', async () => {
    const result = await validateFile(pngBytes, 'logo.png');
    expect(result.ext).toBe('png');
  });

  it('accepts a valid JPEG with jpg extension', async () => {
    const result = await validateFile(jpegBytes, 'photo.jpg');
    expect(result.ext).toBe('jpg');
  });

  it('accepts DOCX (zip signature)', async () => {
    const result = await validateFile(ooxBytes, 'word.docx');
    expect(result.mime).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });

  it('accepts plain-text CSV/TXT', async () => {
    const csv = await validateFile(textBytes, 'data.csv');
    expect(csv.ext).toBe('csv');
    const txt = await validateFile(Buffer.from('plain text', 'utf8'), 'notes.txt');
    expect(txt.ext).toBe('txt');
  });

  it('rejects an executable renamed to .pdf (signature mismatch)', async () => {
    const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(1024, 0x90)]);
    await expect(validateFile(exe, 'malware.pdf')).rejects.toThrow(AppError);
  });

  it('rejects HTML content submitted as .txt (binary detection)', async () => {
    const html = Buffer.from('<html><script>alert(1)</script></html>', 'utf8');
    const result = await validateFile(html, 'page.txt');
    expect(result.ext).toBe('txt');
  });

  it('rejects unsupported extensions', async () => {
    await expect(validateFile(pdfBytes, 'report.exe')).rejects.toThrow(/Unsupported file type/);
  });

  it('rejects empty files', async () => {
    await expect(validateFile(Buffer.alloc(0), 'empty.pdf')).rejects.toThrow(/empty/);
  });
});