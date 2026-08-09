import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { client } from '../lib/api';
import { AppShell } from '../components/layout/AppShell';
import { PageHeader, Spinner } from '../components/ui';

export function ProfilePage() {
  const { user } = useAuth();
  const role = user?.role ?? 'admin';

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('The new password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    setChanging(true);
    try {
      await client.post('/auth/change-password', { currentPassword, newPassword });
      toast.success('Password updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not change the password');
    } finally {
      setChanging(false);
    }
  }

  return (
    <AppShell role={role}>
      <PageHeader title="Profile" subtitle="Your account details and security settings." />

      {!user ? (
        <Spinner label="Loading profile…" />
      ) : (
        <div className="grid max-w-3xl gap-5 lg:grid-cols-2">
          <div className="card">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Account details</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-medium text-slate-500">Name</p>
                <p className="font-medium text-slate-800">{user.full_name || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Email</p>
                <p className="font-medium text-slate-800">{user.email}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Role</p>
                <p className="capitalize font-medium text-slate-800">{user.role}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="card space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Change password</h2>
            <div>
              <label className="label" htmlFor="current-password">Current password</label>
              <input id="current-password" type="password" required autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="new-password">New password</label>
              <input id="new-password" type="password" required minLength={8} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="confirm-password">Confirm new password</label>
              <input id="confirm-password" type="password" required autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input" />
            </div>
            <button type="submit" className="btn-primary" disabled={changing}>
              <KeyRound className="h-4 w-4" /> {changing ? 'Changing…' : 'Change password'}
            </button>
          </form>
        </div>
      )}
    </AppShell>
  );
}