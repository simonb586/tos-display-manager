-- Vérificateur strictement non mutatif A5. La RPC d’écriture n’est jamais appelée.
begin read only;

do $$
declare
  v_rpc record;
  v_normalizer record;
  v_source text;
  v_role oid;
  v_anon oid;
  v_column text;
  v_target text;
begin
  if to_regclass('public.relation_fields') is null
     or to_regclass('public.relation_field_config_audit') is null then
    raise exception 'ÉCHEC A5: catalogue ou audit absent.';
  end if;
  foreach v_column in array array['validation_rules','configuration_status','updated_at']
  loop
    if not exists (
      select 1 from information_schema.columns where table_schema='public'
       and table_name='relation_fields' and column_name=v_column
    ) then raise exception 'ÉCHEC A5: colonne relation_fields.% absente.',v_column; end if;
  end loop;
  foreach v_column in array array['actor_app_role','event_type']
  loop
    if not exists (
      select 1 from information_schema.columns where table_schema='public'
       and table_name='relation_field_config_audit' and column_name=v_column
    ) then raise exception 'ÉCHEC A5: colonne audit % absente.',v_column; end if;
  end loop;

  select p.*,r.rolname owner_name into v_normalizer
    from pg_catalog.pg_proc p join pg_catalog.pg_roles r on r.oid=p.proowner
   where p.oid=to_regprocedure('public.normalize_validation_config_v0131a5(jsonb)');
  if not found or v_normalizer.provolatile <> 'i' or v_normalizer.prosecdef
     or v_normalizer.owner_name <> 'postgres'
     or v_normalizer.proconfig is distinct from array['search_path=pg_catalog']::text[] then
    raise exception 'ÉCHEC A5: normaliseur absent ou propriétés incorrectes.';
  end if;

  select p.*,r.rolname owner_name into v_rpc
    from pg_catalog.pg_proc p join pg_catalog.pg_roles r on r.oid=p.proowner
   where p.oid=to_regprocedure(
     'public.save_relation_field_validation_draft_v0131a53(text,text,text,jsonb,timestamp with time zone)'
   );
  if not found or v_rpc.prorettype <> 'jsonb'::regtype or not v_rpc.prosecdef
     or v_rpc.owner_name <> 'postgres'
     or v_rpc.proconfig is distinct from array['search_path=pg_catalog']::text[] then
    raise exception 'ÉCHEC A5: RPC absente, signature, propriétaire ou sécurité incorrecte.';
  end if;
  select oid into v_role from pg_catalog.pg_roles where rolname='authenticated';
  select oid into v_anon from pg_catalog.pg_roles where rolname='anon';
  if not has_function_privilege(v_role,v_rpc.oid,'EXECUTE')
     or has_function_privilege(v_anon,v_rpc.oid,'EXECUTE')
     or has_function_privilege('public',v_rpc.oid,'EXECUTE') then
    raise exception 'ÉCHEC A5: privilèges RPC incorrects.';
  end if;

  v_source := pg_catalog.lower(pg_catalog.regexp_replace(
    v_rpc.prosrc || ' ' || v_normalizer.prosrc,'[[:space:]]+',' ','g'
  ));
  if v_source ~ '(^|[^a-z_])execute[[:space:]]'
     or v_source ~ '(^|[^a-z_])format[[:space:]]*[(]' then
    raise exception 'ÉCHEC A5: SQL dynamique détecté.';
  end if;
  foreach v_column in array array[
    'auth.uid()','current_app_role()','for update','p_expected_updated_at',
    'stale_draft','no_change','validation_draft_saved','actor_app_role',
    'event_type','configuration_status = ''draft''',
    'normalize_validation_config_v0131a5'
  ] loop
    if pg_catalog.strpos(v_source,v_column)=0 then
      raise exception 'ÉCHEC A5: garde attendue absente: %.',v_column;
    end if;
  end loop;
  for v_target in
    select distinct m.value[3] from pg_catalog.regexp_matches(
      v_source,
      '(insert[[:space:]]+into|update|delete[[:space:]]+from|truncate([[:space:]]+table)?)[[:space:]]+([a-z_][a-z0-9_.]*)',
      'g'
    ) m(value)
  loop
    if v_target not in ('public.relation_fields','public.relation_field_config_audit') then
      raise exception 'ÉCHEC A5: cible d’écriture non autorisée: %.',v_target;
    end if;
  end loop;
  if not exists (
    select 1 from pg_catalog.pg_constraint
     where conrelid='public.relation_fields'::regclass
       and conname='relation_fields_validation_rules_object_v0131a5_check'
       and contype='c'
  ) then raise exception 'ÉCHEC A5: CHECK validation_rules absent.'; end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
     where conrelid='public.relation_field_config_audit'::regclass
       and conname='relation_field_config_audit_type_v0131a5_check'
       and pg_catalog.pg_get_constraintdef(oid) like '%validation%'
  ) then raise exception 'ÉCHEC A5: extension du type d''audit absente.'; end if;
end;
$$;

rollback;
