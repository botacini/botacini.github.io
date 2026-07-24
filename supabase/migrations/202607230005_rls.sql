alter table public.families enable row level security;
alter table public.family_access enable row level security;
alter table public.family_members enable row level security;
alter table public.family_settings enable row level security;
alter table public.family_custom_goals enable row level security;
alter table public.family_badges enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_schedules enable row level security;
alter table public.task_schedule_overrides enable row level security;
alter table public.task_occurrence_status enable row level security;
alter table public.manual_star_events enable row level security;
alter table public.daily_summaries enable row level security;
alter table public.weekly_summaries enable row level security;

create policy families_select_access on public.families for select using (public.can_access_family(id));
create policy families_update_manage on public.families for update using (public.can_manage_family(id)) with check (public.can_manage_family(id));

create policy family_access_select_self on public.family_access for select using (user_id = auth.uid());
create policy family_access_manage on public.family_access for all using (public.can_manage_family(family_id)) with check (public.can_manage_family(family_id));

create policy family_members_access on public.family_members for select using (public.can_access_family(family_id));
create policy family_members_manage on public.family_members for all using (public.can_manage_family(family_id)) with check (public.can_manage_family(family_id));

create policy family_settings_access on public.family_settings for select using (public.can_access_family(family_id));
create policy family_settings_manage on public.family_settings for all using (public.can_manage_family(family_id)) with check (public.can_manage_family(family_id));

create policy family_custom_goals_access on public.family_custom_goals for select using (public.can_access_family(family_id));
create policy family_custom_goals_manage on public.family_custom_goals for all using (public.can_manage_family(family_id)) with check (public.can_manage_family(family_id));

create policy family_badges_access on public.family_badges for select using (public.can_access_family(family_id));
create policy family_badges_manage on public.family_badges for all using (public.can_manage_family(family_id)) with check (public.can_manage_family(family_id));

create policy tasks_access on public.tasks for select using (public.can_access_family(family_id));
create policy tasks_manage on public.tasks for all using (public.can_manage_family(family_id)) with check (public.can_manage_family(family_id));

create policy task_assignees_access on public.task_assignees for select using (
  exists (select 1 from public.tasks t where t.id = task_id and public.can_access_family(t.family_id))
);
create policy task_assignees_manage on public.task_assignees for all using (
  exists (select 1 from public.tasks t where t.id = task_id and public.can_manage_family(t.family_id))
) with check (
  exists (select 1 from public.tasks t where t.id = task_id and public.can_manage_family(t.family_id))
);

create policy task_schedules_access on public.task_schedules for select using (
  exists (select 1 from public.tasks t where t.id = task_id and public.can_access_family(t.family_id))
);
create policy task_schedules_manage on public.task_schedules for all using (
  exists (select 1 from public.tasks t where t.id = task_id and public.can_manage_family(t.family_id))
) with check (
  exists (select 1 from public.tasks t where t.id = task_id and public.can_manage_family(t.family_id))
);

create policy task_schedule_overrides_access on public.task_schedule_overrides for select using (
  exists (select 1 from public.task_schedules s join public.tasks t on t.id = s.task_id where s.id = schedule_id and public.can_access_family(t.family_id))
);
create policy task_schedule_overrides_manage on public.task_schedule_overrides for all using (
  exists (select 1 from public.task_schedules s join public.tasks t on t.id = s.task_id where s.id = schedule_id and public.can_manage_family(t.family_id))
) with check (
  exists (select 1 from public.task_schedules s join public.tasks t on t.id = s.task_id where s.id = schedule_id and public.can_manage_family(t.family_id))
);

create policy task_occurrence_status_access on public.task_occurrence_status for select using (
  exists (select 1 from public.task_schedules s join public.tasks t on t.id = s.task_id where s.id = schedule_id and public.can_access_family(t.family_id))
);
create policy task_occurrence_status_manage on public.task_occurrence_status for all using (
  exists (select 1 from public.task_schedules s join public.tasks t on t.id = s.task_id where s.id = schedule_id and public.can_manage_family(t.family_id))
) with check (
  exists (select 1 from public.task_schedules s join public.tasks t on t.id = s.task_id where s.id = schedule_id and public.can_manage_family(t.family_id))
);

create policy manual_star_events_access on public.manual_star_events for select using (public.can_access_family(family_id));
create policy manual_star_events_manage on public.manual_star_events for all using (public.can_manage_family(family_id)) with check (public.can_manage_family(family_id));

create policy daily_summaries_access on public.daily_summaries for select using (public.can_access_family(family_id));
create policy daily_summaries_manage on public.daily_summaries for all using (public.can_manage_family(family_id)) with check (public.can_manage_family(family_id));
create policy weekly_summaries_access on public.weekly_summaries for select using (public.can_access_family(family_id));
create policy weekly_summaries_manage on public.weekly_summaries for all using (public.can_manage_family(family_id)) with check (public.can_manage_family(family_id));

revoke all on function public.assert_schedule_access(uuid) from public;
grant execute on function public.bootstrap_current_family(text) to authenticated;
grant execute on function public.get_occurrences_for_date(date) to authenticated;
grant execute on function public.create_task_with_schedule(uuid, jsonb, jsonb, uuid[]) to authenticated;
grant execute on function public.update_task_series(uuid, uuid, jsonb, jsonb, uuid[]) to authenticated;
grant execute on function public.set_task_occurrence_override(uuid, date, text, jsonb) to authenticated;
grant execute on function public.set_task_occurrence_status(uuid, date, text, smallint, jsonb) to authenticated;
grant execute on function public.clear_task_occurrence_status(uuid, date) to authenticated;
grant execute on function public.split_task_schedule_for_future(uuid, date, jsonb, jsonb, uuid[]) to authenticated;
grant execute on function public.delete_task_schedule(uuid) to authenticated;
grant execute on function public.get_family_star_totals(uuid) to authenticated;
grant execute on function public.restore_family_backup(jsonb) to authenticated;
