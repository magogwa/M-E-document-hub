import { supabase } from '../libs/supabase.js';
import { AppError } from '../libs/errors.js';
import type { ClientRow, UserProfile } from '../types.js';

type AuthUser = { id: string; email: string };

const emailToUserId = new Map<string, string>();

export async function getProfileById(id: string): Promise<UserProfile | null> {
  const { data } = await supabase
    .from('users')
    .select('id, full_name, email, phone, role, status, created_at')
    .eq('id', id)
    .maybeSingle();
  return (data as UserProfile | null) ?? null;
}

/** Find auth user id by exact email (paginated, cached per boot). */
export async function findAuthUserByEmail(email: string): Promise<AuthUser | null> {
  const key = email.toLowerCase();
  if (emailToUserId.has(key)) {
    const cached = emailToUserId.get(key);
    if (cached) return { id: cached, email: key };
  }
  let page = 1;
  for (let i = 0; i < 10; i++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Could not look up users: ${error.message}`);
    for (const u of data.users ?? []) {
      emailToUserId.set(u.email!.toLowerCase(), u.id);
    }
    if ((data.users?.length ?? 0) < 1000) break;
    page += 1;
  }
  const id = emailToUserId.get(key);
  return id ? { id, email: key } : null;
}

export async function createAuthUser(input: {
  email: string;
  password: string;
  fullName: string;
}): Promise<AuthUser> {
  const { data, error } = await supabase.auth.admin.createUser({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
    phone_confirm: false
  });
  if (error) {
    if (error.message.toLowerCase().includes('already registered')) {
      throw AppError.conflict('An account with this email already exists.');
    }
    throw new Error(`Could not create account: ${error.message}`);
  }
  if (!data.user?.id) throw new Error('Could not create account. Please try again.');
  emailToUserId.set(input.email.trim().toLowerCase(), data.user.id);
  return { id: data.user.id, email: input.email.trim().toLowerCase() };
}

export async function getClientByUserId(userId: string): Promise<ClientRow | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as ClientRow | null) ?? null;
}

export async function ensureClientRow(userId: string): Promise<ClientRow> {
  const existing = await getClientByUserId(userId);
  if (existing) return existing;
  const { data, error } = await supabase
    .from('clients')
    .insert({ user_id: userId })
    .select('*')
    .single();
  if (error) throw new Error(`Could not initialize client profile: ${error.message}`);
  return data as ClientRow;
}

export async function countAdmins(): Promise<number> {
  const { count, error } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin');
  if (error) throw new Error(`Could not check administrators: ${error.message}`);
  return count ?? 0;
}