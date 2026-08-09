import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { KeyRound } from 'lucide-react';
import { client } from '../../lib/api';
import { AuthShell, ErrorAlert, InfoAlert } from './AuthShell';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await client.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset link. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <AuthShell title="Check your inbox" subtitle="Password reset instructions sent">
        <InfoAlert message="If an account exists for that email address, a secure password reset link has been sent. The link expires after 1 hour." />
        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Back to sign in
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Reset your password" subtitle="We will email you a secure reset link">
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <ErrorAlert message={error} />}
        <div>
          <label className="label" htmlFor="email">Email address</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="you@organization.org" />
        </div>
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          <KeyRound className="h-4 w-4" />
          {submitting ? 'Sending link…' : 'Send reset link'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Remembered your password?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}