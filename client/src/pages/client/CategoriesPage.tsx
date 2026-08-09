import { Link } from 'react-router-dom';
import { FolderOpen } from 'lucide-react';
import { client } from '../../lib/api';
import { useData } from '../../hooks/useData';
import { AppShell } from '../../components/layout/AppShell';
import { ErrorState, PageHeader, Spinner } from '../../components/ui';

export function ClientCategoriesPage() {
  const { data, loading, error, reload } = useData(
    () => client.get<{ categories: Array<{ id: string; name: string; description: string | null }> }>('/categories'),
    []
  );

  return (
    <AppShell role="client">
      <PageHeader title="Categories" subtitle="Browse the categories your organization uses to organize documents." />

      {loading && <Spinner label="Loading categories…" />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.categories.length === 0 && (
            <p className="text-sm text-slate-500">No categories have been created yet.</p>
          )}
          {data.categories.map((category) => (
            <Link
              key={category.id}
              to="/client/documents"
              className="group rounded-xl border border-slate-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-sm"
            >
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <FolderOpen className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-slate-800 group-hover:text-brand-700">{category.name}</p>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500">{category.description || 'No description'}</p>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}