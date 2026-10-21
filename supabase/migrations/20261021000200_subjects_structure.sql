-- Subjects and their syllabus structure: units -> topics, plus events (exams,
-- assignments...) linked to the units they cover.
--
-- Ownership: every row carries user_id, and child rows reference their parent
-- through a composite foreign key (parent_id, user_id). Postgres does not apply
-- RLS to foreign key checks, so without the composite key a user could attach
-- rows to someone else's subject by guessing its id.

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  color text not null default 'indigo' check (color ~ '^[a-z]{2,20}$'),
  icon text not null default 'book-open' check (icon ~ '^[a-z0-9-]{2,40}$'),
  teacher_name text check (char_length(teacher_name) <= 120),
  teacher_email text check (char_length(teacher_email) <= 200),
  teacher_notes text check (char_length(teacher_notes) <= 1000),
  bibliography jsonb not null default '[]'::jsonb check (jsonb_typeof(bibliography) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index subjects_user_id_idx on public.subjects (user_id, created_at);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade
);

create index units_subject_id_idx on public.units (subject_id, position);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  unit_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  -- Subtopics listed in the syllabus, kept as text instead of a third level.
  description text check (char_length(description) <= 2000),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (unit_id, user_id) references public.units (id, user_id) on delete cascade
);

create index topics_unit_id_idx on public.topics (unit_id, position);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null,
  kind text not null default 'exam'
    check (kind in ('exam', 'assignment', 'project', 'quiz', 'presentation', 'other')),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  -- Date and time are separate: syllabi give dates without hours, and a plain
  -- date never shifts a day because of time zones. Null date = "to be confirmed"
  -- (also used for graded items without a date, e.g. participation).
  event_date date,
  event_time time,
  weight numeric(5, 2) check (weight between 0 and 100),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade
);

create index events_user_date_idx on public.events (user_id, event_date);
create index events_subject_id_idx on public.events (subject_id);

-- Units an event covers ("Midterm: units 1 and 2"). Topics are derived from
-- them, so a topic added later to a unit is automatically included.
create table public.event_units (
  event_id uuid not null,
  unit_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (event_id, unit_id),
  foreign key (event_id, user_id) references public.events (id, user_id) on delete cascade,
  foreign key (unit_id, user_id) references public.units (id, user_id) on delete cascade
);

create index event_units_unit_id_idx on public.event_units (unit_id);

create trigger subjects_set_updated_at before update on public.subjects
  for each row execute function public.set_updated_at();
create trigger units_set_updated_at before update on public.units
  for each row execute function public.set_updated_at();
create trigger topics_set_updated_at before update on public.topics
  for each row execute function public.set_updated_at();
create trigger events_set_updated_at before update on public.events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: each user only sees and changes their own rows.
-- ---------------------------------------------------------------------------
alter table public.subjects enable row level security;
alter table public.units enable row level security;
alter table public.topics enable row level security;
alter table public.events enable row level security;
alter table public.event_units enable row level security;

create policy "subjects_select_own" on public.subjects for select to authenticated
  using (user_id = (select auth.uid()));
create policy "subjects_insert_own" on public.subjects for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "subjects_update_own" on public.subjects for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "subjects_delete_own" on public.subjects for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "units_select_own" on public.units for select to authenticated
  using (user_id = (select auth.uid()));
create policy "units_insert_own" on public.units for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "units_update_own" on public.units for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "units_delete_own" on public.units for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "topics_select_own" on public.topics for select to authenticated
  using (user_id = (select auth.uid()));
create policy "topics_insert_own" on public.topics for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "topics_update_own" on public.topics for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "topics_delete_own" on public.topics for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "events_select_own" on public.events for select to authenticated
  using (user_id = (select auth.uid()));
create policy "events_insert_own" on public.events for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "events_update_own" on public.events for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "events_delete_own" on public.events for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "event_units_select_own" on public.event_units for select to authenticated
  using (user_id = (select auth.uid()));
create policy "event_units_insert_own" on public.event_units for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "event_units_delete_own" on public.event_units for delete to authenticated
  using (user_id = (select auth.uid()));
