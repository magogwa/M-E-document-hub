import { useEffect, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { Moon, Save, Sun } from 'lucide-react';
import { client } from '../../lib/api';
import { useData } from '../../hooks/useData';
import { AppShell } from '../../components/layout/AppShell';
import { ErrorState, PageHeader, Spinner } from '../../components/ui';
import type { Settings } from '../../types';

type Theme = 'light' | 'dark';

const THEME_KEY = 'mehub.theme';

function readTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function AdminSettingsPage() {
  const { data, loading, error, reload } = useData(
    () => client.get<{ settings: Settings }>('/settings'),
    []
  );
  const [form, setForm] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState<Theme>(readTheme);
  const current = form ?? data?.settings;

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!current) return;
    setSaving(true);
    try {
      const json = await client.put<{ settings: Settings }>('/settings', current);
      setForm(json.settings);
      toast.success('Settings saved. They apply immediately.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell role="admin">
      <PageHeader title="Settings" subtitle="Runtime configuration - changes apply immediately without a redeploy." />

      {loading && <Spinner />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && current && (
        <form onSubmit={handleSave} className="max-w-2xl space-y-5">
          <div className="card space-y-4">
            <div>
              <label className="label" htmlFor="appName">Application name</label>
              <input id="appName" maxLength={80} value={current.appName} onChange={(e) => setForm({ ...current, appName: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="maxFileSizeMB">Maximum upload size (MB)</label>
              <input id="maxFileSizeMB" type="number" min={1} max={200} value={current.maxFileSizeMB} onChange={(e) => setForm({ ...current, maxFileSizeMB: Number(e.target.value) })} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="storageLimitMB">Storage limit (MB, 0 = unlimited)</label>
              <input id="storageLimitMB" type="number" min={0} value={current.storageLimitMB} onChange={(e) => setForm({ ...current, storageLimitMB: Number(e.target.value) })} className="input" />
            </div>
          </div>

          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">Theme</p>
                <p className="mt-0.5 text-xs text-slate-500">Switch between light and dark appearance. Saved on this browser.</p>
              </div>
              <div className="flex shrink-0 gap-1 rounded-lg border border-slate-200 p-1">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${theme === 'light' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Sun className="h-3.5 w-3.5" /> Light
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${theme === 'dark' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Moon className="h-3.5 w-3.5" /> Dark
                </button>
              </div>
            </div>
          </div>

          <div className="card space-y-3">
            <ToggleRow
              title="Client registration"
              description="Allow new clients to create accounts themselves. Otherwise only you can create clients."
              checked={current.allowClientRegistration}
              onChange={(v) => setForm({ ...current, allowClientRegistration: v })}
            />
            <ToggleRow
              title="Client document uploads"
              description="Allow clients to upload documents (visible only to themselves)."
              checked={current.allowClientUpload}
              onChange={(v) => setForm({ ...current, allowClientUpload: v })}
            />
            <ToggleRow
              title="Email notifications"
              description="Send clients an email when documents are shared with them (requires EMAIL_API_KEY)."
              checked={current.emailNotifications}
              onChange={(v) => setForm({ ...current, emailNotifications: v })}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save settings'}
          </button>
        </form>
      )}
    </AppShell>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-slate-800">{title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand-600' : 'bg-slate-200'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}