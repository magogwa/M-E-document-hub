import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { client } from '../../lib/api';
import { useData } from '../../hooks/useData';
import { AppShell } from '../../components/layout/AppShell';
import { ConfirmDialog, EmptyState, ErrorState, Modal, PageHeader, Spinner } from '../../components/ui';
import type { Category } from '../../types';

export function AdminCategoriesPage() {
  const { data, loading, error, reload } = useData(
    () => client.get<{ categories: Category[] }>('/categories'),
    []
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Category | null>(null);

  function openCreate() {
    setEditing(null);
    setName('');
    setDescription('');
    setModalOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setName(category.name);
    setDescription(category.description ?? '');
    setModalOpen(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await client.patch(`/categories/${editing.id}`, { name, description });
        toast.success('Category updated.');
      } else {
        await client.post('/categories', { name, description });
        toast.success('Category created.');
      }
      setModalOpen(false);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the category.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await client.delete(`/categories/${confirmDelete.id}`);
      toast.success('Category deleted.');
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete the category.');
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <AppShell role="admin">
      <PageHeader
        title="Categories"
        subtitle="Organize documents into categories for easier filtering."
        actions={
          <button type="button" className="btn-primary" onClick={openCreate}>
            <Plus className="h-4 w-4" /> New category
          </button>
        }
      />

      {loading && <Spinner />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (data?.categories?.length ?? 0) === 0 && (
        <div className="card">
          <EmptyState
            title="No categories yet"
            description="Create categories such as Reports, Budgets, or Surveys to structure your document library."
            action={<button type="button" className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> Create category</button>}
          />
        </div>
      )}

      {!loading && !error && (data?.categories?.length ?? 0) > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="th">Name</th>
                  <th className="th">Description</th>
                  <th className="th">Created</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.categories ?? []).map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="td font-medium text-slate-900">{c.name}</td>
                    <td className="td text-slate-500">{c.description ?? '—'}</td>
                    <td className="td whitespace-nowrap text-slate-500">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        <button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600" onClick={() => openEdit(c)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => setConfirmDelete(c)} title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit category' : 'New category'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label" htmlFor="name">Name *</label>
            <input id="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="e.g. Quarterly Reports" />
          </div>
          <div>
            <label className="label" htmlFor="description">Description</label>
            <textarea id="description" rows={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} className="input" placeholder="Optional description" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save category'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete category"
        message={confirmDelete ? `Delete "${confirmDelete.name}"? Categories with documents cannot be deleted.` : ''}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </AppShell>
  );
}