import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

export const supabase: SupabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Auth-only client. The main `supabase` client must never hold a user
 * session, otherwise every query it runs would be scoped by that user's
 * RLS context (new-style Supabase keys honor RLS, no bypass). Keeping
 * sign-in/refresh sessions on this dedicated client means DB queries
 * always run with the service key.
 */
export const authSupabase: SupabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});