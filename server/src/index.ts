import { createApp } from './app.js';
import { env } from './config/env.js';
import { supabase } from './libs/supabase.js';
import { ensureBucket } from './services/storage.service.js';
import { createAuthUser, countAdmins } from './services/user.service.js';
import { logActivity } from './services/activity.service.js';
import { logError, logInfo } from './libs/logger.js';

async function ensureDefaultAdmin() {
  if (!env.SETUP_ADMIN_EMAIL || !env.SETUP_ADMIN_PASSWORD) return;
  try {
    const adminCount = await countAdmins();
    if (adminCount > 0) return;
    const account = await createAuthUser({
      email: env.SETUP_ADMIN_EMAIL,
      password: env.SETUP_ADMIN_PASSWORD,
      fullName: 'Administrator'
    });
    await supabase
      .from('users')
      .update({ role: 'admin', status: 'active', full_name: 'Administrator' })
      .eq('id', account.id);
    await logActivity({
      userId: account.id,
      action: 'admin_created',
      metadata: { via: 'bootstrap' }
    });
    logInfo(`Default admin created for ${env.SETUP_ADMIN_EMAIL}`);
  } catch (err) {
    logError('Failed to create default admin:', err);
  }
}

async function main() {
  try {
    await ensureBucket();
    logInfo(`Storage bucket "${env.BUCKET_NAME}" is ready.`);
  } catch (err) {
    logError('Storage setup failed (continuing):', err instanceof Error ? err.message : err);
  }

  try {
    await ensureDefaultAdmin();
  } catch (err) {
    logError('Admin bootstrap failed (continuing):', err);
  }

  const app = createApp();
  app.listen(env.PORT, () => {
    logInfo(`M&E Document Hub API listening on http://localhost:${env.PORT}`);
  });
}

main();