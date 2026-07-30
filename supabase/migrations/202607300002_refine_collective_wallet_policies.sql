-- Avoid overlapping permissive SELECT policies while preserving separate
-- access and management rules.
drop policy if exists family_star_transactions_manage on public.family_star_transactions;

create policy family_star_transactions_insert
  on public.family_star_transactions
  for insert
  to authenticated
  with check (public.can_manage_family(family_id));

create policy family_star_transactions_update
  on public.family_star_transactions
  for update
  to authenticated
  using (public.can_manage_family(family_id))
  with check (public.can_manage_family(family_id));

create policy family_star_transactions_delete
  on public.family_star_transactions
  for delete
  to authenticated
  using (public.can_manage_family(family_id));
