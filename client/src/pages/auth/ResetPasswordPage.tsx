import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ShieldCheck } from 'lucide-react';
import { client } from '../../lib/api';
import { AuthShell, ErrorAlert } from './AuthShell';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const email = params.get('email') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await client.post('/auth/reset-password', { token, email, newPassword: password });
      toast.success('Password updated. You can now sign in.');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password. Please try again.');
      setSubmitting(false);
    }
  }

  if (!token || !email) {
    return (
      <AuthShell title="Invalid link" subtitle="This reset link is incomplete">
        <ErrorAlert message="The password reset link is invalid or incomplete. Please request a new one." />
        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/forgot-password" className="font-medium text-brand-600 hover:text-brand-700">
            Request a new link
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="For the account you verified by email">
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <ErrorAlert message={error} />}
        <div>
          <label className="label" htmlFor="password">New password</label>
          <input id="password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="At least 8 characters" />
        </div>
        <div>
          <label className="label" htmlFor="confirm">Confirm new password</label>
          <input id="confirm" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input" placeholder="Repeat new password" />
        </div>
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          <ShieldCheck className="h-4 w-4" />
          {submitting ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </AuthShell>
  );
}