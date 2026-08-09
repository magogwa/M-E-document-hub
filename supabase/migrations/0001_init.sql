-- ============================================================================
-- M&E Document Hub - Initial schema
-- Run this in the Supabase SQL Editor (or via `supabase db push`) on a NEW project.
-- ============================================================================

begin;

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- USERS (profiles mirroring auth.users - holds app-level role + status)
-- ---------------------------------------------------------------------------
create table public.users (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null,
  email      text not null,
  phone      text,
  role       text not null default 'client' check (role in ('admin', 'client')),
  status     text not null default 'pending' check (status in ('active', 'pending', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index users_email_idx on public.users (email);
create index users_role_idx  on public.users (role);

-- ---------------------------------------------------------------------------
-- CLIENTS (extra profile data for users with role = 'client')
-- ---------------------------------------------------------------------------
create table public.clients (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null unique references public.users (id) on delete cascade,
  organization text,
  address      text,
  phone        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index clients_user_id_idx on public.clients (user_id);

-- ---------------------------------------------------------------------------
-- CATEGORIES
-- ---------------------------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- DOCUMENTS (current version only; history lives in document_versions)
-- ---------------------------------------------------------------------------
create table public.documents (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  file_name   text not null,
  file_url    text not null,
  file_type   text not null,
  file_size   bigint not null check (file_size >= 0),
  category_id uuid references public.categories (id) on delete set null,
  uploaded_by uuid not null references public.users (id),
  version     integer not null default 1 check (version >= 1),
  status      text not null default 'active' check (status in ('active', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index documents_category_idx   on public.documents (category_id);
create index documents_uploadedby_idx on public.documents (uploaded_by);
create index documents_status_idx     on public.documents (status);
create index documents_created_idx    on public.documents (created_at desc);
create index documents_title_trgm     on public.documents using gin (title gin_trgm_ops);
create index documents_desc_trgm      on public.documents using gin (description gin_trgm_ops);
create index documents_filename_trgm  on public.documents using gin (file_name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- DOCUMENT_VERSIONS (version history - every upload snapshot)
-- ---------------------------------------------------------------------------
create table public.document_versions (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  version     integer not null,
  file_name   text not null,
  file_url    text not null,
  file_type   text not null,
  file_size   bigint not null check (file_size >= 0),
  uploaded_by uuid not null references public.users (id),
  created_at  timestamptz not null default now(),
  unique (document_id, version)
);

create index document_versions_doc_idx on public.document_versions (document_id, version desc);

-- ---------------------------------------------------------------------------
-- DOCUMENT_ACCESS (which client can see which document)
-- ---------------------------------------------------------------------------
create table public.document_access (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  client_id   uuid not null references public.clients (id) on delete cascade,
  granted_by  uuid not null references public.users (id),
  granted_at  timestamptz not null default now(),
  unique (document_id, client_id)
);

create index document_access_client_idx on public.document_access (client_id);
create index document_access_doc_idx    on public.document_access (document_id);

-- ---------------------------------------------------------------------------
-- ACTIVITY_LOGS
-- ---------------------------------------------------------------------------
create table public.activity_logs (
  id          bigserial primary key,
  user_id     uuid references public.users (id) on delete set null,
  document_id uuid references public.documents (id) on delete set null,
  action      text not null,
  metadata    jsonb,
  timestamp   timestamptz not null default now(),
  ip_address  text
);

create index activity_logs_user_idx     on public.activity_logs (user_id);
create index activity_logs_document_idx on public.activity_logs (document_id);
create index activity_logs_time_idx     on public.activity_logs (timestamp desc);
create index activity_logs_action_idx   on public.activity_logs (action);

-- ---------------------------------------------------------------------------
-- PASSWORD_RESETS (self-managed secure reset tokens)
-- ---------------------------------------------------------------------------
create table public.password_resets (
  token      text primary key,
  email      text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index password_resets_email_idx on public.password_resets (email);

-- ---------------------------------------------------------------------------
-- APP_SETTINGS (runtime-configurable features, no code deploy needed)
-- ---------------------------------------------------------------------------
create table public.app_settings (
  key   text primary key,
  value jsonb not null
);

insert into public.app_settings (key, value) values
  ('appName',                 '"M&E Document Hub"'),
  ('allowClientUpload',       'false'),
  ('allowClientRegistration', 'true'),
  ('maxFileSizeMB',           '25'),
  ('emailNotifications',      'true'),
  ('storageLimitMB',          '0')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- TRIGGERS
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_updated_at     before update on public.users     for each row execute function public.set_updated_at();
create trigger clients_updated_at   before update on public.clients   for each row execute function public.set_updated_at();
create trigger documents_updated_at before update on public.documents for each row execute function public.set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.users            enable row level security;
alter table public.clients          enable row level security;
alter table public.categories       enable row level security;
alter table public.documents        enable row level security;
alter table public.document_versions enable row level security;
alter table public.document_access  enable row level security;
alter table public.activity_logs    enable row level security;
alter table public.password_resets  enable row level security;
alter table public.app_settings     enable row level security;

-- Helper: is the current session an active admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin' and u.status = 'active'
  );
$$;

-- Helper: does the current client user have access to a document?
create or replace function public.has_document_access(p_document_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.document_access da
    join public.clients c on c.id = da.client_id
    where da.document_id = p_document_id and c.user_id = auth.uid()
  );
$$;

-- USERS
create policy users_select_own_or_admin on public.users
  for select using (auth.uid() = id or public.is_admin());
create policy users_insert_own on public.users
  for insert with check (auth.uid() = id);
create policy users_update_own_or_admin on public.users
  for update using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());
create policy users_delete_admin on public.users
  for delete using (public.is_admin());

-- CLIENTS
create policy clients_select_own_or_admin on public.clients
  for select using (
    public.is_admin() or exists (
      select 1 from public.users u where u.id = auth.uid() and u.id = clients.user_id
    )
  );
create policy clients_write_admin on public.clients
  for all using (public.is_admin()) with check (public.is_admin());

-- CATEGORIES
create policy categories_read_authenticated on public.categories
  for select using (auth.role() = 'authenticated');
create policy categories_write_admin on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

-- DOCUMENTS
create policy documents_select on public.documents
  for select using (
    public.is_admin()
    or (status = 'active' and public.has_document_access(id))
  );
create policy documents_write_admin on public.documents
  for all using (public.is_admin()) with check (public.is_admin());

-- DOCUMENT_VERSIONS
create policy versions_select on public.document_versions
  for select using (
    public.is_admin() or public.has_document_access(document_id)
  );
create policy versions_write_admin on public.document_versions
  for all using (public.is_admin()) with check (public.is_admin());

-- DOCUMENT_ACCESS
create policy access_select on public.document_access
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.clients c
      where c.id = document_access.client_id and c.user_id = auth.uid()
    )
  );
create policy access_write_admin on public.document_access
  for all using (public.is_admin()) with check (public.is_admin());

-- ACTIVITY_LOGS (admins only; service role writes from the API server)
create policy activity_select_admin on public.activity_logs
  for select using (public.is_admin());

-- APP_SETTINGS (admins only)
create policy settings_select_admin on public.app_settings
  for select using (public.is_admin());
create policy settings_write_admin on public.app_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- SERVICE_ROLE bypasses RLS by default; password_resets stays fully server-side.
revoke all on public.password_resets from anon, authenticated;

-- ---------------------------------------------------------------------------
-- STORAGE: allow the server to manage files in the private "documents" bucket.
-- Required on modern Supabase projects (new-style keys honor RLS for storage).
-- ---------------------------------------------------------------------------
create policy documents_bucket_manage_sr on storage.objects
  for all to service_role
  using (bucket_id = 'documents')
  with check (bucket_id = 'documents');

create policy documents_bucket_manage_auth on storage.objects
  for all to authenticated
  using (bucket_id = 'documents')
  with check (bucket_id = 'documents');

commit;