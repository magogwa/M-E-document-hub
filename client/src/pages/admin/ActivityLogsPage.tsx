import { useState } from 'react';
import { client } from '../../lib/api';
import { useData } from '../../hooks/useData';
import { formatDateTime } from '../../lib/format';
import { AppShell } from '../../components/layout/AppShell';
import { Badge, EmptyState, ErrorState, PageHeader, Pagination, Spinner } from '../../components/ui';
import type { ActivityItem, Paged } from '../../types';

const ACTION_LABELS: Record<string, string> = {
  login: 'Login',
  logout: 'Logout',
  register: 'Registration',
  document_upload: 'Document uploaded',
  document_download: 'Document downloaded',
  document_preview: 'Document previewed',
  document_delete: 'Document deleted',
  document_update: 'Document updated',
  document_version_upload: 'New version uploaded',
  access_granted: 'Access granted',
  access_revoked: 'Access revoked',
  client_created: 'Member created',
  client_updated: 'Member updated',
  client_status_changed: 'Member status changed',
  client_access_granted_all: 'Member granted all documents',
  comment_added: 'Comment added',
  comment_deleted: 'Comment deleted',
  password_reset: 'Password reset requested',
  password_changed: 'Password changed',
  settings_updated: 'Settings updated',
  admin_created: 'Admin created'
};

const ACTION_TONES: Record<string, 'blue' | 'green' | 'red' | 'amber' | 'slate'> = {
  login: 'green',
  logout: 'slate',
  document_upload: 'blue',
  document_version_upload: 'blue',
  document_download: 'blue',
  document_preview: 'slate',
  document_delete: 'red',
  access_granted: 'green',
  access_revoked: 'red',
  client_created: 'green',
  client_status_changed: 'amber'
};

export function AdminActivityLogsPage() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (action) params.set('action', action);
  params.set('page', String(page));
  params.set('limit', '15');

  const { data, loading, error, reload } = useData(
    () => client.get<Paged<ActivityItem>>(`/activity?${params.toString()}`),
    [action, page]
  );

  return (
    <AppShell role="admin">
      <PageHeader
        title="Activity Logs"
        subtitle="Every important action in the system - who did what, when, and from where."
        actions={
          <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="input !w-auto">
            <option value="">All actions</option>
            {Object.entries(ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        }
      />

      {loading && <Spinner />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (data?.items?.length ?? 0) === 0 && (
        <div className="card">
          <EmptyState
            title="No activity recorded yet"
            description="Actions such as logins, uploads, downloads and sharing decisions will appear here."
          />
        </div>
      )}

      {!loading && !error && (data?.items?.length ?? 0) > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <ul className="divide-y divide-slate-100">
            {(data?.items ?? []).map((item) => (
              <li key={item.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <Badge tone={ACTION_TONES[item.action] ?? 'slate'}>{ACTION_LABELS[item.action] ?? item.action}</Badge>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800">
                      <span className="font-medium">{item.user?.full_name ?? 'System'}</span>
                      <span className="text-slate-400"> · </span>
                      <span className="text-slate-500">{item.user?.email}</span>
                    </p>
                    {item.document && <p className="truncate text-xs text-slate-500">Document: {item.document.title}</p>}
                  </div>
                </div>
                <div className="shrink-0 text-right text-xs text-slate-400">
                  <p>{formatDateTime(item.timestamp)}</p>
                  {item.ip_address && <p className="font-mono">{item.ip_address}</p>}
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={data!.page} total={data!.total} limit={data!.limit} onPageChange={setPage} />
        </div>
      )}
    </AppShell>
  );
}