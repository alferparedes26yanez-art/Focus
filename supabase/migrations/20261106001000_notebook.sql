-- Phase 2.5: notebook. Pages of class notes per subject, written in a rich
-- text editor (content as Tiptap JSON). Each page with text is also a
-- library entry of kind 'note', so the chat can search and cite it.

create table public.notebook_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null,
  topic_id uuid,
  title text not null default 'Sin título' check (char_length(btrim(title)) between 1 and 200),
  class_date date not null default current_date,
  -- An editor document needs at least one block; an empty one breaks the cursor.
  content jsonb not null default '{"type": "doc", "content": [{"type": "paragraph"}]}'::jsonb
    check (jsonb_typeof(content) = 'object'),
  -- Text of the page (for previews), derived from content when saved.
  plain_text text not null default '' check (char_length(plain_text) <= 300000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade,
  foreign key (topic_id, user_id) references public.topics (id, user_id) on delete set null (topic_id)
);

create index notebook_pages_subject_id_idx on public.notebook_pages (subject_id, class_date desc, created_at desc);

create trigger notebook_pages_set_updated_at before update on public.notebook_pages
  for each row execute function public.set_updated_at();

-- A page can only be filed under a topic of its own subject.
create or replace function public.check_notebook_topic()
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

create trigger notebook_pages_check_topic
  before insert or update of topic_id, subject_id on public.notebook_pages
  for each row execute function public.check_notebook_topic();

alter table public.notebook_pages enable row level security;

create policy "notebook_pages_select_own" on public.notebook_pages for select to authenticated
  using (user_id = (select auth.uid()));
create policy "notebook_pages_insert_own" on public.notebook_pages for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "notebook_pages_update_own" on public.notebook_pages for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notebook_pages_delete_own" on public.notebook_pages for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.notebook_pages to authenticated;
grant all on public.notebook_pages to service_role;

-- ---------------------------------------------------------------------------
-- The library entry of a page: kind 'note', deleted with the page.
-- content_hash is the hash of the text last indexed, to skip unchanged pages.
-- ---------------------------------------------------------------------------
alter table public.materials drop constraint materials_kind_check;
alter table public.materials add constraint materials_kind_check
  check (kind in ('pdf', 'docx', 'pptx', 'images', 'web', 'youtube', 'html', 'text', 'note'));

alter table public.materials
  add column notebook_page_id uuid unique,
  add column content_hash text check (char_length(content_hash) <= 128),
  add constraint materials_note_page check ((kind = 'note') = (notebook_page_id is not null)),
  add constraint materials_notebook_page_id_user_id_fkey
    foreign key (notebook_page_id, user_id) references public.notebook_pages (id, user_id) on delete cascade;

-- Replaces the search index of a page in one go: creates or updates its
-- library entry and swaps its fragments.
-- p_chunks: [{ content, section, embedding: "[0.1,...]" }]
create or replace function public.index_notebook_page(
  p_page_id uuid,
  p_title text,
  p_chunks jsonb,
  p_content_hash text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_page public.notebook_pages;
  v_material_id uuid;
  v_count integer := jsonb_array_length(p_chunks);
begin
  select * into v_page from public.notebook_pages where id = p_page_id;
  if not found then
    raise exception 'page_not_found' using errcode = 'P0002';
  end if;

  select id into v_material_id from public.materials where notebook_page_id = p_page_id;

  if v_count = 0 then
    -- Nothing to search: the page leaves the library.
    delete from public.materials where id = v_material_id;
    return null;
  end if;

  if v_material_id is null then
    insert into public.materials
      (user_id, subject_id, topic_id, topic_source, kind, title, notebook_page_id, status, processed_units, total_units, content_hash)
    values (
      v_page.user_id, v_page.subject_id, v_page.topic_id,
      case when v_page.topic_id is null then 'general' else 'user' end,
      'note', p_title, p_page_id, 'ready', v_count, v_count, p_content_hash
    )
    returning id into v_material_id;
  else
    update public.materials
    set title = p_title,
        topic_id = v_page.topic_id,
        topic_source = case when v_page.topic_id is null then 'general' else 'user' end,
        processed_units = v_count,
        total_units = v_count,
        content_hash = p_content_hash
    where id = v_material_id;
    delete from public.chunks where material_id = v_material_id;
  end if;

  insert into public.chunks (material_id, subject_id, position, section, content, embedding)
  select
    v_material_id,
    v_page.subject_id,
    (c.ordinality - 1)::integer,
    c.value ->> 'section',
    c.value ->> 'content',
    (c.value ->> 'embedding')::extensions.vector
  from jsonb_array_elements(p_chunks) with ordinality as c(value, ordinality);

  return v_material_id;
end;
$$;

revoke execute on function public.index_notebook_page(uuid, text, jsonb, text) from public, anon;
grant execute on function public.index_notebook_page(uuid, text, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: images of the notebook, under "<user_id>/<subject_id>/<page_id>/".
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'notebook',
  'notebook',
  false,
  10485760, -- 10 MB per image (they are resized in the browser first)
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

create policy "notebook_files_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'notebook' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "notebook_files_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'notebook' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "notebook_files_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'notebook' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- "Vaciar materia" keeps the notebook: its pages lose their topic (the topics
-- are deleted) and their library entries count as general material, not as
-- material waiting to be classified.
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
  set topic_source = case when kind = 'note' then 'general' else 'pending' end
  where subject_id = p_subject_id and topic_id is null and topic_source in ('user', 'ai');

  update public.subjects
  set teacher_name = null,
      teacher_email = null,
      teacher_notes = null,
      bibliography = '[]'::jsonb
  where id = p_subject_id;
end;
$$;
