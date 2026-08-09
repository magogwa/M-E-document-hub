import { useMemo, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, FileUp } from 'lucide-react';
import { client, ApiError } from '../../lib/api';
import { useData } from '../../hooks/useData';
import { formatBytes, extOf } from '../../lib/format';
import { PageHeader, Spinner } from '../../components/ui';

const ACCEPTED = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.csv,.txt';

export function UploadDocumentPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [autoShare, setAutoShare] = useState(true);
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  const [submitting, setSubmitting] = useState(false);

  const { data: categories } = useData(() => client.get<{ categories: { id: string; name: string }[] }>('/categories'), []);
  const { data: clients } = useData(
    () => client.get<{ clients: Array<{ id: string; organization: string | null; profile?: { full_name: string } }> }>('/clients'),
    []
  );

  const clientOptions = useMemo(() => (clients?.clients ?? []).filter((c) => c.profile?.full_name), [clients]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error('Please select a file to upload.');
      return;
    }
    setSubmitting(true);
    const form = new FormData();
    form.append('file', file);
    form.append('title', title);
    form.append('description', description);
    if (categoryId) form.append('categoryId', categoryId);
    if (!autoShare && clientIds.length) form.append('clientIds', JSON.stringify(clientIds));
    form.append('status', status);

    try {
      await client.upload('/documents/upload', form);
      toast.success(`"${title}" uploaded successfully.`);
      navigate('/admin/documents');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Unable to upload document. Please check the file size and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="Upload Document"
        subtitle="Securely store a new document in the cloud and optionally share it with members."
      />

      <div className="card">
        <label
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition hover:border-brand-400 hover:bg-brand-50"
          role="button"
        >
          <UploadCloud className="h-10 w-10 text-brand-500" />
          <p className="text-sm font-medium text-slate-700">
            {file ? file.name : 'Click to choose a file'}
          </p>
          <p className="text-xs text-slate-500">
            {file ? formatBytes(file.size) : `PDF, Word, Excel, PowerPoint, JPG, PNG, CSV, TXT`}
          </p>
          <input
            type="file"
            className="hidden"
            accept={ACCEPTED}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {file && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            <FileUp className="h-3.5 w-3.5 text-brand-500" />
            {extOf(file.name).toUpperCase()} file selected
          </p>
        )}
      </div>

      <div className="card space-y-4">
        <div>
          <label className="label" htmlFor="title">Document title *</label>
          <input id="title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="e.g. Q2 Monitoring Report 2026" />
        </div>
        <div>
          <label className="label" htmlFor="description">Description</label>
          <textarea id="description" rows={3} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} className="input" placeholder="Brief description of the document content…" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="category">Category</label>
            <select id="category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input">
              <option value="">No category</option>
              {(categories?.categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="status">Status</label>
            <select id="status" value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'archived')} className="input">
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              checked={autoShare}
              onChange={(e) => setAutoShare(e.target.checked)}
            />
            Auto-share with all active members
          </label>
          <p className="mt-1 text-xs text-slate-500">
            The document is shared automatically with every active member (they get email notifications). Uncheck to choose
            specific members instead.
          </p>
        </div>

        {!autoShare && (
          <div>
            <span className="label">Share with members</span>
            <p className="mb-2 text-xs text-slate-500">Selected members will receive email notifications with access links. You can manage access later.</p>
            {clientOptions.length === 0 ? (
              <p className="text-sm text-slate-400">No members yet - create them first, or share this document later from Access Management.</p>
            ) : (
              <div className="grid max-h-56 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-2">
                {clientOptions.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      checked={clientIds.includes(c.id)}
                      onChange={(e) =>
                        setClientIds((prev) =>
                          e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                        )
                      }
                    />
                    <span className="truncate">{c.profile?.full_name}</span>
                    {c.organization && <span className="truncate text-xs text-slate-400">· {c.organization}</span>}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card space-y-4 !bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-900">Upload information</h3>
      </div>

      <button type="submit" disabled={submitting || !file} className="btn-primary w-full">
        <UploadCloud className="h-4 w-4" />
        {submitting ? 'Uploading securely…' : `Upload & register document`}
      </button>
    </form>
  );
}