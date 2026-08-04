-- Vérification strictement non mutative de la Phase 13.1-A4.2.
-- La RPC d'écriture n'est jamais exécutée.
begin read only;

do $$
declare
  function_record record;
  authenticated_oid oid;
  anon_oid oid;
  audit_owner oid;
  normalized_source text;
  write_target text;
  required_column text;
  support_metadata record;
begin
  if to_regclass('public.relation_field_config_audit') is null then
    raise exception 'ÉCHEC: table d''audit commune absente.';
  end if;

  foreach required_column in array array[
    'audit_schema_version',
    'configuration_type',
    'contract_name',
    'contract_version',
    'changed_properties',
    'actor_user_id',
    'occurred_at',
    'transaction_id'
  ]
  loop
    if not exists (
      select 1
        from information_schema.columns
       where table_schema = 'public'
         and table_name = 'relation_field_config_audit'
         and column_name = required_column
    ) then
      raise exception 'ÉCHEC: colonne d''audit % absente.', required_column;
    end if;
  end loop;

  foreach required_column in array array[
    'show_in_grid',
    'show_in_form',
    'show_in_360',
    'display_order',
    'readonly_override',
    'configuration_status'
  ]
  loop
    if not exists (
      select 1
        from information_schema.columns
       where table_schema = 'public'
         and table_name = 'relation_fields'
         and column_name = required_column
    ) then
      raise exception 'ÉCHEC: colonne relation_fields.% absente.', required_column;
    end if;
  end loop;

  select oid into authenticated_oid
    from pg_catalog.pg_roles
   where rolname = 'authenticated';
  select oid into anon_oid
    from pg_catalog.pg_roles
   where rolname = 'anon';
  if authenticated_oid is null or anon_oid is null then
    raise exception 'ÉCHEC: rôles Supabase authenticated/anon absents.';
  end if;

  select
    p.oid,
    p.proowner,
    r.rolname as owner_name,
    p.prosecdef,
    p.proconfig,
    p.proacl,
    p.prosrc,
    p.prorettype
    into function_record
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    join pg_catalog.pg_roles r on r.oid = p.proowner
   where p.oid = to_regprocedure(
     'public.save_relation_field_display_draft_v0131a42(text,text,text,boolean,boolean,boolean,integer,boolean)'
   );

  if not found then
    raise exception 'ÉCHEC: RPC A4.2 absente ou signature incorrecte.';
  end if;
  if function_record.prorettype <> 'jsonb'::pg_catalog.regtype then
    raise exception 'ÉCHEC: la RPC A4.2 doit retourner jsonb.';
  end if;
  if function_record.owner_name <> 'postgres' then
    raise exception 'ÉCHEC: propriétaire RPC inattendu: %.', function_record.owner_name;
  end if;
  if function_record.prosecdef is not true then
    raise exception 'ÉCHEC: la RPC A4.2 doit être SECURITY DEFINER.';
  end if;
  if function_record.proconfig is distinct from array['search_path=pg_catalog']::text[] then
    raise exception 'ÉCHEC: search_path RPC non sécurisé: %.', function_record.proconfig;
  end if;
  if not pg_catalog.has_function_privilege(
    authenticated_oid,
    function_record.oid,
    'EXECUTE'
  ) then
    raise exception 'ÉCHEC: authenticated doit pouvoir exécuter la RPC A4.2.';
  end if;
  if pg_catalog.has_function_privilege(anon_oid, function_record.oid, 'EXECUTE') then
    raise exception 'ÉCHEC: anon ne doit pas pouvoir exécuter la RPC A4.2.';
  end if;
  if exists (
    select 1
      from pg_catalog.aclexplode(
        coalesce(
          function_record.proacl,
          pg_catalog.acldefault('f', function_record.proowner)
        )
      ) acl
     where acl.privilege_type = 'EXECUTE'
       and acl.grantee not in (function_record.proowner, authenticated_oid)
  ) then
    raise exception 'ÉCHEC: privilège EXECUTE inattendu sur la RPC A4.2.';
  end if;

  select c.relowner
    into audit_owner
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'relation_field_config_audit'
     and c.relkind in ('r', 'p');
  if audit_owner is distinct from function_record.proowner then
    raise exception 'ÉCHEC: propriétaires incohérents entre RPC et audit.';
  end if;

  normalized_source := pg_catalog.lower(
    pg_catalog.regexp_replace(function_record.prosrc, '[[:space:]]+', ' ', 'g')
  );

  if normalized_source ~ '(^|[^a-z_])execute[[:space:]]'
     or normalized_source ~ '(^|[^a-z_])format[[:space:]]*[(]'
     or normalized_source ~ '(^|[^a-z_])(call|perform|copy|merge)[[:space:]]' then
    raise exception 'ÉCHEC: SQL dynamique ou instruction indirecte interdite.';
  end if;

  for write_target in
    select distinct matches.value[3]
      from pg_catalog.regexp_matches(
        normalized_source,
        '(insert[[:space:]]+into|update|delete[[:space:]]+from|truncate([[:space:]]+table)?)[[:space:]]+([a-z_][a-z0-9_.]*)',
        'g'
      ) as matches(value)
  loop
    if write_target not in (
      'public.relation_fields',
      'public.relation_field_config_audit'
    ) then
      raise exception 'ÉCHEC: écriture vers une relation non autorisée: %.', write_target;
    end if;
  end loop;

  if normalized_source !~ 'current_app_role[(][)] <> ''administrateur'''
     or normalized_source !~ 'v_actor is null'
     or normalized_source !~ 'p_contract_version is distinct from ''1[.]0[.]0'''
     or normalized_source !~ 'p_display_order < 0 or p_display_order > 100000'
     or normalized_source !~ 'configuration_status = ''draft'''
     or normalized_source !~ '''status'', ''no_change'''
     or normalized_source !~ '''status'', ''draft_saved'''
     or normalized_source !~ 'insert into public[.]relation_field_config_audit' then
    raise exception 'ÉCHEC: garde Administrateur, contrat, limites, draft, no_change ou audit absent.';
  end if;

  foreach required_column in array array[
    'show_in_grid',
    'show_in_form',
    'show_in_360',
    'display_order',
    'readonly_override'
  ]
  loop
    if pg_catalog.strpos(normalized_source, required_column) = 0 then
      raise exception 'ÉCHEC: propriété A4.2 % absente de la RPC.', required_column;
    end if;
  end loop;

  foreach required_column in array array[
    'physical_is_primary_key',
    'physical_is_foreign_key',
    'physical_is_generated',
    'physical_is_identity',
    'support_id',
    'photo_principale_url',
    'photo_miniature_url',
    'visuel_actuel_cadre',
    '%\_id'
  ]
  loop
    if pg_catalog.strpos(normalized_source, required_column) = 0 then
      raise exception 'ÉCHEC: protection A4.2 % absente.', required_column;
    end if;
  end loop;

  if pg_catalog.strpos(
    normalized_source,
    'return pg_catalog.jsonb_build_object( ''changed'', false'
  ) = 0 then
    raise exception 'ÉCHEC: retour no_change absent avant toute écriture.';
  end if;

  if not exists (
    select 1
      from pg_catalog.pg_constraint
     where conrelid = 'public.relation_field_config_audit'::pg_catalog.regclass
       and conname = 'relation_field_config_audit_type_v0131a42_check'
       and contype = 'c'
  ) then
    raise exception 'ÉCHEC: contrainte de type d''audit A4.2 absente.';
  end if;

  select *
    into support_metadata
    from public.list_public_schema_fields_v0131a()
   where table_name = 'infrastructures'
     and column_name = 'support_id';
  if not found
     or support_metadata.data_type <> 'text'
     or support_metadata.is_unique is not true then
    raise exception 'ÉCHEC: intégrité physique de support_id non confirmée.';
  end if;

  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'infrastructures'
       and column_name = 'photo_principale_url'
  ) or not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'infrastructures'
       and column_name = 'photo_miniature_url'
  ) or not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'infrastructures'
       and column_name = 'visuel_actuel_cadre'
  ) then
    raise exception 'ÉCHEC: références photo Infrastructure incomplètes.';
  end if;
end;
$$;

rollback;
