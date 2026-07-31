alter table public.family_settings
add column if not exists task_categories jsonb not null default '[
  {"id":"domesticos","name":"Serviços domésticos","color":"#f2884b"},
  {"id":"homeschool","name":"Homeschool","color":"#8a5cf6"},
  {"id":"trabalho","name":"Trabalho","color":"#378add"},
  {"id":"igreja","name":"Igreja","color":"#e8b800"},
  {"id":"alimentacao","name":"Alimentação","color":"#5cb832"},
  {"id":"lazer","name":"Lazer","color":"#38b6ce"},
  {"id":"saude","name":"Saúde","color":"#cb3232"},
  {"id":"sono","name":"Sono","color":"#52627a"},
  {"id":"higiene","name":"Higiene","color":"#4ba6a6"},
  {"id":"transporte","name":"Transporte","color":"#b56bd6"},
  {"id":"outros","name":"Outros","color":"#74777f"}
]'::jsonb;

alter table public.family_settings
drop constraint if exists family_settings_task_categories_is_array;

alter table public.family_settings
add constraint family_settings_task_categories_is_array
check (jsonb_typeof(task_categories) = 'array');

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
      team_stars_goal = coalesce((p_backup #>> '{settings,team_stars_goal}')::smallint, 20),
      task_categories = coalesce(p_backup #> '{settings,task_categories}', p_backup -> 'taskCategories', task_categories)
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

create or replace function public.reset_current_family_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
begin
  select family_id
  into v_family_id
  from public.family_access
  where user_id = auth.uid()
  order by created_at
  limit 1;

  if v_family_id is null or not public.can_manage_family(v_family_id) then
    raise exception 'access denied' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_family_id::text, 0));

  delete from public.tasks where family_id = v_family_id;
  delete from public.manual_star_events where family_id = v_family_id;
  delete from public.family_custom_goals where family_id = v_family_id;
  delete from public.family_badges where family_id = v_family_id;
  delete from public.daily_summaries where family_id = v_family_id;
  delete from public.weekly_summaries where family_id = v_family_id;
  delete from public.family_members where family_id = v_family_id;

  update public.family_settings
  set pin = '1234',
      require_approval = false,
      skip_parent_panel_pin = true,
      team_stars_goal = 20,
      task_categories = '[
        {"id":"domesticos","name":"Serviços domésticos","color":"#f2884b"},
        {"id":"homeschool","name":"Homeschool","color":"#8a5cf6"},
        {"id":"trabalho","name":"Trabalho","color":"#378add"},
        {"id":"igreja","name":"Igreja","color":"#e8b800"},
        {"id":"alimentacao","name":"Alimentação","color":"#5cb832"},
        {"id":"lazer","name":"Lazer","color":"#38b6ce"},
        {"id":"saude","name":"Saúde","color":"#cb3232"},
        {"id":"sono","name":"Sono","color":"#52627a"},
        {"id":"higiene","name":"Higiene","color":"#4ba6a6"},
        {"id":"transporte","name":"Transporte","color":"#b56bd6"},
        {"id":"outros","name":"Outros","color":"#74777f"}
      ]'::jsonb
  where family_id = v_family_id;
end;
$$;

revoke execute on function public.restore_family_backup(jsonb) from public, anon;
grant execute on function public.restore_family_backup(jsonb) to authenticated;
revoke execute on function public.reset_current_family_data() from public, anon;
grant execute on function public.reset_current_family_data() to authenticated;
