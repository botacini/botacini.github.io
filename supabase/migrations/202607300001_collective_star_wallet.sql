-- Collective family wallet. Task bonuses remain stored on occurrence statuses;
-- this ledger is reserved for future purchases, unlocks and campaign events.
create table if not exists public.family_star_transactions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  amount integer not null check (amount <> 0),
  transaction_type text not null check (
    transaction_type in ('purchase', 'unlock', 'customization', 'campaign', 'adjustment')
  ),
  reference_id uuid,
  description text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists family_star_transactions_family_created_idx
  on public.family_star_transactions (family_id, created_at desc);

alter table public.family_star_transactions enable row level security;

drop policy if exists family_star_transactions_access on public.family_star_transactions;
create policy family_star_transactions_access
  on public.family_star_transactions
  for select
  to authenticated
  using (public.can_access_family(family_id));

drop policy if exists family_star_transactions_manage on public.family_star_transactions;
create policy family_star_transactions_manage
  on public.family_star_transactions
  for all
  to authenticated
  using (public.can_manage_family(family_id))
  with check (public.can_manage_family(family_id));

grant select, insert, update, delete on public.family_star_transactions to authenticated;

create or replace function public.get_family_star_wallet(p_family_id uuid)
returns table (earned bigint, spent bigint, balance bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with sources as (
    -- A shared task contributes its quality bonus once to the family.
    select greatest(s.stars_granted, 0)::bigint as amount
    from public.task_occurrence_status s
    join public.task_schedules sc on sc.id = s.schedule_id
    join public.tasks t on t.id = sc.task_id
    where t.family_id = p_family_id and s.status = 'done'
    union all
    select e.stars::bigint
    from public.manual_star_events e
    where e.family_id = p_family_id
    union all
    select tx.amount::bigint
    from public.family_star_transactions tx
    where tx.family_id = p_family_id
  )
  select
    coalesce(sum(amount) filter (where amount > 0), 0)::bigint,
    abs(coalesce(sum(amount) filter (where amount < 0), 0))::bigint,
    coalesce(sum(amount), 0)::bigint
  from sources
  where public.can_access_family(p_family_id);
$$;

revoke all on function public.get_family_star_wallet(uuid) from public, anon;
grant execute on function public.get_family_star_wallet(uuid) to authenticated;
