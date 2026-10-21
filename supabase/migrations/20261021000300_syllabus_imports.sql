-- Syllabus imports: uploaded files + the AI extraction draft the user reviews
-- before it is applied to the subject.

create table public.syllabus_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null,
  -- pending: row created, files uploading · processing: AI running
  -- review: draft ready · applied: saved into the subject · failed: see error
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'review', 'applied', 'failed')),
  -- [{ path, name, mime_type, size }]
  files jsonb not null default '[]'::jsonb check (jsonb_typeof(files) = 'array'),
  -- Validated, normalized AI output (cached so the extraction is never repeated).
  extraction jsonb,
  error text check (char_length(error) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  applied_at timestamptz,
  unique (id, user_id),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade
);

create index syllabus_imports_subject_id_idx on public.syllabus_imports (subject_id, created_at desc);

create trigger syllabus_imports_set_updated_at before update on public.syllabus_imports
  for each row execute function public.set_updated_at();

alter table public.syllabus_imports enable row level security;

create policy "syllabus_imports_select_own" on public.syllabus_imports for select to authenticated
  using (user_id = (select auth.uid()));
create policy "syllabus_imports_insert_own" on public.syllabus_imports for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "syllabus_imports_update_own" on public.syllabus_imports for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "syllabus_imports_delete_own" on public.syllabus_imports for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Storage: private bucket, files under "<user_id>/<subject_id>/<import_id>/".
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'syllabi',
  'syllabi',
  false,
  10485760, -- 10 MB per file
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do nothing;

create policy "syllabi_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'syllabi' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "syllabi_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'syllabi' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "syllabi_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'syllabi' and (storage.foldername(name))[1] = (select auth.uid())::text);
