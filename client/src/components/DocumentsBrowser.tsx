import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Eye, Download, Trash2, Search } from 'lucide-react';
import { client, queryString } from '../lib/api';
import { ApiError } from '../lib/auth';
import { useDebouncedValue, useData } from '../hooks/useData';
import { formatBytes, formatDate, timeAgo } from '../lib/format';
import { FileIcon } from './FileIcon';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import { Badge, ConfirmDialog, EmptyState, ErrorState, Pagination, Spinner, StatusBadge } from './ui';
import type { DocumentItem, Paged } from '../types';

const FILE_TYPES = [
  { label: 'PDF', value: 'pdf' },
  { label: 'Word', value: 'word' },
  { label: 'Excel', value: 'excel' },
  { label: 'PowerPoint', value: 'ppt' },
  { label: 'Images', value: 'image' },
  { label: 'CSV / TXT', value: 'text' }
];

export function DocumentsBrowser({
  mode,
  defaultSort = 'created_at',
  hideFilters = []
}: {
  mode: 'admin' | 'client';
  defaultSort?: string;
  hideFilters?: Array<'category' | 'type' | 'client' | 'date' | 'search'>;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [categoryId, setCategoryId] = useState('');
  const [fileType, setFileType] = useState('');
  const [clientId, setClientId] = useState('');
  const [status, setStatus] = useState('active');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState(defaultSort);
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<DocumentItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DocumentItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const params = queryString({
    search: debouncedSearch,
    categoryId,
    fileType,
    clientId,
    status,
    startDate,
    endDate,
    sortBy,
    order,
    page,
    limit: 10
  });

  const { data, loading, error, reload } = useData(
    () => client.get<Paged<DocumentItem>>(`/documents${params}`),
    [params, reloadKey]
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, categoryId, fileType, clientId, status, startDate, endDate, sortBy, order]);

  const { data: categories } = useData(() => client.get<{ categories: { id: string; name: string }[] }>('/categories'), []);
  const { data: clients } = useData(
    () => (mode === 'admin' ? client.get<{ clients: Array<{ id: string; profile?: { full_name: string } }> }>('/clients') : Promise.resolve({ clients: [] })),
    []
  );

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await client.delete(`/documents/${confirmDelete.id}`);
      toast.success('Document deleted.');
      setConfirmDelete(null);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete the document.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleDownload(doc: DocumentItem) {
    try {
      const json = await client.get<{ signedUrl: string; fileName: string }>(`/documents/${doc.id}/download`);
      const a = document.createElement('a');
      a.href = json.signedUrl;
      a.download = json.fileName;
      a.rel = 'noopener noreferrer';
      a.click();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Download failed.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {!hideFilters.includes('search') && (
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, file name, description or category…"
              className="input pl-9"
            />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input !w-auto">
            <option value="">All categories</option>
            {(categories?.categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {!hideFilters.includes('type') && (
            <select value={fileType} onChange={(e) => setFileType(e.target.value)} className="input !w-auto">
              <option value="">All types</option>
              {FILE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          )}
          {mode === 'admin' && !hideFilters.includes('client') && (
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="input !w-auto">
              <option value="">All clients</option>
              {(clients?.clients ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.profile?.full_name ?? c.id.slice(0, 8)}</option>
              ))}
            </select>
          )}
          {!hideFilters.includes('date') && (
            <>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input !w-auto" title="From date" />
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input !w-auto" title="To date" />
            </>
          )}
          {mode === 'admin' && (
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="input !w-auto">
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          )}
        </div>
      </div>

      {loading && <Spinner />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && data && data.items.length === 0 && (
        <EmptyState
          title="No documents found"
          description="Try adjusting the search or filters - or upload a new document to get started."
        />
      )}

      {!loading && !error && data && data.items.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="th">Document</th>
                  <th className="th">Category</th>
                  <th className="th">Uploaded</th>
                  <th className="th">Size</th>
                  <th className="th">Version</th>
                  {mode === 'admin' && <th className="th">Status</th>}
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50">
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <FileIcon file={doc.file_type} />
                        <div className="min-w-0">
                          <button
                            type="button"
                            className="block truncate text-left text-sm font-medium text-slate-900 hover:text-brand-600"
                            onClick={() => (mode === 'admin' ? navigate(`/admin/documents/${doc.id}`) : setPreview(doc))}
                          >
                            {doc.title}
                          </button>
                          <p className="truncate text-xs text-slate-500">{doc.file_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="td">
                      <Badge>{doc.categories?.name ?? 'Uncategorized'}</Badge>
                    </td>
                    <td className="td whitespace-nowrap" title={formatDate(doc.created_at)}>{timeAgo(doc.created_at)}</td>
                    <td className="td whitespace-nowrap">{formatBytes(doc.file_size)}</td>
                    <td className="td">
                      <Badge tone="blue">v{doc.version}</Badge>
                    </td>
                    {mode === 'admin' && (
                      <td className="td">
                        <StatusBadge status={doc.status} />
                      </td>
                    )}
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        <button type="button" title="Preview" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600" onClick={() => setPreview(doc)}>
                          <Eye className="h-4 w-4" />
                        </button>
                        <button type="button" title="Download" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600" onClick={() => handleDownload(doc)}>
                          <Download className="h-4 w-4" />
                        </button>
                        {mode === 'admin' && (
                          <>
                            <button type="button" title="Open details" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600" onClick={() => navigate(`/admin/documents/${doc.id}`)}>
                              <InfoIcon />
                            </button>
                            <button type="button" title="Delete" className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => setConfirmDelete(doc)}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} total={data.total} limit={data.limit} onPageChange={setPage} />
        </div>
      )}

      <DocumentPreviewModal document={preview} onClose={() => setPreview(null)} />

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete document"
        message={`Are you sure you want to delete "${confirmDelete?.title}"? This permanently removes the document and all of its versions.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function InfoIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

export { FILE_TYPES as DOCUMENT_TYPE_OPTIONS };