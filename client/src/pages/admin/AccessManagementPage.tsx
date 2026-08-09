import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { Trash2, UserPlus, Users } from 'lucide-react';
import { client } from '../../lib/api';
import { useData } from '../../hooks/useData';
import { formatDateTime } from '../../lib/format';
import { AppShell } from '../../components/layout/AppShell';
import { ConfirmDialog, EmptyState, ErrorState, PageHeader, Spinner, StatusBadge } from '../../components/ui';
import type { AccessGrantItem, AdminClient, DocumentItem } from '../../types';

export function AdminAccessManagementPage() {
  const [searchParams] = useSearchParams();
  const initialDocumentId = searchParams.get('documentId') ?? '';

  const [documentId, setDocumentId] = useState(initialDocumentId);
  const [selected, setSelected] = useState<string[]>([]);
  const [granting, setGranting] = useState(false);
  const [grantAll, setGrantAll] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const { data: docs } = useData(() => client.get<{ items: DocumentItem[] }>('/documents?limit=100'), []);
  const { data: clients } = useData(() => client.get<{ clients: AdminClient[] }>('/clients'), []);
  const { data: grants, loading, error, reload } = useData(
    () => client.get<{ items: AccessGrantItem[] }>(`/access${documentId ? `?documentId=${documentId}` : ''}`),
    [documentId]
  );

  const eligibleClients = useMemo(
    () => (clients?.clients ?? []).filter((c) => c.profile?.status === 'active'),
    [clients]
  );

  async function handleGrant() {
    if (!documentId || selected.length === 0) {
      toast.error('Select a document and at least one client.');
      return;
    }
    setGranting(true);
    try {
      const json = await client.post<{ granted: string[] }>('/access', {
        documentId,
        clientIds: selected
      });
      toast.success(`Access granted to ${json.granted.length} client(s).`);
      setSelected([]);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not grant access.');
    } finally {
      setGranting(false);
    }
  }

  async function handleGrantAll() {
    if (!documentId) return;
    setGranting(true);
    try {
      const json = await client.post<{ granted: string[] }>('/access', {
        documentId,
        grantToAll: true
      });
      toast.success(`Access granted to all active clients (${json.granted.length}).`);
      setSelected([]);
      setGrantAll(false);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not grant access.');
    } finally {
      setGranting(false);
    }
  }

  async function handleRevoke() {
    if (!revokeId) return;
    try {
      await client.delete(`/access/${revokeId}`);
      toast.success('Access removed.');
      setRevokeId(null);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove access.');
    }
  }

  return (
    <AppShell role="admin">
      <PageHeader
        title="Access Management"
        subtitle="Share documents with clients and revoke access at any time. Clients receive email notifications when access is granted."
      />

      <div className="card mb-5 space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className="label" htmlFor="doc-select">1 · Choose a document</label>
            <select id="doc-select" value={documentId} onChange={(e) => setDocumentId(e.target.value)} className="input">
              <option value="">Select a document…</option>
              {(docs?.items ?? []).map((d) => (
                <option key={d.id} value={d.id}>{d.title} (v{d.version})</option>
              ))}
            </select>
          </div>
          <div>
            <span className="label">2 · Select clients to share with</span>
            {eligibleClients.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                No active clients available. Create or activate clients first.
              </p>
            ) : (
              <div className="grid max-h-36 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-2">
                {eligibleClients.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-brand-600"
                      checked={selected.includes(c.id)}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                        )
                      }
                    />
                    <span className="truncate">{c.profile?.full_name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary" disabled={granting || !documentId || selected.length === 0} onClick={handleGrant}>
            <UserPlus className="h-4 w-4" />
            {granting ? 'Granting…' : `Grant access${selected.length ? ` (${selected.length} client${selected.length > 1 ? 's' : ''})` : ''}`}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={granting || !documentId || eligibleClients.length === 0}
            onClick={() => setGrantAll(true)}
          >
            <Users className="h-4 w-4" />
            Grant to all clients ({eligibleClients.length})
          </button>
        </div>
      </div>

      {loading && <Spinner />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (grants?.items?.length ?? 0) === 0 && (
        <div className="card">
          <EmptyState
            title="No access grants found"
            description="Select a document above to review or manage who can access it."
          />
        </div>
      )}

      {!loading && !error && (grants?.items?.length ?? 0) > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="th">Document</th>
                  <th className="th">Client</th>
                  <th className="th">Status</th>
                  <th className="th">Granted</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(grants?.items ?? []).map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50">
                    <td className="td">
                      <p className="font-medium text-slate-900">{g.document_title}</p>
                      <p className="text-xs text-slate-500">{g.document_id.slice(0, 8)}</p>
                    </td>
                    <td className="td">
                      <p className="text-slate-800">{g.client_name || g.client_org || 'Client'}</p>
                      <p className="text-xs text-slate-500">{g.client_email}</p>
                    </td>
                    <td className="td"><StatusBadge status={g.client_status || 'active'} /></td>
                    <td className="td whitespace-nowrap text-slate-500">{formatDateTime(g.granted_at)}</td>
                    <td className="td">
                      <div className="flex justify-end">
                        <button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Remove access" onClick={() => setRevokeId(g.id)}>
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

      <ConfirmDialog
        open={grantAll}
        title="Share with all clients"
        message={`Every active client (${eligibleClients.length}) will immediately be granted access to this document. You can still remove individual clients afterwards.`}
        confirmLabel="Grant to all"
        onConfirm={handleGrantAll}
        onCancel={() => setGrantAll(false)}
      />

      <ConfirmDialog
        open={revokeId !== null}
        title="Remove access"
        message="The client will immediately lose access to this document and its versions."
        confirmLabel="Remove"
        danger
        onConfirm={handleRevoke}
        onCancel={() => setRevokeId(null)}
      />
    </AppShell>
  );
}