import { Link } from 'react-router-dom';
import { FileText, UploadCloud, FolderOpen, Calendar, Activity, Share2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { client } from '../../lib/api';
import { useData } from '../../hooks/useData';
import { formatBytes, formatDateTime, timeAgo } from '../../lib/format';
import { AppShell } from '../../components/layout/AppShell';
import { Badge, EmptyState, ErrorState, PageHeader, Spinner } from '../../components/ui';
import type { AdminStats } from '../../types';

export function AdminDashboardPage() {
  const { data, loading, error, reload } = useData(
    () => client.get<AdminStats>('/dashboard/admin'),
    []
  );

  return (
    <AppShell role="admin">
      <PageHeader title="Dashboard" subtitle="Overview of your document library, clients and recent activity." />

      {loading && <Spinner label="Loading dashboard…" />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && data && (
        <div className="space-y-6">
<div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard icon={<FileText className="h-5 w-5" />} label="Total documents" value={String(data.totals.documents)} hint={`${data.totals.documentsThisMonth} this month`} />
            <StatCard icon={<UsersIcon />} label="Total clients" value={String(data.totals.clients)} hint={`${data.totals.activeClients} active`} />
            <StatCard icon={<Calendar className="h-5 w-5" />} label="Uploads this month" value={String(data.totals.documentsThisMonth)} hint="New documents" />
            <StatCard icon={<DatabaseIcon />} label="Storage used" value={formatBytes(data.totals.storageBytes)} hint={data.totals.storageLimitMB > 0 ? `of ${formatBytes(data.totals.storageLimitMB * 1024 * 1024)} limit` : 'Unlimited'} />
          </div>

          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard icon={<Share2 className="h-5 w-5" />} label="Access grants" value={String(data.totals.accessGrants)} hint="Documents shared" />
            <StatCard icon={<Activity className="h-5 w-5" />} label="Activity today" value={String(data.totals.activityToday)} hint="Logged actions" />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="card">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Recently uploaded</h2>
                <Link to="/admin/documents" className="text-xs font-medium text-brand-600 hover:text-brand-700">View all →</Link>
              </div>
              {data.recentUploads.length === 0 ? (
                <EmptyState
                  title="No documents yet"
                  description="Upload your first document to get started."
                  action={<Link to="/admin/upload" className="btn-primary"><UploadCloud className="h-4 w-4" /> Upload document</Link>}
                />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.recentUploads.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                      <Link to={`/admin/documents/${d.id}`} className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800 hover:text-brand-600">{d.title}</p>
                        <p className="truncate text-xs text-slate-500">
                          {d.category && <Badge>{d.category}</Badge>} <span className="ml-1">v{d.version} · {timeAgo(d.created_at)}</span>
                        </p>
                      </Link>
                      <p className="shrink-0 text-xs text-slate-400">{d.uploaded_by}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Recent activity</h2>
                <Link to="/admin/activity" className="text-xs font-medium text-brand-600 hover:text-brand-700">Full log →</Link>
              </div>
              {data.recentActivity.length === 0 ? (
                <EmptyState title="No activity yet" description="Uploads, downloads and sharing actions will appear here." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.recentActivity.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                      <p className="truncate text-sm text-slate-700">
                        <span className="font-medium">{a.actor_name ?? 'System'}</span>
                        <span className="mx-1 text-slate-400">·</span>
                        <Badge>{a.action.replace('_', ' ')}</Badge>
                      </p>
                      <p className="shrink-0 text-xs text-slate-400">{formatDateTime(a.timestamp)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="card">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Uploads - last 6 months</h2>
              {data.monthlyUploads.every((m) => m.count === 0) ? (
                <p className="text-sm text-slate-500">No uploads recorded in the last six months yet.</p>
              ) : (
                <div className="flex h-40 items-end gap-2">
                  {data.monthlyUploads.map((m) => (
                    <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-xs font-medium text-slate-600">{m.count}</span>
                      <div
                        className="w-full rounded-t-md bg-brand-500 transition-all"
                        style={{ height: `${Math.max(4, (m.count / Math.max(1, ...data.monthlyUploads.map((x) => x.count))) * 110)}px` }}
                        title={`${m.month}: ${m.count} uploads`}
                      />
                      <span className="text-[10px] text-slate-400">{monthLabel(m.month)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Quick actions</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <QuickAction to="/admin/upload" icon={<UploadCloud className="h-5 w-5" />} title="Upload a document" description="Store a new file in the cloud" />
                <QuickAction to="/admin/access" icon={<Share2 className="h-5 w-5" />} title="Share documents" description="Manage client access" />
                <QuickAction to="/admin/clients" icon={<UsersIcon />} title="Manage clients" description="Create or activate accounts" />
                <QuickAction to="/admin/categories" icon={<FolderOpen className="h-5 w-5" />} title="Categories" description="Organize your library" />
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function StatCard({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="card !p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">{icon}</div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="text-xl font-semibold text-slate-900">{value}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-400">{hint}</p>
    </div>
  );
}

function UsersIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14a9 3 0 0 0 18 0V5" />
      <path d="M3 12a9 3 0 0 0 18 0" />
    </svg>
  );
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('en', { month: 'short' });
}

function QuickAction({ to, icon, title, description }: { to: string; icon: ReactNode; title: string; description: string }) {
  return (
    <Link to={to} className="group rounded-xl border border-slate-200 p-4 transition hover:border-brand-300 hover:bg-brand-50">
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-white text-brand-600 shadow-sm">{icon}</div>
      <p className="text-sm font-medium text-slate-800 group-hover:text-brand-700">{title}</p>
      <p className="text-xs text-slate-500">{description}</p>
    </Link>
  );
}