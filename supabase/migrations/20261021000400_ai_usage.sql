-- One row per AI call, used to enforce the monthly budget and to show usage in
-- Settings. Only the server (secret key) writes here: users can read their own
-- rows but cannot insert, edit or delete them, so nobody can erase their spend.

create table public.ai_usage (
  id bigint generated always as identity primary key,
  -- Kept when the user is deleted: the money was still spent this month.
  user_id uuid references auth.users (id) on delete set null,
  feature text not null check (char_length(feature) between 1 and 60),
  model text not null check (char_length(model) between 1 and 100),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  -- Includes thinking tokens, which are billed as output.
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cost_usd numeric(12, 6) not null default 0 check (cost_usd >= 0),
  status text not null check (status in ('success', 'error')),
  error_code text check (char_length(error_code) <= 100),
  duration_ms integer check (duration_ms >= 0),
  created_at timestamptz not null default now()
);

create index ai_usage_created_at_idx on public.ai_usage (created_at);
create index ai_usage_user_id_created_at_idx on public.ai_usage (user_id, created_at);

alter table public.ai_usage enable row level security;

create policy "ai_usage_select_own" on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()));

-- Total spend of the whole app since a date (the budget is global because every
-- call is billed to the same Gemini key). Server only.
create or replace function public.ai_spend_since(p_since timestamptz)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(cost_usd), 0)::numeric
  from public.ai_usage
  where created_at >= p_since;
$$;

revoke execute on function public.ai_spend_since(timestamptz) from public, anon, authenticated;
grant execute on function public.ai_spend_since(timestamptz) to service_role;

-- The caller's own usage grouped by feature and model (RLS applies).
create or replace function public.my_ai_usage_summary(p_since timestamptz)
returns table (
  feature text,
  model text,
  calls bigint,
  input_tokens bigint,
  output_tokens bigint,
  cost_usd numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    u.feature,
    u.model,
    count(*),
    coalesce(sum(u.input_tokens), 0)::bigint,
    coalesce(sum(u.output_tokens), 0)::bigint,
    coalesce(sum(u.cost_usd), 0)::numeric
  from public.ai_usage u
  where u.user_id = (select auth.uid())
    and u.created_at >= p_since
  group by u.feature, u.model
  order by 6 desc;
$$;

revoke execute on function public.my_ai_usage_summary(timestamptz) from public, anon;
grant execute on function public.my_ai_usage_summary(timestamptz) to authenticated;
