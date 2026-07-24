create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.can_access_family(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_access fa
    where fa.family_id = p_family_id
      and fa.user_id = auth.uid()
  );
$$;

create or replace function public.can_manage_family(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_access fa
    where fa.family_id = p_family_id
      and fa.user_id = auth.uid()
      and fa.access_role in ('owner', 'admin')
  );
$$;

-- Creates a relational family for the logged-in account only once. The caller
-- cannot choose a family id, so a known UUID never grants access.
create or replace function public.bootstrap_current_family(p_family_name text default 'Minha Família')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_name text := coalesce(nullif(trim(p_family_name), ''), 'Minha Família');
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select family_id into v_family_id
  from public.family_access
  where user_id = v_user_id
  order by created_at
  limit 1;

  if v_family_id is not null then
    return v_family_id;
  end if;

  insert into public.families (name, owner_user_id)
  values (left(v_name, 80), v_user_id)
  returning id into v_family_id;

  insert into public.family_access (family_id, user_id, access_role)
  values (v_family_id, v_user_id, 'owner');

  insert into public.family_settings (family_id)
  values (v_family_id);

  return v_family_id;
end;
$$;

create or replace function public.assert_schedule_access(p_schedule_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
begin
  select t.family_id into v_family_id
  from public.task_schedules s
  join public.tasks t on t.id = s.task_id
  where s.id = p_schedule_id;

  if v_family_id is null or not public.can_manage_family(v_family_id) then
    raise exception 'schedule not found or access denied' using errcode = '42501';
  end if;
  return v_family_id;
end;
$$;

create or replace function public.get_occurrences_for_date(p_occurrence_date date)
returns table (
  occurrence_id text,
  schedule_id uuid,
  task_id uuid,
  occurrence_date date,
  title text,
  description text,
  emoji text,
  start_time time,
  end_time time,
  base_stars smallint,
  schedule_type text,
  once_date date,
  start_date date,
  end_date date,
  weekdays smallint[],
  assignee_ids uuid[],
  occurrence_status text,
  stars_granted smallint,
  bonus jsonb
)
language sql
stable
set search_path = public
as $$
  with applicable as (
    select
      s.id as schedule_id,
      s.task_id,
      t.family_id,
      t.title,
      t.description,
      t.emoji,
      t.start_time,
      t.end_time,
      t.base_stars,
      s.schedule_type,
      s.once_date,
      s.start_date,
      s.end_date,
      s.weekdays,
      o.override_type,
      o.override_patch
    from public.task_schedules s
    join public.tasks t on t.id = s.task_id
    left join public.task_schedule_overrides o
      on o.schedule_id = s.id and o.occurrence_date = p_occurrence_date
    where public.can_access_family(t.family_id)
      and (
        (s.schedule_type = 'once' and s.once_date = p_occurrence_date)
        or
        (s.schedule_type = 'weekly'
          and extract(dow from p_occurrence_date)::smallint = any(s.weekdays)
          and (s.start_date is null or p_occurrence_date >= s.start_date)
          and (s.end_date is null or p_occurrence_date <= s.end_date))
      )
      and coalesce(o.override_type, 'override') <> 'skip'
  )
  select
    a.schedule_id::text || ':' || p_occurrence_date::text as occurrence_id,
    a.schedule_id,
    a.task_id,
    p_occurrence_date,
    coalesce(nullif(a.override_patch ->> 'title', ''), a.title),
    coalesce(a.override_patch ->> 'description', a.description),
    coalesce(nullif(a.override_patch ->> 'emoji', ''), a.emoji),
    coalesce(nullif(a.override_patch ->> 'start', '')::time, a.start_time),
    coalesce(nullif(a.override_patch ->> 'end', '')::time, a.end_time),
    a.base_stars,
    a.schedule_type,
    a.once_date,
    a.start_date,
    a.end_date,
    a.weekdays,
    coalesce(assignees.member_ids, '{}'::uuid[]),
    status.status,
    coalesce(status.stars_granted, 0),
    coalesce(status.bonus, '{}'::jsonb)
  from applicable a
  left join lateral (
    select array_agg(ta.member_id order by ta.member_id) as member_ids
    from public.task_assignees ta
    where ta.task_id = a.task_id
  ) assignees on true
  left join public.task_occurrence_status status
    on status.schedule_id = a.schedule_id and status.occurrence_date = p_occurrence_date
  order by coalesce(nullif(a.override_patch ->> 'start', '')::time, a.start_time), a.title, a.schedule_id;
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
begin
  if not public.can_manage_family(p_family_id) then
    raise exception 'access denied' using errcode = '42501';
  end if;

  insert into public.tasks (family_id, title, description, emoji, start_time, end_time, base_stars)
  values (
    p_family_id,
    upper(trim(p_task ->> 'title')),
    coalesce(p_task ->> 'description', ''),
    coalesce(nullif(p_task ->> 'emoji', ''), '⭐'),
    coalesce(nullif(p_task ->> 'start', '')::time, time '08:00'),
    coalesce(nullif(p_task ->> 'end', '')::time, time '08:30'),
    coalesce((p_task ->> 'baseStars')::smallint, 0)
  ) returning id into v_task_id;

  insert into public.task_schedules (task_id, schedule_type, once_date, start_date, end_date, weekdays)
  values (
    v_task_id,
    p_schedule ->> 'type',
    nullif(p_schedule ->> 'date', '')::date,
    nullif(p_schedule ->> 'startDate', '')::date,
    nullif(p_schedule ->> 'endDate', '')::date,
    case when p_schedule ? 'weekdays' then array(select jsonb_array_elements_text(p_schedule -> 'weekdays')::smallint) else null end
  ) returning id into v_schedule_id;

  foreach v_member_id in array coalesce(p_assignee_ids, '{}'::uuid[]) loop
    if not exists (select 1 from public.family_members fm where fm.id = v_member_id and fm.family_id = p_family_id) then
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
begin
  v_family_id := public.assert_schedule_access(p_schedule_id);
  if not exists (select 1 from public.task_schedules where id = p_schedule_id and task_id = p_task_id) then
    raise exception 'task and schedule mismatch' using errcode = '23514';
  end if;

  update public.tasks
  set title = upper(trim(p_task ->> 'title')),
      description = coalesce(p_task ->> 'description', ''),
      emoji = coalesce(nullif(p_task ->> 'emoji', ''), '⭐'),
      start_time = coalesce(nullif(p_task ->> 'start', '')::time, start_time),
      end_time = coalesce(nullif(p_task ->> 'end', '')::time, end_time),
      base_stars = coalesce((p_task ->> 'baseStars')::smallint, base_stars)
  where id = p_task_id;

  update public.task_schedules
  set schedule_type = p_schedule ->> 'type',
      once_date = nullif(p_schedule ->> 'date', '')::date,
      start_date = nullif(p_schedule ->> 'startDate', '')::date,
      end_date = nullif(p_schedule ->> 'endDate', '')::date,
      weekdays = case when p_schedule ? 'weekdays' then array(select jsonb_array_elements_text(p_schedule -> 'weekdays')::smallint) else null end
  where id = p_schedule_id;

  delete from public.task_assignees where task_id = p_task_id;
  foreach v_member_id in array coalesce(p_assignee_ids, '{}'::uuid[]) loop
    if not exists (select 1 from public.family_members fm where fm.id = v_member_id and fm.family_id = v_family_id) then
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
begin
  perform public.assert_schedule_access(p_schedule_id);
  if p_override_type not in ('skip', 'override') or jsonb_typeof(p_override_patch) <> 'object' then
    raise exception 'invalid override' using errcode = '23514';
  end if;
  insert into public.task_schedule_overrides (schedule_id, occurrence_date, override_type, override_patch)
  values (p_schedule_id, p_occurrence_date, p_override_type, case when p_override_type = 'skip' then '{}'::jsonb else p_override_patch end)
  on conflict (schedule_id, occurrence_date) do update
  set override_type = excluded.override_type,
      override_patch = excluded.override_patch;
end;
$$;

create or replace function public.set_task_occurrence_status(
  p_schedule_id uuid,
  p_occurrence_date date,
  p_status text,
  p_stars_granted smallint default 0,
  p_bonus jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_schedule_access(p_schedule_id);
  if p_status not in ('done', 'fail') or p_stars_granted < 0 or jsonb_typeof(p_bonus) <> 'object' then
    raise exception 'invalid occurrence status' using errcode = '23514';
  end if;
  insert into public.task_occurrence_status (schedule_id, occurrence_date, status, stars_granted, bonus)
  values (p_schedule_id, p_occurrence_date, p_status, p_stars_granted, p_bonus)
  on conflict (schedule_id, occurrence_date) do update
  set status = excluded.status,
      stars_granted = excluded.stars_granted,
      bonus = excluded.bonus;
end;
$$;

create or replace function public.clear_task_occurrence_status(p_schedule_id uuid, p_occurrence_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_schedule_access(p_schedule_id);
  delete from public.task_occurrence_status
  where schedule_id = p_schedule_id and occurrence_date = p_occurrence_date;
end;
$$;

create or replace function public.split_task_schedule_for_future(
  p_schedule_id uuid,
  p_from_date date,
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
  v_family_id uuid;
  v_old_start date;
begin
  v_family_id := public.assert_schedule_access(p_schedule_id);
  select start_date into v_old_start from public.task_schedules where id = p_schedule_id and schedule_type = 'weekly';
  if not found or (v_old_start is not null and p_from_date <= v_old_start) then
    raise exception 'future split requires a later weekly occurrence' using errcode = '23514';
  end if;

  update public.task_schedules set end_date = p_from_date - 1 where id = p_schedule_id;
  return query
    select * from public.create_task_with_schedule(
      v_family_id,
      p_task,
      jsonb_set(p_schedule, '{startDate}', to_jsonb(p_from_date::text), true),
      p_assignee_ids
    );
end;
$$;

create or replace function public.delete_task_schedule(p_schedule_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task_id uuid;
begin
  perform public.assert_schedule_access(p_schedule_id);
  select task_id into v_task_id from public.task_schedules where id = p_schedule_id;
  delete from public.task_schedules where id = p_schedule_id;
  delete from public.tasks t
  where t.id = v_task_id
    and not exists (select 1 from public.task_schedules s where s.task_id = t.id);
end;
$$;

create or replace function public.restore_family_backup(p_backup jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
begin
  if p_backup ->> 'format' <> 'gp-da-familia-relational-backup' or coalesce((p_backup ->> 'version')::integer, 0) <> 1 then
    raise exception 'unsupported backup format' using errcode = '22023';
  end if;
  select family_id into v_family_id from public.family_access where user_id = auth.uid() order by created_at limit 1;
  if v_family_id is null or not public.can_manage_family(v_family_id) then
    raise exception 'access denied' using errcode = '42501';
  end if;

  delete from public.tasks where family_id = v_family_id;
  delete from public.manual_star_events where family_id = v_family_id;
  delete from public.family_custom_goals where family_id = v_family_id;
  delete from public.family_badges where family_id = v_family_id;
  delete from public.daily_summaries where family_id = v_family_id;
  delete from public.weekly_summaries where family_id = v_family_id;
  delete from public.family_members where family_id = v_family_id;

  update public.family_settings
  set pin = coalesce(p_backup #>> '{settings,pin}', '1234'),
      require_approval = coalesce((p_backup #>> '{settings,require_approval}')::boolean, false),
      skip_parent_panel_pin = coalesce((p_backup #>> '{settings,skip_parent_panel_pin}')::boolean, true),
      team_stars_goal = coalesce((p_backup #>> '{settings,team_stars_goal}')::smallint, 20)
  where family_id = v_family_id;

  insert into public.family_members (id, family_id, name, avatar, role, color)
  select x.id, v_family_id, x.name, x.avatar, x.role, x.color
  from jsonb_to_recordset(coalesce(p_backup -> 'members', '[]'::jsonb)) as x(id uuid, name text, avatar text, role text, color text);
  insert into public.family_custom_goals (id, family_id, goal_type, member_id, icon, name, target, description, redeemed, claimed_stars)
  select x.id, v_family_id, x.goal_type, x.member_id, x.icon, x.name, x.target, coalesce(x.description, ''), coalesce(x.redeemed, false), coalesce(x.claimed_stars, 0)
  from jsonb_to_recordset(coalesce(p_backup -> 'customGoals', '[]'::jsonb)) as x(id uuid, goal_type text, member_id uuid, icon text, name text, target integer, description text, redeemed boolean, claimed_stars integer);
  insert into public.family_badges (family_id, badge_id, unlocked_at)
  select v_family_id, x.badge_id, coalesce(x.unlocked_at, now())
  from jsonb_to_recordset(coalesce(p_backup -> 'badges', '[]'::jsonb)) as x(badge_id text, unlocked_at timestamptz);
  insert into public.tasks (id, family_id, title, description, emoji, start_time, end_time, base_stars)
  select x.id, v_family_id, x.title, coalesce(x.description, ''), x.emoji, x.start_time, x.end_time, coalesce(x.base_stars, 0)
  from jsonb_to_recordset(coalesce(p_backup -> 'tasks', '[]'::jsonb)) as x(id uuid, title text, description text, emoji text, start_time time, end_time time, base_stars smallint);
  insert into public.task_assignees (task_id, member_id)
  select x.task_id, x.member_id from jsonb_to_recordset(coalesce(p_backup -> 'taskAssignees', '[]'::jsonb)) as x(task_id uuid, member_id uuid);
  insert into public.task_schedules (id, task_id, schedule_type, once_date, start_date, end_date, weekdays)
  select x.id, x.task_id, x.schedule_type, x.once_date, x.start_date, x.end_date, x.weekdays
  from jsonb_to_recordset(coalesce(p_backup -> 'schedules', '[]'::jsonb)) as x(id uuid, task_id uuid, schedule_type text, once_date date, start_date date, end_date date, weekdays smallint[]);
  insert into public.task_schedule_overrides (id, schedule_id, occurrence_date, override_type, override_patch)
  select x.id, x.schedule_id, x.occurrence_date, x.override_type, coalesce(x.override_patch, '{}'::jsonb)
  from jsonb_to_recordset(coalesce(p_backup -> 'overrides', '[]'::jsonb)) as x(id uuid, schedule_id uuid, occurrence_date date, override_type text, override_patch jsonb);
  insert into public.task_occurrence_status (id, schedule_id, occurrence_date, status, stars_granted, bonus)
  select x.id, x.schedule_id, x.occurrence_date, x.status, coalesce(x.stars_granted, 0), coalesce(x.bonus, '{}'::jsonb)
  from jsonb_to_recordset(coalesce(p_backup -> 'occurrenceStatuses', '[]'::jsonb)) as x(id uuid, schedule_id uuid, occurrence_date date, status text, stars_granted smallint, bonus jsonb);
  insert into public.manual_star_events (id, family_id, member_id, event_date, stars, reason, source, source_id)
  select x.id, v_family_id, x.member_id, x.event_date, x.stars, x.reason, coalesce(x.source, 'manual'), x.source_id
  from jsonb_to_recordset(coalesce(p_backup -> 'manualStarEvents', '[]'::jsonb)) as x(id uuid, member_id uuid, event_date date, stars integer, reason text, source text, source_id uuid);
  insert into public.daily_summaries (family_id, summary_date, done_count, total_count, completion_pct, stars, finalized_at)
  select v_family_id, x.summary_date, x.done_count, x.total_count, x.completion_pct, x.stars, coalesce(x.finalized_at, now())
  from jsonb_to_recordset(coalesce(p_backup -> 'dailySummaries', '[]'::jsonb)) as x(summary_date date, done_count integer, total_count integer, completion_pct smallint, stars integer, finalized_at timestamptz);
  insert into public.weekly_summaries (family_id, week_start, finalized_at)
  select v_family_id, x.week_start, x.finalized_at
  from jsonb_to_recordset(coalesce(p_backup -> 'weeklySummaries', '[]'::jsonb)) as x(week_start date, finalized_at timestamptz);
end;
$$;

create or replace function public.get_family_star_totals(p_family_id uuid)
returns table (member_id uuid, stars bigint)
language sql
stable
set search_path = public
as $$
  with task_stars as (
    select ta.member_id, sum(s.stars_granted)::bigint as stars
    from public.task_occurrence_status s
    join public.task_schedules sch on sch.id = s.schedule_id
    join public.tasks t on t.id = sch.task_id
    join public.task_assignees ta on ta.task_id = t.id
    where t.family_id = p_family_id and s.status = 'done'
    group by ta.member_id
  ), manual_stars as (
    select mse.member_id, sum(mse.stars)::bigint as stars
    from public.manual_star_events mse
    where mse.family_id = p_family_id
    group by mse.member_id
  )
  select fm.id, coalesce(ts.stars, 0) + coalesce(ms.stars, 0)
  from public.family_members fm
  left join task_stars ts on ts.member_id = fm.id
  left join manual_stars ms on ms.member_id = fm.id
  where fm.family_id = p_family_id and public.can_access_family(p_family_id);
$$;

drop trigger if exists families_set_updated_at on public.families;
create trigger families_set_updated_at before update on public.families for each row execute function public.set_updated_at();
drop trigger if exists family_members_set_updated_at on public.family_members;
create trigger family_members_set_updated_at before update on public.family_members for each row execute function public.set_updated_at();
drop trigger if exists family_settings_set_updated_at on public.family_settings;
create trigger family_settings_set_updated_at before update on public.family_settings for each row execute function public.set_updated_at();
drop trigger if exists family_custom_goals_set_updated_at on public.family_custom_goals;
create trigger family_custom_goals_set_updated_at before update on public.family_custom_goals for each row execute function public.set_updated_at();
drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks for each row execute function public.set_updated_at();
drop trigger if exists task_schedules_set_updated_at on public.task_schedules;
create trigger task_schedules_set_updated_at before update on public.task_schedules for each row execute function public.set_updated_at();
drop trigger if exists task_schedule_overrides_set_updated_at on public.task_schedule_overrides;
create trigger task_schedule_overrides_set_updated_at before update on public.task_schedule_overrides for each row execute function public.set_updated_at();
drop trigger if exists task_occurrence_status_set_updated_at on public.task_occurrence_status;
create trigger task_occurrence_status_set_updated_at before update on public.task_occurrence_status for each row execute function public.set_updated_at();
