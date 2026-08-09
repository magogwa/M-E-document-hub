export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function extOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  if (dot < 0 || dot === fileName.length - 1) return 'file';
  return fileName.slice(dot + 1).toLowerCase();
}

export function groupOf(fileType: string): 'pdf' | 'image' | 'text' | 'excel' | 'word' | 'ppt' | 'other' {
  const f = fileType.toLowerCase();
  if (f.includes('pdf')) return 'pdf';
  if (f.includes('jpeg') || f.includes('png') || f.startsWith('image/')) return 'image';
  if (f.includes('spreadsheet') || f === 'text/csv' || f.endsWith('xls')) return 'excel';
  if (f.includes('word') || f === 'application/msword') return 'word';
  if (f.includes('presentation') || f === 'application/vnd.ms-powerpoint') return 'ppt';
  if (f.includes('text/')) return 'text';
  return 'other';
}

export function isPreviewable(fileType: string, fileName: string): boolean {
  const group = extOf(fileName);
  return ['pdf', 'jpg', 'jpeg', 'png', 'csv', 'txt'].includes(group);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function downloadViaAnchor(url: string, fileName: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export async function textFromUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not load the file.');
  return res.text();
}