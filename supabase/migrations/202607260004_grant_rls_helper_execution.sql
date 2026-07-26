-- These pure predicates are evaluated by RLS policies and by the occurrence
-- resolver under the caller role. They reveal only whether the caller already
-- has access to a supplied family id.
grant execute on function public.can_access_family(uuid) to authenticated;
grant execute on function public.can_manage_family(uuid) to authenticated;
