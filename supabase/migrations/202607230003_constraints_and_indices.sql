create or replace function public.weekdays_are_valid(days smallint[])
returns boolean
language sql
immutable
as $$
  select days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
     and cardinality(days) = cardinality(array(select distinct unnest(days)));
$$;

alter table public.task_schedules
  add constraint task_schedules_valid_weekdays check (weekdays is null or public.weekdays_are_valid(weekdays));

create index if not exists family_access_user_family_idx on public.family_access(user_id, family_id);
create index if not exists family_members_family_idx on public.family_members(family_id);
create index if not exists family_custom_goals_family_idx on public.family_custom_goals(family_id);
create index if not exists family_badges_family_idx on public.family_badges(family_id);
create index if not exists tasks_family_idx on public.tasks(family_id);
create index if not exists task_assignees_member_idx on public.task_assignees(member_id);
create index if not exists task_schedules_task_idx on public.task_schedules(task_id);
create index if not exists task_schedules_weekly_idx on public.task_schedules(task_id, start_date, end_date) where schedule_type = 'weekly';
create index if not exists task_schedules_once_idx on public.task_schedules(once_date) where schedule_type = 'once';
create index if not exists task_schedule_overrides_schedule_date_idx on public.task_schedule_overrides(schedule_id, occurrence_date);
create index if not exists task_occurrence_status_schedule_date_idx on public.task_occurrence_status(schedule_id, occurrence_date);
create index if not exists manual_star_events_family_date_idx on public.manual_star_events(family_id, event_date);
create index if not exists manual_star_events_member_date_idx on public.manual_star_events(member_id, event_date);
create index if not exists daily_summaries_family_date_idx on public.daily_summaries(family_id, summary_date);
