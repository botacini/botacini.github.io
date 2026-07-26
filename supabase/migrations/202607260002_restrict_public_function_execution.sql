-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Keep the
-- implementation helpers private and expose only the browser RPC surface to
-- authenticated users.
revoke execute on all functions in schema public from public;

alter function public.weekdays_are_valid(smallint[]) set search_path = public;

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
