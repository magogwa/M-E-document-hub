import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, UserCheck, UserX, Users } from 'lucide-react';
import { client } from '../../lib/api';
import { useData } from '../../hooks/useData';
import { formatDate } from '../../lib/format';
import { AppShell } from '../../components/layout/AppShell';
import { Badge, ConfirmDialog, EmptyState, ErrorState, Modal, PageHeader, Spinner, StatusBadge } from '../../components/ui';
import type { AdminClient } from '../../types';

export function AdminClientsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminClient | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<{ client: AdminClient; status: 'active' | 'inactive' } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmActivateAll, setConfirmActivateAll] = useState(false);
  const [activatingAll, setActivatingAll] = useState(false);

  const { data, loading, error, reload } = useData(
    () => client.get<{ clients: AdminClient[] }>('/clients'),
    []
  );

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    organization: '',
    address: '',
    phone: ''
  });

  function openCreate() {
    setEditing(null);
    setForm({ fullName: '', email: '', password: '', organization: '', address: '', phone: '' });
    setModalOpen(true);
  }

  function openEdit(client: AdminClient) {
    setEditing(client);
    setForm({
      fullName: client.profile?.full_name ?? '',
      email: client.profile?.email ?? '',
      password: '',
      organization: client.organization ?? '',
      address: client.address ?? '',
      phone: client.phone ?? ''
    });
    setModalOpen(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await client.patch(`/clients/${editing.id}`, {
          fullName: form.fullName,
          organization: form.organization,
          address: form.address,
          phone: form.phone
        });
        toast.success('Client updated.');
      } else {
        await client.post('/clients', form);
        toast.success('Client account created. The client can now sign in.');
      }
      setModalOpen(false);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the client.');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange() {
    if (!confirmStatus) return;
    setBusyId(confirmStatus.client.id);
    try {
      await client.post(`/clients/${confirmStatus.client.id}/status`, { status: confirmStatus.status });
      toast.success(confirmStatus.status === 'active' ? 'Client activated.' : 'Client deactivated.');
      setConfirmStatus(null);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update client status.');
    } finally {
      setBusyId(null);
    }
  }

  const pendingCount = (data?.clients ?? []).filter((c) => c.profile?.status === 'pending').length;

  async function handleActivateAll() {
    setActivatingAll(true);
    try {
      const json = await client.post<{ activated: number }>('/clients/activate-all');
      toast.success(`${json.activated} pending client(s) activated.`);
      setConfirmActivateAll(false);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not activate clients.');
    } finally {
      setActivatingAll(false);
    }
  }

  return (
    <AppShell role="admin">
      <PageHeader
        title="Clients"
        subtitle="Create and manage client accounts. Only active clients can sign in and see shared documents."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {pendingCount > 0 && (
              <button
                type="button"
                className="btn-secondary"
                disabled={activatingAll}
                onClick={() => setConfirmActivateAll(true)}
                title="Activate every client that is still pending"
              >
                <Users className="h-4 w-4" /> Activate all ({pendingCount})
              </button>
            )}
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus className="h-4 w-4" /> New client
            </button>
          </div>
        }
      />

      {loading && <Spinner />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (data?.clients?.length ?? 0) === 0 && (
        <div className="card">
          <EmptyState
            title="No clients yet"
            description="Create your first client account so you can share documents with them."
            action={<button type="button" className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> Add client</button>}
          />
        </div>
      )}

      {!loading && !error && (data?.clients?.length ?? 0) > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="th">Client</th>
                  <th className="th">Organization</th>
                  <th className="th">Status</th>
                  <th className="th">Docs</th>
                  <th className="th">Last login</th>
                  <th className="th">Created</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.clients ?? []).map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="td">
                      <p className="font-medium text-slate-900">{c.profile?.full_name ?? '—'}</p>
                      <p className="text-xs text-slate-500">{c.profile?.email}</p>
                    </td>
                    <td className="td text-slate-600">{c.organization ?? '—'}</td>
                    <td className="td"><StatusBadge status={c.profile?.status ?? 'inactive'} /></td>
                    <td className="td"><Badge tone="blue">{c.access_count}</Badge></td>
                    <td className="td whitespace-nowrap text-slate-500">{c.last_login ? formatDate(c.last_login) : 'Never'}</td>
                    <td className="td whitespace-nowrap text-slate-500">{formatDate(c.created_at)}</td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        {c.profile?.status === 'active' ? (
                          <button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600" title="Deactivate" disabled={busyId === c.id} onClick={() => setConfirmStatus({ client: c, status: 'inactive' })}>
                            <UserX className="h-4 w-4" />
                          </button>
                        ) : (
                          <button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-green-50 hover:text-green-600" title="Activate" disabled={busyId === c.id} onClick={() => setConfirmStatus({ client: c, status: 'active' })}>
                            <UserCheck className="h-4 w-4" />
                          </button>
                        )}
                        <button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600" title="Edit" onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete" disabled={!c.profile} onClick={() => toast('Deleting client accounts is not supported. Deactivate instead.', { icon: 'ℹ️' })}>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit client' : 'New client account'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label" htmlFor="fullName">Full name *</label>
            <input id="fullName" required maxLength={120} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="input" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="email">Email *</label>
              <input id="email" type="email" required disabled={!!editing} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="password">{editing ? 'Password (kept)' : 'Temp password *'}</label>
              <input id="password" type="password" required={!editing} minLength={8} disabled={!!editing} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" placeholder="min 8 characters" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="organization">Organization</label>
              <input id="organization" maxLength={200} value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="phone">Phone</label>
              <input id="phone" maxLength={40} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="address">Address</label>
            <textarea id="address" rows={2} maxLength={500} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create client'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmActivateAll}
        title="Activate all pending clients"
        message={`${pendingCount} client(s) are currently pending. They will be able to sign in and access shared documents immediately.`}
        confirmLabel={`Activate ${pendingCount}`}
        loading={activatingAll}
        onConfirm={handleActivateAll}
        onCancel={() => setConfirmActivateAll(false)}
      />

      <ConfirmDialog
        open={confirmStatus !== null}
        title={confirmStatus?.status === 'active' ? 'Activate client' : 'Deactivate client'}
        message={
          confirmStatus?.status === 'active'
            ? `${confirmStatus?.client.profile?.full_name} will be able to sign in and access shared documents.`
            : `${confirmStatus?.client.profile?.full_name} will be locked out immediately. Their shared documents remain preserved.`
        }
        confirmLabel={confirmStatus?.status === 'active' ? 'Activate' : 'Deactivate'}
        danger={confirmStatus?.status !== 'active'}
        loading={busyId !== null}
        onConfirm={handleStatusChange}
        onCancel={() => setConfirmStatus(null)}
      />
    </AppShell>
  );
}