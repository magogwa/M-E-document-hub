import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { UploadCloud } from 'lucide-react';
import { client } from '../../lib/api';
import { useData } from '../../hooks/useData';
import { formatBytes } from '../../lib/format';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader, Spinner } from '../../components/ui';

const ACCEPTED = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.csv,.txt';

export function ClientUploadPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: settings, loading: settingsLoading } = useData(
    () => client.get<{ settings: { appName: string; allowClientUpload: boolean; maxFileSizeMB: number } }>('/settings'),
    []
  );
  const { data: categories } = useData(() => client.get<{ categories: { id: string; name: string }[] }>('/categories'), []);

  const allowUpload = settings?.settings.allowClientUpload ?? false;
  const maxMb = settings?.settings.maxFileSizeMB ?? 25;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error('Please select a file to upload.');
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`This file is too big. The maximum size is ${maxMb} MB.`);
      return;
    }
    setSubmitting(true);
    const form = new FormData();
    form.append('file', file);
    form.append('title', title);
    form.append('description', description);
    if (categoryId) form.append('categoryId', categoryId);
    try {
      await client.upload('/documents/upload', form);
      toast.success('Document uploaded. It is now visible to everyone in your organization.');
      navigate('/client/documents');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to upload the document. Check the file size and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell role="client">
      <PageHeader
        title="Upload a document"
        subtitle="Share a file with everyone - your upload becomes visible to all clients and the administrator."
      />

      {settingsLoading && <Spinner label="Loading…" />}

      {!settingsLoading && !allowUpload && (
        <div className="card max-w-2xl">
          <p className="text-sm text-slate-600">
            Uploading documents is currently disabled for clients. Please contact your administrator to enable it.
          </p>
        </div>
      )}

      {!settingsLoading && allowUpload && (
        <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-5">
          <div className="card">
            <label
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition hover:border-brand-400 hover:bg-brand-50"
              role="button"
            >
              <UploadCloud className="h-10 w-10 text-brand-500" />
              <p className="text-sm font-medium text-slate-700">{file ? file.name : 'Click to choose a file'}</p>
              <p className="text-xs text-slate-500">{file ? formatBytes(file.size) : `PDF, Word, Excel, PowerPoint, JPG, PNG, CSV, TXT - max ${maxMb} MB`}</p>
              <input
                type="file"
                className="hidden"
                accept={ACCEPTED}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div className="card space-y-4">
            <div>
              <label className="label" htmlFor="title">Title *</label>
              <input id="title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="e.g. Field visit report - August" />
            </div>
            <div>
              <label className="label" htmlFor="description">Description</label>
              <textarea id="description" rows={3} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} className="input" placeholder="Short summary of the document content…" />
            </div>
            <div>
              <label className="label" htmlFor="category">Category</label>
              <select id="category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input">
                <option value="">No category</option>
                {(categories?.categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
            This document will be visible to all clients and the administrator immediately after upload.
          </div>

          <button type="submit" className="btn-primary" disabled={submitting || !file}>
            <UploadCloud className="h-4 w-4" /> {submitting ? 'Uploading…' : 'Upload document'}
          </button>
        </form>
      )}
    </AppShell>
  );
}