/**
 * One-time setup script:
 *   npm run setup
 *
 * Creates the private storage bucket and prints the status of prerequisites.
 * The database schema itself is applied through supabase/migrations/0001_init.sql.
 */
import { env } from '../config/env.js';
import { supabase } from '../libs/supabase.js';
import { ensureBucket } from '../services/storage.service.js';
import { countAdmins } from '../services/user.service.js';
import { getSettings } from '../services/settings.service.js';
import { logInfo } from '../libs/logger.js';

async function main() {
  logInfo('M&E Document Hub - setup');

  logInfo('Checking Supabase connection...');
  const { data, error } = await supabase.from('categories').select('count', { count: 'exact', head: true });
  if (error) {
    console.error('Could not reach Supabase:', error.message);
    console.error('Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in server/.env');
    process.exit(1);
  }
  logInfo('Supabase reachable. categories table accessible:', data);

  try {
    await ensureBucket();
    logInfo(`Storage bucket "${env.BUCKET_NAME}" exists and is private.`);
  } catch (err) {
    console.error('Bucket check failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const adminCount = await countAdmins();
  logInfo(`Admins in system: ${adminCount}`);
  if (adminCount === 0) {
    logInfo('No admin found. Call POST /api/auth/setup-admin with {email, fullName, password} (or set SETUP_ADMIN_EMAIL/SETUP_ADMIN_PASSWORD env vars).');
  }

  const settings = await getSettings();
  logInfo('Current settings:', JSON.stringify(settings));
  logInfo('Setup complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});