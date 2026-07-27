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
      team_stars_goal = 20
  where family_id = v_family_id;
end;
$$;

revoke execute on function public.reset_current_family_data() from public, anon;
grant execute on function public.reset_current_family_data() to authenticated;
