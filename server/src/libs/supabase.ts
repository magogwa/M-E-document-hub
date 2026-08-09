import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

export const supabase: SupabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});