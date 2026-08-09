-- ============================================================================
-- M&E Document Hub - Comments, chat and client upload permissions
-- Run in the Supabase SQL Editor (or via `supabase db push`).
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- CLIENTS: per-client upload permission (granted on activation)
-- ---------------------------------------------------------------------------
alter table public.clients
  add column can_upload boolean not null default false;

comment on column public.clients.can_upload is
  'Whether this client is allowed to upload documents (granted automatically when the account is activated).';

-- ---------------------------------------------------------------------------
-- DOCUMENT_COMMENTS (everyone with access to the document can comment)
-- ---------------------------------------------------------------------------
create table public.document_comments (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  content     text not null check (char_length(content) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create index document_comments_doc_idx on public.document_comments (document_id, created_at asc);
create index document_comments_user_idx on public.document_comments (user_id);

-- ---------------------------------------------------------------------------
-- CONVERSATIONS (private 1:1 chats - participant_a < participant_b by uuid)
-- ---------------------------------------------------------------------------
create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  participant_a   uuid not null references public.users (id) on delete cascade,
  participant_b   uuid not null references public.users (id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (participant_a, participant_b),
  check (participant_a < participant_b)
);

create index conversations_participant_a_idx on public.conversations (participant_a, last_message_at desc);
create index conversations_participant_b_idx on public.conversations (participant_b, last_message_at desc);

-- ---------------------------------------------------------------------------
-- CHAT_MESSAGES
-- ---------------------------------------------------------------------------
create table public.chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.users (id) on delete cascade,
  content         text not null check (char_length(content) between 1 and 4000),
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index chat_messages_conversation_idx on public.chat_messages (conversation_id, created_at asc);
create index chat_messages_sender_idx on public.chat_messages (sender_id);

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table public.document_comments enable row level security;
alter table public.conversations      enable row level security;
alter table public.chat_messages      enable row level security;

-- Helper: is the session user one of the two conversation participants?
create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.conversations c
    where c.id = p_conversation_id
      and auth.uid() in (c.participant_a, c.participant_b)
  );
$$;

-- DOCUMENT_COMMENTS (defense-in-depth; the API enforces access itself)
create policy comments_select on public.document_comments
  for select using (
    public.is_admin() or public.has_document_access(document_id)
  );
create policy comments_insert on public.document_comments
  for insert with check (
    public.is_admin() or public.has_document_access(document_id)
  );
create policy comments_delete on public.document_comments
  for delete using (
    public.is_admin() or auth.uid() = user_id
  );

-- CONVERSATIONS (only participants can see their own chats)
create policy conversations_select on public.conversations
  for select using (auth.uid() in (participant_a, participant_b));
create policy conversations_insert on public.conversations
  for insert with check (
    auth.uid() in (participant_a, participant_b) and participant_a < participant_b
  );

-- CHAT_MESSAGES
create policy chat_messages_select on public.chat_messages
  for select using (public.is_conversation_participant(conversation_id));
create policy chat_messages_insert on public.chat_messages
  for insert with check (
    public.is_conversation_participant(conversation_id) and sender_id = auth.uid()
  );
create policy chat_messages_update on public.chat_messages
  for update using (public.is_conversation_participant(conversation_id))
  with check (public.is_conversation_participant(conversation_id));

commit;