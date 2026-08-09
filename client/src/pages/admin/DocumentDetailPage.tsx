import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Download,
  Eye,
  Trash2,
  UploadCloud,
  Users,
  History,
  X
} from 'lucide-react';
import { client } from '../../lib/api';
import { ApiError } from '../../lib/auth';
import { useData } from '../../hooks/useData';
import { formatBytes, formatDate, formatDateTime, timeAgo } from '../../lib/format';
import { AppShell } from '../../components/layout/AppShell';
import { FileIcon } from '../../components/FileIcon';
import { DocumentPreviewModal } from '../../components/DocumentPreviewModal';
import { Badge, ConfirmDialog, EmptyState, ErrorState, Modal, PageHeader, Spinner, StatusBadge } from '../../components/ui';
import type { DocumentDetailResponse, DocumentItem } from '../../types';

export function AdminDocumentDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [previewFor, setPreviewFor] = useState<DocumentItem | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [uploadVersionOpen, setUploadVersionOpen] = useState(false);
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [versionUploading, setVersionUploading] = useState(false);

  const { data, loading, error, reload }: { data: DocumentDetailResponse | null; loading: boolean; error: string | null; reload: () => void } = useData(
    () => client.get<DocumentDetailResponse>(`/documents/${id}`),
    [id]
  );
  const doc = data?.document;

  async function handleDelete() {
    if (!doc) return;
    setDeleting(true);
    try {
      await client.delete(`/documents/${doc.id}`);
      toast.success('Document deleted.');
      navigate('/admin/documents');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete the document.');
      setDeleting(false);
    }
  }

  async function handleRevoke(accessId: string) {
    try {
      await client.delete(`/access/${accessId}`);
      toast.success('Access removed for this client.');
      setRevokeId(null);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove access.');
    }
  }

  async function handleDownload(current: { id: string; file_name: string }) {
    try {
      const json = await client.get<{ signedUrl: string; fileName: string }>(`/documents/${current.id}/download`);
      const a = document.createElement('a');
      a.href = json.signedUrl;
      a.download = json.fileName;
      a.rel = 'noopener';
      a.click();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Download failed.');
    }
  }

  async function handleUploadVersion(e: FormEvent) {
    e.preventDefault();
    if (!doc || !versionFile) return;
    setVersionUploading(true);
    const form = new FormData();
    form.append('file', versionFile);
    try {
      await client.upload(`/documents/${doc.id}/versions`, form);
      toast.success('New version uploaded. The previous version is preserved in history.');
      setUploadVersionOpen(false);
      setVersionFile(null);
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Unable to upload new version.');
    } finally {
      setVersionUploading(false);
    }
  }

  async function handleVersionDownload(versionId: string) {
    if (!doc) return;
    try {
      const json = await client.get<{ signedUrl: string; fileName: string }>(
        `/documents/${doc.id}/versions/${versionId}`
      );
      const a = document.createElement('a');
      a.href = json.signedUrl;
      a.download = json.fileName;
      a.rel = 'noopener';
      a.click();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed.');
    }
  }

  return (
    <AppShell role="admin">
      <button
        type="button"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
        onClick={() => navigate('/admin/documents')}
      >
        <ArrowLeft className="h-4 w-4" /> Back to Documents
      </button>
      {loading && <Spinner />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && doc && (
        <div className="space-y-5">
          <PageHeader
            title={doc.title}
            subtitle={`Document ID: ${doc.id.slice(0, 8).toUpperCase()} · Version ${doc.version} · Updated ${timeAgo(doc.updated_at)}`}
            actions={
              <>
                <button type="button" className="btn-secondary" onClick={() => setPreviewFor(doc)}>
                  <Eye className="h-4 w-4" /> Preview
                </button>
                <button type="button" className="btn-primary" onClick={() => handleDownload(doc)}>
                  <Download className="h-4 w-4" /> Download
                </button>
              </>
            }
          />

          <div className="grid gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              <div className="card">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <FileIcon file={doc.file_type} /> Document information
                </h2>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <Field label="Title" value={doc.title} />
                  <Field label="File name" value={doc.file_name} />
                  <Field label="File type" value={doc.file_type || '—'} />
                  <Field label="File size" value={formatBytes(doc.file_size)} />
                  <Field label="Category" value={data?.category?.name ?? 'Uncategorized'} />
                  <Field label="Version" value={`Version ${doc.version}`} />
                  <Field label="Status" value={<StatusBadge status={doc.status} />} />
                  <Field label="Uploaded by" value={doc.uploader?.full_name ?? '—'} />
                  <Field label="Upload date" value={formatDateTime(doc.created_at)} />
                  <Field label="Last updated" value={formatDateTime(doc.updated_at)} />
                  <Field label="Description" value={doc.description ?? '—'} wide />
                  <Field label="Document ID" value={doc.id} />
                </dl>
              </div>

              <div className="card">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <History className="h-4 w-4 text-brand-600" /> Version history
                  </h2>
                  <button type="button" className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => setUploadVersionOpen(true)}>
                    <UploadCloud className="h-3.5 w-3.5" /> Upload new version
                  </button>
                </div>
                {(data?.versions?.length ?? 0) === 0 ? (
                  <EmptyState title="No version history yet" />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {(data?.versions ?? []).map((v) => (
                      <li key={v.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <FileIcon file={v.file_type} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">
                              Version {v.version}
                              {v.version === doc.version && <Badge tone="green">Current</Badge>}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {v.file_name} · {formatBytes(v.file_size)} · {formatDate(v.created_at)}
                            </p>
                          </div>
                        </div>
                        <button type="button" className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => handleVersionDownload(v.id)}>
                          <Download className="h-3.5 w-3.5" /> Download
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="card">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Users className="h-4 w-4 text-brand-600" /> Client access ({data?.access?.length ?? 0})
              </h2>
              {!data?.access?.length ? (
                <EmptyState title="No clients have access yet" description="Share this document from the Access page or when uploading." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {(data?.access ?? []).map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{a.client_name || a.client_org || 'Client'}</p>
                        <p className="truncate text-xs text-slate-500">{a.client_email ?? a.client_org}</p>
                        <p className="text-xs text-slate-400">Since {formatDate(a.granted_at)}</p>
                      </div>
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Remove access"
                        onClick={() => setRevokeId(a.id)}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 border-t border-slate-100 pt-3">
                <button type="button" className="text-sm font-medium text-brand-600 hover:text-brand-700" onClick={() => navigate(`/admin/access?documentId=${doc.id}`)}>
                  Manage access →
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-danger" disabled={deleting} onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" /> Delete document
            </button>
          </div>
        </div>
      )}

      <DocumentPreviewModal document={previewFor} onClose={() => setPreviewFor(null)} />

      <ConfirmDialog
        open={deleteOpen}
        title="Delete document"
        message={`"${doc?.title}" and all of its versions will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete permanently"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />

      <ConfirmDialog
        open={revokeId !== null}
        title="Remove client access"
        message="This client will no longer be able to see or download this document."
        confirmLabel="Remove access"
        danger
        onConfirm={() => void (revokeId && handleRevoke(revokeId))}
        onCancel={() => setRevokeId(null)}
      />

      <Modal open={uploadVersionOpen} onClose={() => setUploadVersionOpen(false)} title="Upload new version">
        <form onSubmit={handleUploadVersion} className="space-y-4">
          <p className="text-sm text-slate-600">
            Upload a new version of <strong>{doc?.title}</strong>. This becomes Version {doc ? doc.version + 1 : ''} and the
            current version is preserved in the version history.
          </p>
          <input
            type="file"
            required
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.csv,.txt"
            onChange={(e) => setVersionFile(e.target.files?.[0] ?? null)}
            className="input"
          />
          {versionFile && <p className="text-xs text-slate-500">{versionFile.name} · {formatBytes(versionFile.size)}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setUploadVersionOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={!versionFile || versionUploading}>
              {versionUploading ? 'Uploading…' : 'Upload version'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}

function Field({ label, value, wide = false }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}