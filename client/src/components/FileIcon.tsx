import { FileText, Image, Table, Presentation, FileSpreadsheet, File } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { groupOf } from '../lib/format';

const COLORS: Record<string, string> = {
  pdf: 'text-red-600',
  image: 'text-emerald-600',
  word: 'text-blue-600',
  excel: 'text-green-600',
  ppt: 'text-orange-500',
  text: 'text-slate-600',
  other: 'text-slate-400'
};

const ICONS: Record<string, LucideIcon> = {
  pdf: FileText,
  image: Image,
  excel: FileSpreadsheet,
  word: FileText,
  ppt: Presentation,
  text: FileText,
  other: File
};

export function FileIcon({ file, className = 'h-5 w-5' }: { file: string; className?: string }) {
  const group = groupOf(file);
  const Icon = ICONS[group] ?? File;
  return <Icon className={`${className} shrink-0 ${COLORS[group] ?? COLORS.other}`} aria-hidden />;
}