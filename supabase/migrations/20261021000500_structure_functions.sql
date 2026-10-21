-- Multi-row operations that must be atomic. All run as SECURITY INVOKER, so RLS
-- still applies: a user can only touch their own rows.

-- Saves a reviewed syllabus into an empty subject in one transaction.
-- p_payload: {
--   units: [{ title, topics: [{ title, description }] }],
--   events: [{ kind, title, event_date, event_time, weight, notes, unit_indexes: [0-based] }],
--   teacher: { name, email, notes },
--   bibliography: [{ citation, kind, url }]
-- }
create or replace function public.apply_syllabus_import(p_import_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_import public.syllabus_imports%rowtype;
  v_unit jsonb;
  v_event jsonb;
  v_unit_ids uuid[] := array[]::uuid[];
  v_unit_id uuid;
  v_event_id uuid;
  v_unit_count integer := 0;
  v_topic_count integer := 0;
  v_event_count integer := 0;
  v_inserted integer;
begin
  select * into v_import
  from public.syllabus_imports
  where id = p_import_id
  for update;

  if not found then
    raise exception 'import_not_found' using errcode = 'P0002';
  end if;
  if v_import.status <> 'review' then
    raise exception 'import_not_in_review' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.units where subject_id = v_import.subject_id)
     or exists (select 1 from public.events where subject_id = v_import.subject_id) then
    raise exception 'subject_not_empty' using errcode = 'P0001';
  end if;

  for v_unit in
    select value from jsonb_array_elements(coalesce(p_payload -> 'units', '[]'::jsonb))
  loop
    insert into public.units (user_id, subject_id, title, position)
    values (v_import.user_id, v_import.subject_id, v_unit ->> 'title', v_unit_count)
    returning id into v_unit_id;

    v_unit_ids := v_unit_ids || v_unit_id;
    v_unit_count := v_unit_count + 1;

    insert into public.topics (user_id, unit_id, title, description, position)
    select
      v_import.user_id,
      v_unit_id,
      t.value ->> 'title',
      nullif(t.value ->> 'description', ''),
      (t.ordinality - 1)::integer
    from jsonb_array_elements(coalesce(v_unit -> 'topics', '[]'::jsonb)) with ordinality as t (value, ordinality);

    get diagnostics v_inserted = row_count;
    v_topic_count := v_topic_count + v_inserted;
  end loop;

  for v_event in
    select value from jsonb_array_elements(coalesce(p_payload -> 'events', '[]'::jsonb))
  loop
    insert into public.events (user_id, subject_id, kind, title, event_date, event_time, weight, notes)
    values (
      v_import.user_id,
      v_import.subject_id,
      v_event ->> 'kind',
      v_event ->> 'title',
      (v_event ->> 'event_date')::date,
      (v_event ->> 'event_time')::time,
      (v_event ->> 'weight')::numeric,
      nullif(v_event ->> 'notes', '')
    )
    returning id into v_event_id;

    v_event_count := v_event_count + 1;

    insert into public.event_units (event_id, unit_id, user_id)
    select distinct v_event_id, v_unit_ids[idx.value::integer + 1], v_import.user_id
    from jsonb_array_elements_text(coalesce(v_event -> 'unit_indexes', '[]'::jsonb)) as idx (value)
    where idx.value::integer >= 0 and idx.value::integer < v_unit_count;
  end loop;

  update public.subjects
  set teacher_name = nullif(p_payload #>> '{teacher,name}', ''),
      teacher_email = nullif(p_payload #>> '{teacher,email}', ''),
      teacher_notes = nullif(p_payload #>> '{teacher,notes}', ''),
      bibliography = coalesce(p_payload -> 'bibliography', '[]'::jsonb)
  where id = v_import.subject_id;

  update public.syllabus_imports
  set status = 'applied', applied_at = now()
  where id = p_import_id;

  return jsonb_build_object('units', v_unit_count, 'topics', v_topic_count, 'events', v_event_count);
end;
$$;

-- "Vaciar materia": removes everything that came from the syllabus so a new one
-- can be loaded. Keeps name, color and icon. Storage files are removed by the
-- server before calling this (SQL cannot delete Storage objects).
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

  delete from public.events where subject_id = p_subject_id;
  delete from public.units where subject_id = p_subject_id;
  delete from public.syllabus_imports where subject_id = p_subject_id;

  update public.subjects
  set teacher_name = null,
      teacher_email = null,
      teacher_notes = null,
      bibliography = '[]'::jsonb
  where id = p_subject_id;
end;
$$;

-- New order of all the units of a subject.
create or replace function public.reorder_units(p_subject_id uuid, p_unit_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if cardinality(p_unit_ids) <> (select count(distinct x) from unnest(p_unit_ids) as x)
     or cardinality(p_unit_ids) <> (select count(*) from public.units where subject_id = p_subject_id)
     or exists (
       select 1 from unnest(p_unit_ids) as u (id)
       where not exists (select 1 from public.units where id = u.id and subject_id = p_subject_id)
     ) then
    raise exception 'unit_list_mismatch' using errcode = 'P0001';
  end if;

  update public.units as un
  set position = (o.ord - 1)::integer
  from unnest(p_unit_ids) with ordinality as o (id, ord)
  where un.id = o.id;
end;
$$;

-- New order of the topics of a unit. The list may include topics coming from
-- another unit of the same subject (moving a topic).
create or replace function public.reorder_topics(p_unit_id uuid, p_topic_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_subject_id uuid;
begin
  select subject_id into v_subject_id from public.units where id = p_unit_id;
  if v_subject_id is null then
    raise exception 'unit_not_found' using errcode = 'P0002';
  end if;

  if cardinality(p_topic_ids) <> (select count(distinct x) from unnest(p_topic_ids) as x)
     or exists (
       select 1 from unnest(p_topic_ids) as t (id)
       where not exists (
         select 1
         from public.topics tp
         join public.units un on un.id = tp.unit_id
         where tp.id = t.id and un.subject_id = v_subject_id
       )
     )
     or exists (
       select 1 from public.topics where unit_id = p_unit_id and id <> all (p_topic_ids)
     ) then
    raise exception 'topic_list_mismatch' using errcode = 'P0001';
  end if;

  update public.topics as tp
  set unit_id = p_unit_id,
      position = (o.ord - 1)::integer
  from unnest(p_topic_ids) with ordinality as o (id, ord)
  where tp.id = o.id;
end;
$$;

revoke execute on function public.apply_syllabus_import(uuid, jsonb) from public, anon;
revoke execute on function public.clear_subject(uuid) from public, anon;
revoke execute on function public.reorder_units(uuid, uuid[]) from public, anon;
revoke execute on function public.reorder_topics(uuid, uuid[]) from public, anon;
grant execute on function public.apply_syllabus_import(uuid, jsonb) to authenticated;
grant execute on function public.clear_subject(uuid) to authenticated;
grant execute on function public.reorder_units(uuid, uuid[]) to authenticated;
grant execute on function public.reorder_topics(uuid, uuid[]) to authenticated;
