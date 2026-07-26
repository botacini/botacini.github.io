-- The relational frontend no longer accesses this rollback-only table.
-- Keep its data available to database administrators, but never expose it
-- through the public Data API while it remains in the public schema.
do $$
begin
  if to_regclass('public.family_config') is not null then
    execute 'alter table public.family_config enable row level security';
    execute 'alter table public.family_config force row level security';
    execute 'drop policy if exists family_owner on public.family_config';
    execute 'drop policy if exists acesso_publico on public.family_config';
    execute 'revoke all privileges on table public.family_config from anon, authenticated, public';
    execute 'comment on table public.family_config is ''Legacy JSONB rollback store. Direct browser access is intentionally disabled; only database administrators may access it.''';
  end if;
end;
$$;
