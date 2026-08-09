import { Link } from 'react-router-dom';
import { FileText, Eye } from 'lucide-react';
import type { ReactNode } from 'react';
import { client } from '../../lib/api';
import { useData } from '../../hooks/useData';
import { timeAgo } from '../../lib/format';
import { AppShell } from '../../components/layout/AppShell';
import { Badge, EmptyState, ErrorState, PageHeader, Spinner } from '../../components/ui';
import type { ClientDashboardResponse } from '../../types';

export function ClientDashboardPage() {
  const { data, loading, error, reload } = useData(
    () => client.get<ClientDashboardResponse>('/dashboard/client'),
    []
  );

  return (
    <AppShell role="client">
      <PageHeader title="My dashboard" subtitle="Documents shared with you, at a glance." />

      {loading && <Spinner label="Loading dashboard…" />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard icon={<FileText className="h-5 w-5" />} label="Documents shared" value={String(data.totals.sharedDocuments)} />
            <StatCard icon={<Eye className="h-5 w-5" />} label="Previewed" value={String(data.totals.previews)} />
            <StatCard icon={<Download className="h-5 w-5" />} label="Downloads" value={String(data.totals.downloads)} />
            <StatCard icon={<HardDrive className="h-5 w-5" />} label="Storage used" value={`${data.totals.storageMB.toFixed(1)} MB`} />
          </div>

          <div className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Recently shared with you</h2>
              <Link to="/client/documents" className="text-xs font-medium text-brand-600 hover:text-brand-700">View all →</Link>
            </div>
            {data.recentDocuments.length === 0 ? (
              <EmptyState
                title="No documents shared yet"
                description="Documents that your organization shares with you will appear here."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.recentDocuments.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                    <Link to="/client/documents" className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800 hover:text-brand-600">{d.title}</p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                        {d.categories?.name && <Badge>{d.categories.name}</Badge>}
                        <span>v{d.version} · {timeAgo(d.created_at)}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {data.categories.length > 0 && (
            <div className="card">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Categories</h2>
              <div className="flex flex-wrap gap-2">
                {data.categories.map((name) => (
                  <Link
                    key={name}
                    to="/client/categories"
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50"
                  >
                    <Folder className="h-3.5 w-3.5 text-brand-500" /> {name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="card !p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">{icon}</div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="text-xl font-semibold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function Download(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

function HardDrive(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="22" x2="2" y1="12" y2="12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      <line x1="6" x2="6.01" y1="16" y2="16" />
      <line x1="10" x2="10.01" y1="16" y2="16" />
    </svg>
  );
}

function Folder(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}