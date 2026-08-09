-- ============================================================================
-- M&E Document Hub - In-app notifications
-- Run in the Supabase SQL Editor (or via `supabase db push`).
-- ============================================================================

begin;

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  actor_id    uuid references public.users (id) on delete set null,
  type        text not null default 'document_upload' check (type in ('document_upload')),
  title       text not null,
  body        text,
  document_id uuid references public.documents (id) on delete cascade,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index notifications_user_idx   on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
create index notifications_doc_idx    on public.notifications (document_id);

alter table public.notifications enable row level security;

create policy notifications_select_own on public.notifications
  for select using (user_id = auth.uid());
create policy notifications_insert_own on public.notifications
  for insert with check (user_id = auth.uid());
create policy notifications_update_own on public.notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

commit;