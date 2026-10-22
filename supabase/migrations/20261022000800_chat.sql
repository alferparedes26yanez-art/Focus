-- Phase 2: chat per subject. Each assistant message keeps the citations it
-- used (only sources that were actually given to the model).

create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade
);

create index chat_threads_subject_id_idx on public.chat_threads (subject_id, updated_at desc);

create trigger chat_threads_set_updated_at before update on public.chat_threads
  for each row execute function public.set_updated_at();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  thread_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 20000),
  -- Explanation mode the answer was written in.
  mode text check (mode in ('simple', 'detailed', 'exam', 'tutor')),
  -- [{ n, chunk_id, material_id, title, kind, page, start_seconds, section, source_url }]
  citations jsonb not null default '[]'::jsonb check (jsonb_typeof(citations) = 'array'),
  used_general_knowledge boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (thread_id, user_id) references public.chat_threads (id, user_id) on delete cascade
);

create index messages_thread_id_idx on public.messages (thread_id, created_at);

alter table public.chat_threads enable row level security;
alter table public.messages enable row level security;

create policy "chat_threads_select_own" on public.chat_threads for select to authenticated
  using (user_id = (select auth.uid()));
create policy "chat_threads_insert_own" on public.chat_threads for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "chat_threads_update_own" on public.chat_threads for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "chat_threads_delete_own" on public.chat_threads for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "messages_select_own" on public.messages for select to authenticated
  using (user_id = (select auth.uid()));
create policy "messages_insert_own" on public.messages for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "messages_delete_own" on public.messages for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.chat_threads to authenticated;
grant select, insert, delete on public.messages to authenticated;
grant all on public.chat_threads, public.messages to service_role;
