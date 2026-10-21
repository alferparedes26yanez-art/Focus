-- Explicit privileges for the API roles. Supabase usually grants these by
-- default, but not in projects created with "automatically expose new tables"
-- turned off. RLS still decides which rows each user can reach.

grant usage on schema public to anon, authenticated, service_role;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete
  on public.subjects, public.units, public.topics, public.events, public.syllabus_imports
  to authenticated;
grant select, insert, delete on public.event_units to authenticated;
grant select on public.ai_usage to authenticated;

grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
