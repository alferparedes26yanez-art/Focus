-- RLS and function tests. Run with scripts/db/test-local.sh.
-- Every check raises an exception on failure, so the script stops at the first
-- broken rule.
\set ON_ERROR_STOP 1
\set QUIET 1
\pset pager off

\set user_a '11111111-1111-1111-1111-111111111111'
\set user_b '22222222-2222-2222-2222-222222222222'

create function pg_temp.expect_error(p_sql text, p_label text, p_like text default null)
returns void
language plpgsql
as $$
begin
  begin
    execute p_sql;
  exception when others then
    if p_like is not null and sqlerrm not like p_like then
      raise exception 'FAIL (%): wrong error: %', p_label, sqlerrm;
    end if;
    raise notice 'ok  blocked: %', p_label;
    return;
  end;
  raise exception 'FAIL (%): expected an error', p_label;
end;
$$;

create function pg_temp.expect(p_ok boolean, p_label text)
returns void
language plpgsql
as $$
begin
  if p_ok is distinct from true then
    raise exception 'FAIL: %', p_label;
  end if;
  raise notice 'ok  %', p_label;
end;
$$;

grant execute on all functions in schema pg_temp to public;

-- ---------------------------------------------------------------------------
\echo '== Signup allowlist and profiles'
-- ---------------------------------------------------------------------------
select pg_temp.expect_error(
  $$insert into auth.users (email) values ('nobody@test.com')$$,
  'signup with empty allowlist', '%signup_not_allowed%');

insert into public.signup_allowlist (pattern) values ('a@test.com'), ('@uni.edu');
select pg_temp.expect_error(
  $$insert into public.signup_allowlist (pattern) values ('Not An Email')$$,
  'invalid allowlist pattern');

insert into auth.users (id, email, raw_user_meta_data) values
  (:'user_a', 'A@test.com', '{"full_name": "Ana", "timezone": "America/Bogota"}'),
  (:'user_b', 'b@uni.edu', '{"full_name": "Beto", "timezone": "Mars/Base"}');

select pg_temp.expect_error(
  $$insert into auth.users (email) values ('c@other.com')$$,
  'signup with email not in allowlist', '%signup_not_allowed%');

select pg_temp.expect(
  (select timezone from public.profiles where id = :'user_a') = 'America/Bogota',
  'profile created with the browser time zone');
select pg_temp.expect(
  (select timezone from public.profiles where id = :'user_b') = 'America/Guayaquil',
  'invalid time zone falls back to America/Guayaquil');

-- ---------------------------------------------------------------------------
\echo '== User A creates data'
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'user_a', false);
set role authenticated;

insert into public.subjects (id, name, color, icon, teacher_name)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Cálculo', 'blue', 'calculator', 'Dra. Pérez');

insert into public.units (id, subject_id, title, position) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000001', 'Límites', 0),
  ('aaaaaaaa-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000001', 'Derivadas', 1);

insert into public.topics (id, unit_id, title, position) values
  ('aaaaaaaa-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'Definición', 0),
  ('aaaaaaaa-0000-0000-0000-0000000000b2', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'Continuidad', 1),
  ('aaaaaaaa-0000-0000-0000-0000000000b3', 'aaaaaaaa-0000-0000-0000-0000000000a2', 'Regla de la cadena', 0);

insert into public.events (id, subject_id, kind, title, event_date, weight)
values ('aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000001', 'exam', 'Parcial 1', '2026-11-10', 30);

insert into public.event_units (event_id, unit_id)
values ('aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000a1');

insert into storage.objects (bucket_id, name)
values ('syllabi', :'user_a' || '/aaaaaaaa-0000-0000-0000-000000000001/x/silabo.pdf');

select pg_temp.expect_error(
  format($$insert into storage.objects (bucket_id, name) values ('syllabi', '%s/s/i/f.pdf')$$, :'user_b'),
  'A uploads into B''s storage folder');

select pg_temp.expect_error(
  format($$insert into public.subjects (user_id, name) values (%L, 'Robada')$$, :'user_b'),
  'A creates a subject owned by B');

select pg_temp.expect_error(
  $$insert into public.ai_usage (user_id, feature, model, status) values (auth.uid(), 'x', 'm', 'success')$$,
  'user inserts into ai_usage');

select pg_temp.expect(
  (select count(*) from public.signup_allowlist) = 0,
  'users cannot read the signup allowlist');
select pg_temp.expect_error(
  $$select public.is_signup_allowed('a@test.com')$$,
  'users cannot call is_signup_allowed', '%permission denied%');

reset role;

-- ---------------------------------------------------------------------------
\echo '== User B cannot see or touch A''s data'
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'user_b', false);
set role authenticated;

select pg_temp.expect((select count(*) from public.subjects) = 0, 'B sees no subjects of A');
select pg_temp.expect((select count(*) from public.units) = 0, 'B sees no units of A');
select pg_temp.expect((select count(*) from public.topics) = 0, 'B sees no topics of A');
select pg_temp.expect((select count(*) from public.events) = 0, 'B sees no events of A');
select pg_temp.expect((select count(*) from public.event_units) = 0, 'B sees no event_units of A');
select pg_temp.expect((select count(*) from public.profiles) = 1, 'B only sees its own profile');
select pg_temp.expect((select count(*) from storage.objects) = 0, 'B sees no files of A');

with changed as (
  update public.subjects set name = 'hackeado'
  where id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1
)
select pg_temp.expect((select count(*) from changed) = 0, 'B cannot update A''s subject');

with removed as (
  delete from public.subjects where id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1
)
select pg_temp.expect((select count(*) from removed) = 0, 'B cannot delete A''s subject');

with changed as (
  update public.profiles set full_name = 'x' where id = '11111111-1111-1111-1111-111111111111' returning 1
)
select pg_temp.expect((select count(*) from changed) = 0, 'B cannot update A''s profile');

select pg_temp.expect_error(
  $$insert into public.units (subject_id, title) values ('aaaaaaaa-0000-0000-0000-000000000001', 'intrusa')$$,
  'B attaches a unit to A''s subject (composite FK)');

select pg_temp.expect_error(
  format($$insert into public.units (user_id, subject_id, title)
           values (%L, 'aaaaaaaa-0000-0000-0000-000000000001', 'intrusa')$$, :'user_a'),
  'B inserts a unit as user A (RLS)');

insert into public.subjects (id, name) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Física');
insert into public.events (id, subject_id, title)
values ('bbbbbbbb-0000-0000-0000-0000000000c1', 'bbbbbbbb-0000-0000-0000-000000000001', 'Examen');

select pg_temp.expect_error(
  $$insert into public.event_units (event_id, unit_id)
    values ('bbbbbbbb-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000a1')$$,
  'B links its event to A''s unit');

select pg_temp.expect_error(
  $$select public.clear_subject('aaaaaaaa-0000-0000-0000-000000000001')$$,
  'B clears A''s subject', '%subject_not_found%');

select pg_temp.expect_error(
  $$select public.reorder_units('aaaaaaaa-0000-0000-0000-000000000001',
      array['aaaaaaaa-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-0000000000a1']::uuid[])$$,
  'B reorders A''s units', '%unit_list_mismatch%');

select pg_temp.expect_error(
  $$select public.ai_spend_since(now() - interval '1 day')$$,
  'users cannot read the global AI spend', '%permission denied%');

reset role;

-- ---------------------------------------------------------------------------
\echo '== Anonymous visitors see nothing'
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select pg_temp.expect((select count(*) from public.subjects) = 0, 'anon sees no subjects');
select pg_temp.expect((select count(*) from public.profiles) = 0, 'anon sees no profiles');
select pg_temp.expect_error(
  $$select public.clear_subject('aaaaaaaa-0000-0000-0000-000000000001')$$,
  'anon cannot call RPC functions', '%permission denied%');
reset role;

-- ---------------------------------------------------------------------------
\echo '== AI usage'
-- ---------------------------------------------------------------------------
set role service_role;
insert into public.ai_usage (user_id, feature, model, input_tokens, output_tokens, cost_usd, status) values
  (:'user_a', 'syllabus_extraction', 'gemini-test', 1000, 500, 0.0125, 'success'),
  (:'user_a', 'syllabus_extraction', 'gemini-test', 0, 0, 0, 'error'),
  (:'user_b', 'syllabus_extraction', 'gemini-test', 2000, 800, 0.0200, 'success');
select pg_temp.expect(
  public.ai_spend_since(now() - interval '1 hour') = 0.0325,
  'server reads the global monthly spend');
reset role;

select set_config('request.jwt.claim.sub', :'user_a', false);
set role authenticated;
select pg_temp.expect((select count(*) from public.ai_usage) = 2, 'A only sees its own AI calls');
select pg_temp.expect(
  (select sum(cost_usd) from public.my_ai_usage_summary(now() - interval '1 hour')) = 0.0125,
  'my_ai_usage_summary only sums A''s calls');
reset role;

-- ---------------------------------------------------------------------------
\echo '== Structure functions'
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'user_a', false);
set role authenticated;

select public.reorder_units(
  'aaaaaaaa-0000-0000-0000-000000000001',
  array['aaaaaaaa-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-0000000000a1']::uuid[]);
select pg_temp.expect(
  (select position from public.units where id = 'aaaaaaaa-0000-0000-0000-0000000000a2') = 0,
  'reorder_units changes positions');

select pg_temp.expect_error(
  $$select public.reorder_units('aaaaaaaa-0000-0000-0000-000000000001',
      array['aaaaaaaa-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-0000000000a2']::uuid[])$$,
  'reorder_units rejects duplicated ids', '%unit_list_mismatch%');

-- Move "Continuidad" from Límites to Derivadas, first position.
select public.reorder_topics(
  'aaaaaaaa-0000-0000-0000-0000000000a2',
  array['aaaaaaaa-0000-0000-0000-0000000000b2', 'aaaaaaaa-0000-0000-0000-0000000000b3']::uuid[]);
select pg_temp.expect(
  (select unit_id = 'aaaaaaaa-0000-0000-0000-0000000000a2' and position = 0
   from public.topics where id = 'aaaaaaaa-0000-0000-0000-0000000000b2'),
  'reorder_topics moves a topic to another unit');

select pg_temp.expect_error(
  $$select public.reorder_topics('aaaaaaaa-0000-0000-0000-0000000000a2',
      array['aaaaaaaa-0000-0000-0000-0000000000b2']::uuid[])$$,
  'reorder_topics rejects a list missing topics of the unit', '%topic_list_mismatch%');

-- Applying a syllabus requires an empty subject.
insert into public.syllabus_imports (id, subject_id, status, extraction)
values ('aaaaaaaa-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-000000000001', 'review', '{}');

select pg_temp.expect_error(
  $$select public.apply_syllabus_import('aaaaaaaa-0000-0000-0000-0000000000d1', '{"units": []}')$$,
  'apply into a subject that already has content', '%subject_not_empty%');

update public.subjects set teacher_email = 'x@y.com' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select public.clear_subject('aaaaaaaa-0000-0000-0000-000000000001');

select pg_temp.expect(
  (select count(*) from public.units where subject_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0
  and (select count(*) from public.events where subject_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0
  and (select count(*) from public.syllabus_imports where subject_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0
  and (select teacher_name is null and teacher_email is null and name = 'Cálculo'
       from public.subjects where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'clear_subject empties the subject and keeps its name');

insert into public.syllabus_imports (id, subject_id, status, extraction)
values ('aaaaaaaa-0000-0000-0000-0000000000d2', 'aaaaaaaa-0000-0000-0000-000000000001', 'review', '{}');

select public.apply_syllabus_import(
  'aaaaaaaa-0000-0000-0000-0000000000d2',
  $json${
    "units": [
      {"title": "Unidad 1: Límites", "topics": [{"title": "Definición", "description": null}, {"title": "Continuidad", "description": "Tipos de discontinuidad"}]},
      {"title": "Unidad 2: Derivadas", "topics": [{"title": "Reglas", "description": ""}]},
      {"title": "Unidad 3: Integrales", "topics": []}
    ],
    "events": [
      {"kind": "exam", "title": "Parcial 1", "event_date": "2026-11-10", "event_time": "08:00", "weight": 30, "notes": null, "unit_indexes": [0, 1, 1, 7]},
      {"kind": "other", "title": "Participación", "event_date": null, "event_time": null, "weight": 10, "notes": "", "unit_indexes": []}
    ],
    "teacher": {"name": "Dr. Ruiz", "email": "ruiz@uni.edu", "notes": ""},
    "bibliography": [{"citation": "Stewart, Cálculo", "kind": "basic", "url": null}]
  }$json$::jsonb);

select pg_temp.expect(
  (select count(*) from public.units where subject_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 3,
  'apply creates the units');
select pg_temp.expect(
  (select string_agg(t.title, ',' order by t.position)
   from public.topics t join public.units u on u.id = t.unit_id
   where u.subject_id = 'aaaaaaaa-0000-0000-0000-000000000001' and u.position = 0) = 'Definición,Continuidad',
  'apply keeps the topic order');
select pg_temp.expect(
  (select count(*) from public.event_units eu join public.events e on e.id = eu.event_id
   where e.title = 'Parcial 1') = 2,
  'apply links events to units (dedupes and ignores out-of-range indexes)');
select pg_temp.expect(
  (select event_date is null from public.events where title = 'Participación'),
  'events without a date are kept as "to be confirmed"');
select pg_temp.expect(
  (select teacher_name = 'Dr. Ruiz' and teacher_notes is null and jsonb_array_length(bibliography) = 1
   from public.subjects where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'apply saves teacher and bibliography');
select pg_temp.expect(
  (select status = 'applied' and applied_at is not null
   from public.syllabus_imports where id = 'aaaaaaaa-0000-0000-0000-0000000000d2'),
  'apply marks the import as applied');
select pg_temp.expect_error(
  $$select public.apply_syllabus_import('aaaaaaaa-0000-0000-0000-0000000000d2', '{}')$$,
  'an import cannot be applied twice', '%import_not_in_review%');
reset role;

select set_config('request.jwt.claim.sub', :'user_b', false);
set role authenticated;
insert into public.syllabus_imports (id, subject_id, status)
values ('bbbbbbbb-0000-0000-0000-0000000000d1', 'bbbbbbbb-0000-0000-0000-000000000001', 'review');
select pg_temp.expect_error(
  $$select public.apply_syllabus_import('aaaaaaaa-0000-0000-0000-0000000000d2', '{}')$$,
  'B cannot apply A''s import', '%import_not_found%');
reset role;

-- ---------------------------------------------------------------------------
\echo '== Deleting a user'
-- ---------------------------------------------------------------------------
delete from auth.users where id = :'user_a';
select pg_temp.expect(
  (select count(*) from public.subjects where user_id = :'user_a') = 0,
  'deleting a user deletes their data');
select pg_temp.expect(
  (select count(*) from public.ai_usage where user_id is null) = 2,
  'their AI usage is kept for the monthly budget');

\echo '== All checks passed'
