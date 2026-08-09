import { supabase } from '../libs/supabase.js';
import { env } from '../config/env.js';
import type { AppSettings } from '../types.js';

const DEFAULTS: AppSettings = {
  appName: env.APP_NAME,
  allowClientUpload: false,
  allowClientRegistration: true,
  maxFileSizeMB: env.MAX_FILE_SIZE_MB,
  emailNotifications: true,
  storageLimitMB: 0
};

export async function getSettings(): Promise<AppSettings> {
  const { data, error } = await supabase.from('app_settings').select('key, value');
  if (error) throw new Error(`Could not load settings: ${error.message}`);
  const stored = new Map<string, unknown>();
  for (const row of data ?? []) stored.set(row.key, row.value);

  return {
    appName: String(stored.get('appName') ?? DEFAULTS.appName),
    allowClientUpload: Boolean(stored.get('allowClientUpload') ?? DEFAULTS.allowClientUpload),
    allowClientRegistration: Boolean(stored.get('allowClientRegistration') ?? DEFAULTS.allowClientRegistration),
    maxFileSizeMB: Number(stored.get('maxFileSizeMB') ?? DEFAULTS.maxFileSizeMB),
    emailNotifications: Boolean(stored.get('emailNotifications') ?? DEFAULTS.emailNotifications),
    storageLimitMB: Number(stored.get('storageLimitMB') ?? DEFAULTS.storageLimitMB)
  };
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const next: AppSettings = { ...current, ...patch };
  await supabase
    .from('app_settings')
    .upsert(
      [
        { key: 'appName', value: next.appName },
        { key: 'allowClientUpload', value: next.allowClientUpload },
        { key: 'allowClientRegistration', value: next.allowClientRegistration },
        { key: 'maxFileSizeMB', value: next.maxFileSizeMB },
        { key: 'emailNotifications', value: next.emailNotifications },
        { key: 'storageLimitMB', value: next.storageLimitMB }
      ],
      { onConflict: 'key' }
    );
  return next;
}