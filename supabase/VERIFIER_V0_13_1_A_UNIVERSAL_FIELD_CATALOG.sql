-- Vérification structurelle non mutative de la Phase 13.1-A1.
-- À exécuter après V0_13_1_A_UNIVERSAL_FIELD_CATALOG.sql.
begin read only;

do $$
declare
  required_column text;
  function_signature text;
  function_record record;
  constraint_record record;
  constraint_definition text;
  expected_value text;
  support_metadata record;
  authenticated_oid oid;
  anon_oid oid;
begin
  foreach required_column in array array[
    'field_type',
    'help_text',
    'default_value',
    'required_override',
    'readonly_override',
    'unique_override',
    'display_order',
    'show_in_grid',
    'show_in_form',
    'show_in_360',
    'show_on_mobile',
    'available_in_import',
    'available_in_export',
    'validation_rules',
    'choice_options',
    'file_config',
    'relation_config',
    'calculation_config',
    'role_permissions',
    'configuration_status',
    'technical_name_locked',
    'physical_data_type',
    'physical_udt_name',
    'physical_is_nullable',
    'physical_column_default',
    'physical_maximum_length',
    'physical_numeric_precision',
    'physical_numeric_scale',
    'physical_ordinal_position',
    'physical_is_primary_key',
    'physical_is_unique',
    'physical_is_foreign_key',
    'physical_foreign_table',
    'physical_foreign_column',
    'physical_is_generated',
    'physical_generation_expression',
    'physical_is_identity'
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

  if to_regprocedure('public.list_public_schema_fields()') is null then
    raise exception 'ÉCHEC: la RPC historique list_public_schema_fields a été retirée.';
  end if;

  select oid into authenticated_oid from pg_catalog.pg_roles where rolname = 'authenticated';
  select oid into anon_oid from pg_catalog.pg_roles where rolname = 'anon';
  if authenticated_oid is null or anon_oid is null then
    raise exception 'ÉCHEC: rôles Supabase authenticated/anon absents.';
  end if;

  foreach function_signature in array array[
    'public.list_public_schema_fields_v0131a()',
    'public.refresh_relation_field_physical_metadata_v0131a()'
  ]
  loop
    select
      p.oid,
      p.proowner,
      r.rolname as owner_name,
      p.prosecdef,
      p.proconfig,
      p.proacl
      into function_record
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      join pg_catalog.pg_roles r on r.oid = p.proowner
     where p.oid = to_regprocedure(function_signature);

    if not found then
      raise exception 'ÉCHEC: fonction % absente ou signature incorrecte.', function_signature;
    end if;
    if function_record.owner_name <> 'postgres' then
      raise exception 'ÉCHEC: propriétaire inattendu pour %: %.', function_signature, function_record.owner_name;
    end if;
    if function_record.prosecdef is not true then
      raise exception 'ÉCHEC: % doit être SECURITY DEFINER.', function_signature;
    end if;
    if function_record.proconfig is distinct from array['search_path=pg_catalog']::text[] then
      raise exception 'ÉCHEC: search_path non sécurisé pour %: %.', function_signature, function_record.proconfig;
    end if;
    if not pg_catalog.has_function_privilege(authenticated_oid, function_record.oid, 'EXECUTE') then
      raise exception 'ÉCHEC: authenticated doit pouvoir exécuter %.', function_signature;
    end if;
    if pg_catalog.has_function_privilege(anon_oid, function_record.oid, 'EXECUTE') then
      raise exception 'ÉCHEC: anon ne doit pas pouvoir exécuter %.', function_signature;
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
      raise exception 'ÉCHEC: privilège EXECUTE inattendu sur %.', function_signature;
    end if;
  end loop;

  select convalidated, pg_catalog.pg_get_constraintdef(oid, true) as definition
    into constraint_record
    from pg_catalog.pg_constraint
   where conrelid = 'public.relation_fields'::regclass
     and conname = 'relation_fields_field_type_v0131a_check'
     and contype = 'c';
  if not found then
    raise exception 'ÉCHEC: contrainte field_type absente ou incorrecte.';
  end if;
  constraint_definition := lower(constraint_record.definition);
  foreach expected_value in array array[
    'short_text', 'long_text', 'number', 'currency', 'date', 'datetime',
    'boolean', 'single_select', 'multi_select', 'photo', 'file',
    'relation', 'calculated'
  ]
  loop
    if pg_catalog.strpos(
      constraint_definition,
      pg_catalog.quote_literal(expected_value)
    ) = 0 then
      raise exception 'ÉCHEC: valeur % absente de la contrainte field_type.', expected_value;
    end if;
  end loop;
  if constraint_definition not like '%field_type is null%'
     or constraint_definition not like '%field_type = any%' then
    raise exception 'ÉCHEC: structure inattendue de la contrainte field_type.';
  end if;

  select convalidated, pg_catalog.pg_get_constraintdef(oid, true) as definition
    into constraint_record
    from pg_catalog.pg_constraint
   where conrelid = 'public.relation_fields'::regclass
     and conname = 'relation_fields_configuration_status_v0131a_check'
     and contype = 'c';
  if not found then
    raise exception 'ÉCHEC: contrainte configuration_status absente ou incorrecte.';
  end if;
  constraint_definition := lower(constraint_record.definition);
  foreach expected_value in array array['unconfigured', 'draft', 'active', 'inactive']
  loop
    if pg_catalog.strpos(
      constraint_definition,
      pg_catalog.quote_literal(expected_value)
    ) = 0 then
      raise exception 'ÉCHEC: valeur % absente de la contrainte configuration_status.', expected_value;
    end if;
  end loop;
  if constraint_definition not like '%configuration_status = any%' then
    raise exception 'ÉCHEC: structure inattendue de la contrainte configuration_status.';
  end if;

  select *
    into support_metadata
    from public.list_public_schema_fields_v0131a()
   where table_name = 'infrastructures'
     and column_name = 'support_id';
  if not found
     or support_metadata.data_type <> 'text'
     or support_metadata.is_unique is not true then
    raise exception 'ÉCHEC: support_id doit demeurer présent, text et unique.';
  end if;

  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'relation_fields'
       and column_name in (
         'show_in_grid', 'show_in_form', 'show_in_360', 'show_on_mobile',
         'available_in_import', 'available_in_export', 'required_override',
         'readonly_override', 'unique_override'
       )
       and column_default is not null
  ) then
    raise exception 'ÉCHEC: un réglage optionnel active un comportement par défaut.';
  end if;

  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'relation_fields'
       and column_name = 'configuration_status'
       and is_nullable = 'NO'
       and column_default like '%unconfigured%'
  ) then
    raise exception 'ÉCHEC: statut conservateur unconfigured absent ou nullable.';
  end if;
end;
$$;

rollback;
