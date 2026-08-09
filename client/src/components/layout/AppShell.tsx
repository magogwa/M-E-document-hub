import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  LayoutDashboard,
  FileText,
  UploadCloud,
  FolderOpen,
  Users,
  Share2,
  ClipboardList,
  Settings as SettingsIcon,
  LogOut,
  Folder,
  Clock,
  UserCircle,
  Menu,
  X,
  BarChart,
  MessageSquare,
  Bell
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { client } from '../../lib/api';
import { initials } from '../../lib/format';
import type { Role } from '../../types';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/documents', label: 'Documents', icon: FileText },
  { to: '/admin/upload', label: 'Upload Document', icon: UploadCloud },
  { to: '/admin/categories', label: 'Categories', icon: Folder },
  { to: '/admin/clients', label: 'Members', icon: Users },
  { to: '/admin/access', label: 'Access Management', icon: Share2 },
  { to: '/admin/activity', label: 'Activity Logs', icon: BarChart },
  { to: '/admin/chat', label: 'Chat', icon: MessageSquare },
  { to: '/admin/settings', label: 'Settings', icon: SettingsIcon }
];

const CLIENT_NAV: NavItem[] = [
  { to: '/client', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/client/documents', label: 'My Documents', icon: FileText },
  { to: '/client/upload', label: 'Upload Document', icon: UploadCloud },
  { to: '/client/categories', label: 'Categories', icon: Folder },
  { to: '/client/recent', label: 'Recent Documents', icon: Clock },
  { to: '/client/chat', label: 'Chat', icon: MessageSquare },
  { to: '/profile', label: 'Profile', icon: UserCircle }
];

export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const refresh = () => {
      client
        .get<{ count: number }>('/notifications/unread-count')
        .then((json) => {
          if (alive) setUnread(json.count);
        })
        .catch(() => undefined);
    };
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [user]);

  const nav = role === 'admin' ? ADMIN_NAV : CLIENT_NAV;
  const base = role === 'admin' ? '/admin' : '/client';

  async function handleLogout() {
    await logout();
    toast.success('Signed out successfully.');
    navigate('/login');
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-slate-900">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
          <FileText className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">M&E Document Hub</p>
          <p className="text-xs text-slate-400">{role === 'admin' ? 'Administrator' : 'Member Portal'}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === base}
            className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
            {user ? initials(user.full_name) : '?'}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium text-white">{user?.full_name}</p>
            <p className="truncate text-xs text-slate-400">{user?.email}</p>
          </div>
          <button type="button" onClick={handleLogout} title="Logout" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <aside className="hidden w-64 shrink-0 md:block">{sidebar}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72">{sidebar}</aside>
          <button
            type="button"
            className="absolute right-4 top-4 rounded-lg bg-white/10 p-2 text-white"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-900">
                {role === 'admin' ? 'Administrator Dashboard' : 'Member Dashboard'}
              </p>
              <p className="hidden text-xs text-slate-500 sm:block">Secure Document Management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/notifications')}
              title="Notifications"
              className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-brand-600"
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>
            <span className="hidden rounded-full bg-brand-50 px-3 py-1 text-xs font-medium capitalize text-brand-700 sm:block">
              {role === 'admin' ? 'Admin' : 'Member'}
            </span>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100 md:hidden"
              onClick={() => navigate('/profile')}
            >
              <UserCircle className="h-5 w-5 text-slate-500" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}