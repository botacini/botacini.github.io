-- Keep every member reference inside its owning family. RLS controls who can
-- mutate a row; these triggers also protect relation integrity when an owner
-- has access to more than one family.
create or replace function public.enforce_member_family_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected_family_id uuid;
  v_member_family_id uuid;
begin
  if tg_table_name = 'task_assignees' then
    select family_id into v_expected_family_id
    from public.tasks
    where id = new.task_id;
  else
    v_expected_family_id := new.family_id;
  end if;

  if tg_table_name = 'family_custom_goals' and new.member_id is null then
    return new;
  end if;

  select family_id into v_member_family_id
  from public.family_members
  where id = new.member_id;

  if v_expected_family_id is null
     or v_member_family_id is null
     or v_member_family_id <> v_expected_family_id then
    raise exception 'member must belong to the same family' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists task_assignees_member_family_integrity on public.task_assignees;
create trigger task_assignees_member_family_integrity
before insert or update of task_id, member_id on public.task_assignees
for each row execute function public.enforce_member_family_integrity();

drop trigger if exists family_custom_goals_member_family_integrity on public.family_custom_goals;
create trigger family_custom_goals_member_family_integrity
before insert or update of family_id, member_id on public.family_custom_goals
for each row execute function public.enforce_member_family_integrity();

drop trigger if exists manual_star_events_member_family_integrity on public.manual_star_events;
create trigger manual_star_events_member_family_integrity
before insert or update of family_id, member_id on public.manual_star_events
for each row execute function public.enforce_member_family_integrity();
