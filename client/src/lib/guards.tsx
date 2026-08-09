import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Spinner } from '../components/ui';
import type { Role } from '../types';

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <Spinner label="Loading your workspace…" />
    </div>
  );
}

/** Requires an active session; redirects to /login when signed out. */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <Outlet />;
}

export function RequireRole({ role }: { role: Role }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (user.role !== role) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/client'} replace />;
  }
  return <Outlet />;
}