import { type ReactNode } from 'react';
import { Loader2, Inbox, AlertTriangle, X, CircleX } from 'lucide-react';

export function Spinner({ label = 'Loading…', className = '' }: { label?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-12 text-slate-500 ${className}`}>
      <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <Inbox className="h-10 w-10 text-slate-300" />
      <p className="mt-1 text-sm font-medium text-slate-700">{title}</p>
      {description && <p className="max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <CircleX className="h-10 w-10 text-red-400" />
      <p className="text-sm font-medium text-slate-700">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-secondary mt-2">
          Try again
        </button>
      )}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md'
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}) {
  if (!open) return null;
  const widths = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white shadow-2xl ${widths[size]}`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  loading = false,
  onConfirm,
  onCancel
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <Spinner label="" className="py-0" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Pagination({
  page,
  total,
  limit,
  onPageChange
}: {
  page: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row">
      <p className="text-xs text-slate-500">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="btn-secondary px-3 py-1.5 text-xs"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
          let p = i + 1;
          if (pages > 7 && page > 4) p = page - 4 + i;
          if (p > pages) return null;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                p === page ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {p}
            </button>
          );
        })}
        <button
          type="button"
          className="btn-secondary !px-3 !py-1.5 text-xs"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'green' | 'red' | 'amber' | 'blue' | 'slate' }) {
  const tones: Record<string, string> = {
    green: 'bg-green-50 text-green-700 ring-green-600/20',
    red: 'bg-red-50 text-red-700 ring-red-600/20',
    amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    blue: 'bg-brand-50 text-brand-700 ring-brand-600/20',
    slate: 'bg-slate-50 text-slate-600 ring-slate-500/20'
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  if (status === 'active') return <Badge tone="green">Active</Badge>;
  if (status === 'inactive') return <Badge tone="red">Inactive</Badge>;
  return <Badge tone="amber">Pending</Badge>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}