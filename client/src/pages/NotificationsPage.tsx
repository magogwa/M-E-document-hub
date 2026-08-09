import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Bell, CheckCheck, FileText } from 'lucide-react';
import { client } from '../lib/api';
import { ApiError } from '../lib/auth';
import { useData } from '../hooks/useData';
import { timeAgo } from '../lib/format';
import { AppShell } from '../components/layout/AppShell';
import { EmptyState, ErrorState, PageHeader, Pagination, Spinner } from '../components/ui';
import type { AppNotification, Role } from '../types';

export function NotificationsPage({ role }: { role: Role }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [markedAll, setMarkedAll] = useState(false);

  const { data, loading, error, reload } = useData(
    () =>
      client.get<{ items: AppNotification[]; total: number; page: number; limit: number; unread: number }>(
        `/notifications?page=${page}&limit=10`
      ),
    [page]
  );

  useEffect(() => {
    if (markedAll || loading || (data?.unread ?? 0) === 0) return;
    client
      .post('/notifications/read-all')
      .then(() => {
        setMarkedAll(true);
        reload();
      })
      .catch(() => undefined);
  }, [markedAll, loading, data, reload]);

  async function handleMarkAll() {
    try {
      await client.post('/notifications/read-all');
      toast.success('All notifications marked as read.');
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not mark notifications as read.');
    }
  }

  async function openNotification(notification: AppNotification) {
    if (!notification.read_at) {
      client.post(`/notifications/${notification.id}/read`).catch(() => undefined);
    }
    if (notification.document_id) {
      navigate(role === 'admin' ? `/admin/documents/${notification.document_id}` : '/client/documents');
    }
  }

  return (
    <AppShell role={role}>
      <PageHeader
        title="Notifications"
        subtitle="See what is happening in the hub - new document uploads and activity."
        actions={
          <button type="button" className="btn-secondary" onClick={handleMarkAll}>
            <CheckCheck className="h-4 w-4" /> Mark all as read
          </button>
        }
      />

      {loading && <Spinner />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (data?.items.length ?? 0) === 0 && (
        <div className="card">
          <EmptyState
            title="No notifications yet"
            description="You will be notified here whenever someone uploads a document."
          />
        </div>
      )}
      {!loading && !error && (data?.items.length ?? 0) > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <ul className="divide-y divide-slate-100">
            {(data?.items ?? []).map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => openNotification(n)}
                  className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 ${
                    n.read_at ? 'opacity-70' : 'bg-brand-50/40'
                  }`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                    {n.type === 'document_upload' ? <FileText className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-sm text-slate-600">{n.body}</p>}
                    <p className="mt-1 text-xs text-slate-400">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                </button>
              </li>
            ))}
          </ul>
          <Pagination page={data?.page ?? 1} total={data?.total ?? 0} limit={data?.limit ?? 10} onPageChange={setPage} />
        </div>
      )}
    </AppShell>
  );
}