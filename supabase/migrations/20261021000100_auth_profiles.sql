-- Profiles, signup allowlist and the shared updated_at trigger.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, created by a trigger on signup.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  timezone text not null default 'America/Guayaquil' check (char_length(timezone) between 1 and 64),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_timezone text := nullif(new.raw_user_meta_data ->> 'timezone', '');
begin
  if v_timezone is null
     or not exists (select 1 from pg_catalog.pg_timezone_names where name = v_timezone) then
    v_timezone := 'America/Guayaquil';
  end if;

  insert into public.profiles (id, full_name, timezone)
  values (
    new.id,
    nullif(left(btrim(new.raw_user_meta_data ->> 'full_name'), 120), ''),
    v_timezone
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- signup_allowlist: who may create an account.
--   'someone@gmail.com'  -> that exact email
--   '@university.edu.ec' -> any email of that domain
--   '*'                  -> anyone (open registration)
-- Empty table = nobody can sign up. Managed from the SQL editor only.
-- ---------------------------------------------------------------------------
create table public.signup_allowlist (
  pattern text primary key check (
    pattern = lower(pattern)
    and (
      pattern = '*'
      or pattern ~ '^@[a-z0-9.-]+\.[a-z]{2,}$'
      or pattern ~ '^[^@[:space:]]+@[a-z0-9.-]+\.[a-z]{2,}$'
    )
  ),
  note text,
  created_at timestamptz not null default now()
);

-- RLS on and no policies: invisible to anon/authenticated.
alter table public.signup_allowlist enable row level security;

create or replace function public.is_signup_allowed(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.signup_allowlist a
    where a.pattern = '*'
       or a.pattern = lower(btrim(p_email))
       or a.pattern = '@' || split_part(lower(btrim(p_email)), '@', 2)
  );
$$;

revoke execute on function public.is_signup_allowed(text) from public, anon, authenticated;
grant execute on function public.is_signup_allowed(text) to service_role;

create or replace function public.enforce_signup_allowlist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or not public.is_signup_allowed(new.email) then
    raise exception 'signup_not_allowed' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger enforce_signup_allowlist
  before insert on auth.users
  for each row execute function public.enforce_signup_allowlist();
