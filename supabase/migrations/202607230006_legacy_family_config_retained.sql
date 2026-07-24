-- The legacy table is intentionally retained for rollback only. The application
-- no longer reads or writes it after the relational release. Do not drop it
-- until the relational release is validated in production and backups exist.
do $$
begin
  if to_regclass('public.family_config') is not null then
    execute 'comment on table public.family_config is ''Legacy JSONB store retained temporarily for rollback; not used by the relational application schema.''';
  end if;
end;
$$;
