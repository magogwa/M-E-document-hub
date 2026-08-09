import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { AuthShell, ErrorAlert, InfoAlert } from './AuthShell';

export function RegisterPage() {
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      await register({ fullName, email, phone, password });
      setDone(true);
      toast.success('Account created.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <AuthShell title="Request received" subtitle="Approval required before you can sign in">
        <InfoAlert message="Your account has been created. An administrator will approve your access; you will receive an email when it is ready. Please wait for the approval before signing in." />
        <p className="mt-6 text-center text-sm text-slate-500">
          Back to{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
            sign in
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Request member access" subtitle="Create an account to view shared documents">
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <ErrorAlert message={error} />}
        <div>
          <label className="label" htmlFor="fullName">Full name</label>
          <input id="fullName" type="text" required maxLength={120} value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" placeholder="Jane Doe" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email address</label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="you@organization.org" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone (optional)</label>
          <input id="phone" type="tel" maxLength={40} value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="+254 700 000 000" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="At least 8 characters" />
        </div>
        <div>
          <label className="label" htmlFor="confirm">Confirm password</label>
          <input id="confirm" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input" placeholder="Repeat password" />
        </div>
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          <UserPlus className="h-4 w-4" />
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Already registered?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}