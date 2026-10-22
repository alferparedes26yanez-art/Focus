-- Phase 2: material library and its semantic index.
--
-- Every material belongs to one subject and, optionally, to one of its topics
-- (the syllabus is the backbone that organizes everything). Its text is split
-- into chunks with an embedding, a page/slide/second/section and the material
-- they come from, so answers can cite exactly where something is.

create extension if not exists vector with schema extensions;

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null,
  topic_id uuid,
  -- user: chosen by the student · ai: suggested by the AI · general: whole
  -- subject on purpose · pending: waiting for the AI to classify it
  topic_source text not null default 'pending'
    check (topic_source in ('user', 'ai', 'general', 'pending')),
  kind text not null check (kind in ('pdf', 'docx', 'pptx', 'images', 'web', 'youtube')),
  title text not null check (char_length(btrim(title)) between 1 and 300),
  is_syllabus boolean not null default false,
  storage_bucket text not null default 'materials' check (storage_bucket in ('materials', 'syllabi')),
  -- [{ path, name, mime_type, size }] (several only for a set of photos)
  files jsonb not null default '[]'::jsonb check (jsonb_typeof(files) = 'array'),
  source_url text check (char_length(source_url) <= 2000),
  -- uploading → queued → processing → ready | failed
  status text not null default 'uploading'
    check (status in ('uploading', 'queued', 'processing', 'ready', 'failed')),
  -- Pages, slides, photos, sections or video segments done / total.
  processed_units integer not null default 0 check (processed_units >= 0),
  total_units integer check (total_units >= 0),
  duration_seconds integer check (duration_seconds >= 0),
  -- Set while a batch runs so two tabs never process the same material.
  locked_until timestamptz,
  error text check (char_length(error) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (id, subject_id, user_id),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade,
  -- Deleting a topic leaves its material unclassified, not deleted.
  foreign key (topic_id, user_id) references public.topics (id, user_id) on delete set null (topic_id)
);

create index materials_subject_id_idx on public.materials (subject_id, created_at);
create index materials_topic_id_idx on public.materials (topic_id);

create trigger materials_set_updated_at before update on public.materials
  for each row execute function public.set_updated_at();

-- A material can only be filed under a topic of its own subject.
create or replace function public.check_material_topic()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.topic_id is not null and not exists (
    select 1
    from public.topics t
    join public.units u on u.id = t.unit_id
    where t.id = new.topic_id and u.subject_id = new.subject_id
  ) then
    raise exception 'topic_not_in_subject' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger materials_check_topic
  before insert or update of topic_id, subject_id on public.materials
  for each row execute function public.check_material_topic();

create table public.chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  material_id uuid not null,
  subject_id uuid not null,
  -- Order inside the material.
  position integer not null check (position >= 0),
  -- PDF page, slide number or photo number.
  page integer check (page >= 1),
  -- Second of the video where the fragment starts.
  start_seconds integer check (start_seconds >= 0),
  -- Heading of the section (Word documents and web pages).
  section text check (char_length(section) <= 300),
  content text not null check (char_length(content) between 1 and 8000),
  embedding extensions.vector(768) not null,
  created_at timestamptz not null default now(),
  foreign key (material_id, subject_id, user_id)
    references public.materials (id, subject_id, user_id) on delete cascade
);

-- Searches are always inside one subject (a few thousand chunks), so an exact
-- scan is fast and, unlike an approximate index, never misses results.
create index chunks_subject_id_idx on public.chunks (subject_id);
create index chunks_material_id_idx on public.chunks (material_id, position);

alter table public.materials enable row level security;
alter table public.chunks enable row level security;

create policy "materials_select_own" on public.materials for select to authenticated
  using (user_id = (select auth.uid()));
create policy "materials_insert_own" on public.materials for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "materials_update_own" on public.materials for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "materials_delete_own" on public.materials for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "chunks_select_own" on public.chunks for select to authenticated
  using (user_id = (select auth.uid()));
create policy "chunks_insert_own" on public.chunks for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "chunks_delete_own" on public.chunks for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.materials to authenticated;
grant select, insert, delete on public.chunks to authenticated;
grant all on public.materials, public.chunks to service_role;

-- Semantic search inside one subject (RLS keeps it to the caller's rows).
create or replace function public.match_chunks(
  p_subject_id uuid,
  p_query_embedding extensions.vector(768),
  p_match_count integer default 8
)
returns table (
  chunk_id uuid,
  material_id uuid,
  material_title text,
  material_kind text,
  source_url text,
  page integer,
  start_seconds integer,
  section text,
  content text,
  similarity double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id,
    m.id,
    m.title,
    m.kind,
    m.source_url,
    c.page,
    c.start_seconds,
    c.section,
    c.content,
    1 - (c.embedding operator(extensions.<=>) p_query_embedding)
  from public.chunks c
  join public.materials m on m.id = c.material_id
  where c.subject_id = p_subject_id
  order by c.embedding operator(extensions.<=>) p_query_embedding
  limit least(greatest(p_match_count, 1), 20);
$$;

revoke execute on function public.match_chunks(uuid, extensions.vector, integer) from public, anon;
grant execute on function public.match_chunks(uuid, extensions.vector, integer) to authenticated;

-- Saves one processed batch: its chunks and the material's progress together,
-- so a batch is never stored twice. p_from_units must match the progress the
-- batch started from; if another run moved it meanwhile, nothing is saved.
-- p_chunks: [{ content, page, start_seconds, section, embedding: "[0.1,...]" }]
create or replace function public.save_material_batch(
  p_material_id uuid,
  p_from_units integer,
  p_to_units integer,
  p_total_units integer,
  p_chunks jsonb,
  p_done boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_subject_id uuid;
  v_next integer;
begin
  update public.materials
  set processed_units = p_to_units,
      total_units = p_total_units,
      status = case when p_done then 'ready' else 'processing' end,
      locked_until = null,
      error = null
  where id = p_material_id and processed_units = p_from_units and status = 'processing'
  returning subject_id into v_subject_id;

  if v_subject_id is null then
    raise exception 'batch_conflict' using errcode = 'P0001';
  end if;

  select coalesce(max(position) + 1, 0) into v_next
  from public.chunks
  where material_id = p_material_id;

  insert into public.chunks (material_id, subject_id, position, page, start_seconds, section, content, embedding)
  select
    p_material_id,
    v_subject_id,
    v_next + (c.ordinality - 1)::integer,
    (c.value ->> 'page')::integer,
    (c.value ->> 'start_seconds')::integer,
    c.value ->> 'section',
    c.value ->> 'content',
    (c.value ->> 'embedding')::extensions.vector
  from jsonb_array_elements(p_chunks) with ordinality as c(value, ordinality);
end;
$$;

revoke execute on function public.save_material_batch(uuid, integer, integer, integer, jsonb, boolean) from public, anon;
grant execute on function public.save_material_batch(uuid, integer, integer, integer, jsonb, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket, files under "<user_id>/<subject_id>/<material_id>/".
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'materials',
  'materials',
  false,
  52428800, -- 50 MB per file (Supabase free plan maximum)
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do nothing;

create policy "materials_files_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "materials_files_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'materials' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "materials_files_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- The syllabus joins the library when it is saved, so the chat can answer
-- about dates and grading. It covers the whole subject.
-- ---------------------------------------------------------------------------
create or replace function public.add_syllabus_to_library()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.materials
    (user_id, subject_id, topic_source, kind, title, is_syllabus, storage_bucket, files, status)
  values (
    new.user_id,
    new.subject_id,
    'general',
    case new.files -> 0 ->> 'mime_type'
      when 'application/pdf' then 'pdf'
      when 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' then 'docx'
      else 'images'
    end,
    'Sílabo',
    true,
    'syllabi',
    new.files,
    'queued'
  );
  return new;
end;
$$;

create trigger syllabus_imports_add_to_library
  after update of status on public.syllabus_imports
  for each row
  when (new.status = 'applied' and old.status is distinct from 'applied')
  execute function public.add_syllabus_to_library();

-- Syllabi saved before this migration join the library too.
insert into public.materials
  (user_id, subject_id, topic_source, kind, title, is_syllabus, storage_bucket, files, status)
select
  si.user_id,
  si.subject_id,
  'general',
  case si.files -> 0 ->> 'mime_type'
    when 'application/pdf' then 'pdf'
    when 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' then 'docx'
    else 'images'
  end,
  'Sílabo',
  true,
  'syllabi',
  si.files,
  'queued'
from public.syllabus_imports si
where si.status = 'applied'
  and jsonb_array_length(si.files) > 0
  and not exists (select 1 from public.materials m where m.subject_id = si.subject_id and m.is_syllabus);

-- "Vaciar materia" now also removes the syllabus from the library and leaves
-- the rest of the material waiting to be classified with the next syllabus.
create or replace function public.clear_subject(p_subject_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.subjects where id = p_subject_id) then
    raise exception 'subject_not_found' using errcode = 'P0002';
  end if;

  delete from public.materials where subject_id = p_subject_id and is_syllabus;
  delete from public.events where subject_id = p_subject_id;
  delete from public.units where subject_id = p_subject_id;
  delete from public.syllabus_imports where subject_id = p_subject_id;

  update public.materials
  set topic_source = 'pending'
  where subject_id = p_subject_id and topic_id is null and topic_source in ('user', 'ai');

  update public.subjects
  set teacher_name = null,
      teacher_email = null,
      teacher_notes = null,
      bibliography = '[]'::jsonb
  where id = p_subject_id;
end;
$$;
