-- RLS controls which rows a signed-in user may access. The Data API also
-- requires table privileges independently of RLS. Keep this list explicit so
-- future public tables, especially legacy stores, are not exposed by default.
grant select, insert, update, delete on table
  public.families,
  public.family_access,
  public.family_members,
  public.family_settings,
  public.family_custom_goals,
  public.family_badges,
  public.tasks,
  public.task_assignees,
  public.task_schedules,
  public.task_schedule_overrides,
  public.task_occurrence_status,
  public.manual_star_events,
  public.daily_summaries,
  public.weekly_summaries
to authenticated;
