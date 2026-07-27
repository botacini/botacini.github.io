create or replace function public.find_task_schedule_conflict(
  p_family_id uuid,
  p_start_time time,
  p_schedule jsonb,
  p_assignee_ids uuid[],
  p_exclude_schedule_id uuid default null
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  with proposed as (
    select
      p_schedule ->> 'type' as schedule_type,
      nullif(p_schedule ->> 'date', '')::date as once_date,
      nullif(p_schedule ->> 'startDate', '')::date as start_date,
      nullif(p_schedule ->> 'endDate', '')::date as end_date,
      case
        when p_schedule ? 'weekdays'
        then array(select jsonb_array_elements_text(p_schedule -> 'weekdays')::smallint)
        else null::smallint[]
      end as weekdays
  )
  select conflicts.title
  from (
    select t.title, s.id as schedule_id
    from public.tasks t
    join public.task_schedules s on s.task_id = t.id
    cross join proposed p
    where public.can_manage_family(p_family_id)
      and t.family_id = p_family_id
      and t.start_time = p_start_time
      and (p_exclude_schedule_id is null or s.id <> p_exclude_schedule_id)
      and exists (
        select 1 from public.task_assignees ta
        where ta.task_id = t.id
          and ta.member_id = any(coalesce(p_assignee_ids, '{}'::uuid[]))
      )
      and (
        (p.schedule_type = 'once' and s.schedule_type = 'once' and p.once_date = s.once_date)
        or
        (p.schedule_type = 'once' and s.schedule_type = 'weekly'
          and extract(dow from p.once_date)::smallint = any(s.weekdays)
          and (s.start_date is null or p.once_date >= s.start_date)
          and (s.end_date is null or p.once_date <= s.end_date))
        or
        (p.schedule_type = 'weekly' and s.schedule_type = 'once'
          and extract(dow from s.once_date)::smallint = any(p.weekdays)
          and (p.start_date is null or s.once_date >= p.start_date)
          and (p.end_date is null or s.once_date <= p.end_date))
        or
        (p.schedule_type = 'weekly' and s.schedule_type = 'weekly'
          and p.weekdays && s.weekdays
          and coalesce(p.start_date, date '-infinity') <= coalesce(s.end_date, date 'infinity')
          and coalesce(s.start_date, date '-infinity') <= coalesce(p.end_date, date 'infinity'))
      )
    union all
    select t.title, s.id
    from public.tasks t
    join public.task_schedules s on s.task_id = t.id
    join public.task_schedule_overrides o on o.schedule_id = s.id and o.override_type = 'override'
    cross join proposed p
    where public.can_manage_family(p_family_id)
      and t.family_id = p_family_id
      and coalesce(nullif(o.override_patch ->> 'start', '')::time, t.start_time) = p_start_time
      and (p_exclude_schedule_id is null or s.id <> p_exclude_schedule_id)
      and exists (
        select 1 from public.task_assignees ta
        where ta.task_id = t.id
          and ta.member_id = any(coalesce(p_assignee_ids, '{}'::uuid[]))
      )
      and (
        (p.schedule_type = 'once' and p.once_date = o.occurrence_date)
        or
        (p.schedule_type = 'weekly'
          and extract(dow from o.occurrence_date)::smallint = any(p.weekdays)
          and (p.start_date is null or o.occurrence_date >= p.start_date)
          and (p.end_date is null or o.occurrence_date <= p.end_date))
      )
  ) conflicts
  order by conflicts.title, conflicts.schedule_id
  limit 1;
$$;

create or replace function public.assert_no_task_schedule_conflict(
  p_family_id uuid,
  p_start_time time,
  p_schedule jsonb,
  p_assignee_ids uuid[],
  p_exclude_schedule_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conflicting_title text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_family_id::text, 0));
  v_conflicting_title := public.find_task_schedule_conflict(
    p_family_id, p_start_time, p_schedule, p_assignee_ids, p_exclude_schedule_id
  );
  if v_conflicting_title is not null then
    raise exception 'Conflito de horário: a tarefa "%" já ocupa este horário.', v_conflicting_title
      using errcode = '23505';
  end if;
end;
$$;

create or replace function public.create_task_with_schedule(
  p_family_id uuid,
  p_task jsonb,
  p_schedule jsonb,
  p_assignee_ids uuid[] default '{}'::uuid[]
)
returns table (task_id uuid, schedule_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task_id uuid;
  v_schedule_id uuid;
  v_member_id uuid;
  v_start_time time := coalesce(nullif(p_task ->> 'start', '')::time, time '08:00');
begin
  if not public.can_manage_family(p_family_id) then
    raise exception 'access denied' using errcode = '42501';
  end if;
  perform public.assert_no_task_schedule_conflict(
    p_family_id, v_start_time, p_schedule, p_assignee_ids
  );

  insert into public.tasks (family_id, title, description, emoji, start_time, end_time, base_stars)
  values (
    p_family_id, upper(trim(p_task ->> 'title')), coalesce(p_task ->> 'description', ''),
    coalesce(nullif(p_task ->> 'emoji', ''), '⭐'), v_start_time,
    coalesce(nullif(p_task ->> 'end', '')::time, time '08:30'),
    coalesce((p_task ->> 'baseStars')::smallint, 0)
  ) returning id into v_task_id;

  insert into public.task_schedules (task_id, schedule_type, once_date, start_date, end_date, weekdays)
  values (
    v_task_id, p_schedule ->> 'type', nullif(p_schedule ->> 'date', '')::date,
    nullif(p_schedule ->> 'startDate', '')::date, nullif(p_schedule ->> 'endDate', '')::date,
    case when p_schedule ? 'weekdays'
      then array(select jsonb_array_elements_text(p_schedule -> 'weekdays')::smallint) else null end
  ) returning id into v_schedule_id;

  foreach v_member_id in array coalesce(p_assignee_ids, '{}'::uuid[]) loop
    if not exists (select 1 from public.family_members where id = v_member_id and family_id = p_family_id) then
      raise exception 'assignee does not belong to family' using errcode = '23514';
    end if;
    insert into public.task_assignees (task_id, member_id) values (v_task_id, v_member_id);
  end loop;
  return query select v_task_id, v_schedule_id;
end;
$$;

create or replace function public.update_task_series(
  p_task_id uuid,
  p_schedule_id uuid,
  p_task jsonb,
  p_schedule jsonb,
  p_assignee_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_member_id uuid;
  v_start_time time;
begin
  v_family_id := public.assert_schedule_access(p_schedule_id);
  if not exists (select 1 from public.task_schedules where id = p_schedule_id and task_id = p_task_id) then
    raise exception 'task and schedule mismatch' using errcode = '23514';
  end if;
  select coalesce(nullif(p_task ->> 'start', '')::time, start_time)
  into v_start_time from public.tasks where id = p_task_id;
  perform public.assert_no_task_schedule_conflict(
    v_family_id, v_start_time, p_schedule, p_assignee_ids, p_schedule_id
  );

  update public.tasks
  set title = upper(trim(p_task ->> 'title')),
      description = coalesce(p_task ->> 'description', ''),
      emoji = coalesce(nullif(p_task ->> 'emoji', ''), '⭐'),
      start_time = v_start_time,
      end_time = coalesce(nullif(p_task ->> 'end', '')::time, end_time),
      base_stars = coalesce((p_task ->> 'baseStars')::smallint, base_stars)
  where id = p_task_id;

  update public.task_schedules
  set schedule_type = p_schedule ->> 'type',
      once_date = nullif(p_schedule ->> 'date', '')::date,
      start_date = nullif(p_schedule ->> 'startDate', '')::date,
      end_date = nullif(p_schedule ->> 'endDate', '')::date,
      weekdays = case when p_schedule ? 'weekdays'
        then array(select jsonb_array_elements_text(p_schedule -> 'weekdays')::smallint) else null end
  where id = p_schedule_id;

  delete from public.task_assignees where task_id = p_task_id;
  foreach v_member_id in array coalesce(p_assignee_ids, '{}'::uuid[]) loop
    if not exists (select 1 from public.family_members where id = v_member_id and family_id = v_family_id) then
      raise exception 'assignee does not belong to family' using errcode = '23514';
    end if;
    insert into public.task_assignees (task_id, member_id) values (p_task_id, v_member_id);
  end loop;
end;
$$;

create or replace function public.set_task_occurrence_override(
  p_schedule_id uuid,
  p_occurrence_date date,
  p_override_type text,
  p_override_patch jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_task_id uuid;
  v_start_time time;
  v_assignee_ids uuid[];
begin
  v_family_id := public.assert_schedule_access(p_schedule_id);
  if p_override_type not in ('skip', 'override') or jsonb_typeof(p_override_patch) <> 'object' then
    raise exception 'invalid override' using errcode = '23514';
  end if;
  if p_override_type = 'override' then
    select s.task_id, coalesce(nullif(p_override_patch ->> 'start', '')::time, t.start_time)
    into v_task_id, v_start_time
    from public.task_schedules s join public.tasks t on t.id = s.task_id
    where s.id = p_schedule_id;
    select coalesce(array_agg(member_id), '{}'::uuid[])
    into v_assignee_ids from public.task_assignees where task_id = v_task_id;
    perform public.assert_no_task_schedule_conflict(
      v_family_id,
      v_start_time,
      jsonb_build_object('type', 'once', 'date', p_occurrence_date::text),
      v_assignee_ids,
      p_schedule_id
    );
  end if;
  insert into public.task_schedule_overrides (schedule_id, occurrence_date, override_type, override_patch)
  values (
    p_schedule_id, p_occurrence_date, p_override_type,
    case when p_override_type = 'skip' then '{}'::jsonb else p_override_patch end
  )
  on conflict (schedule_id, occurrence_date) do update
  set override_type = excluded.override_type,
      override_patch = excluded.override_patch;
end;
$$;

revoke execute on function public.find_task_schedule_conflict(uuid, time, jsonb, uuid[], uuid) from public, anon;
revoke execute on function public.assert_no_task_schedule_conflict(uuid, time, jsonb, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.find_task_schedule_conflict(uuid, time, jsonb, uuid[], uuid) to authenticated;
