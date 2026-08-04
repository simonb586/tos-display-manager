-- Vérification strictement non mutative de la Phase 13.1-A3.
-- La RPC d'écriture n'est jamais exécutée.
begin read only;

do $$
declare
  function_record record;
  audit_constraint record;
  authenticated_oid oid;
  anon_oid oid;
  audit_owner oid;
  sequence_owner oid;
  constraint_definition text;
  normalized_source text;
  write_target text;
begin
  if to_regclass('public.relation_field_config_audit') is null then
    raise exception 'ÉCHEC: table d''audit A3 absente.';
  end if;
  if to_regclass('public.relation_field_config_audit_id_seq') is null then
    raise exception 'ÉCHEC: séquence d''audit A3 absente.';
  end if;

  select oid into authenticated_oid from pg_catalog.pg_roles where rolname = 'authenticated';
  select oid into anon_oid from pg_catalog.pg_roles where rolname = 'anon';
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
    p.prosrc
    into function_record
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    join pg_catalog.pg_roles r on r.oid = p.proowner
   where p.oid = to_regprocedure(
     'public.save_relation_field_general_draft_v0131a3(text,text,text,text,text,integer)'
   );

  if not found then
    raise exception 'ÉCHEC: RPC A3 absente ou signature incorrecte.';
  end if;
  if function_record.owner_name <> 'postgres' then
    raise exception 'ÉCHEC: propriétaire RPC inattendu: %.', function_record.owner_name;
  end if;
  if function_record.prosecdef is not true then
    raise exception 'ÉCHEC: la RPC A3 doit être SECURITY DEFINER.';
  end if;
  if function_record.proconfig is distinct from array['search_path=pg_catalog']::text[] then
    raise exception 'ÉCHEC: search_path RPC non sécurisé: %.', function_record.proconfig;
  end if;
  if not pg_catalog.has_function_privilege(authenticated_oid, function_record.oid, 'EXECUTE') then
    raise exception 'ÉCHEC: authenticated doit pouvoir exécuter la RPC A3.';
  end if;
  if pg_catalog.has_function_privilege(anon_oid, function_record.oid, 'EXECUTE') then
    raise exception 'ÉCHEC: anon ne doit pas pouvoir exécuter la RPC A3.';
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
    raise exception 'ÉCHEC: privilège EXECUTE inattendu sur la RPC A3.';
  end if;

  select c.relowner
    into audit_owner
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'relation_field_config_audit'
     and c.relkind in ('r', 'p');
  select c.relowner
    into sequence_owner
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'relation_field_config_audit_id_seq'
     and c.relkind = 'S';
  if audit_owner is distinct from function_record.proowner
     or sequence_owner is distinct from function_record.proowner then
    raise exception 'ÉCHEC: propriétaires incohérents entre RPC, table et séquence d''audit.';
  end if;

  if pg_catalog.has_table_privilege(authenticated_oid, 'public.relation_field_config_audit', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or pg_catalog.has_table_privilege(anon_oid, 'public.relation_field_config_audit', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or pg_catalog.has_sequence_privilege(authenticated_oid, 'public.relation_field_config_audit_id_seq', 'USAGE,SELECT,UPDATE')
     or pg_catalog.has_sequence_privilege(anon_oid, 'public.relation_field_config_audit_id_seq', 'USAGE,SELECT,UPDATE') then
    raise exception 'ÉCHEC: accès direct interdit à la table ou séquence d''audit.';
  end if;
  if exists (
    select 1
      from pg_catalog.pg_class c
      cross join lateral pg_catalog.aclexplode(
        coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))
      ) acl
     where c.oid = 'public.relation_field_config_audit'::regclass
       and acl.grantee <> c.relowner
  ) then
    raise exception 'ÉCHEC: privilège direct inattendu sur la table d''audit.';
  end if;
  if exists (
    select 1
      from pg_catalog.pg_class c
      cross join lateral pg_catalog.aclexplode(
        coalesce(c.relacl, pg_catalog.acldefault('S', c.relowner))
      ) acl
     where c.oid = 'public.relation_field_config_audit_id_seq'::regclass
       and acl.grantee <> c.relowner
  ) then
    raise exception 'ÉCHEC: privilège direct inattendu sur la séquence d''audit.';
  end if;

  select convalidated, pg_catalog.pg_get_constraintdef(oid, true) as definition
    into audit_constraint
    from pg_catalog.pg_constraint
   where conrelid = 'public.relation_field_config_audit'::regclass
     and contype = 'c'
     and pg_catalog.pg_get_constraintdef(oid, true) ilike '%configuration_status%'
     and pg_catalog.pg_get_constraintdef(oid, true) ilike '%draft%';
  if not found or audit_constraint.convalidated is not true then
    raise exception 'ÉCHEC: contrainte audit configuration_status=draft absente ou non validée.';
  end if;
  constraint_definition := lower(audit_constraint.definition);
  if constraint_definition not like '%configuration_status%'
     or constraint_definition not like '%= ''draft''%' then
    raise exception 'ÉCHEC: définition inattendue de la contrainte audit draft.';
  end if;

  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'relation_field_config_audit'
       and column_name = 'configuration_status'
       and is_nullable = 'NO'
       and column_default like '%draft%'
  ) then
    raise exception 'ÉCHEC: configuration_status d''audit doit être NOT NULL et draft par défaut.';
  end if;

  normalized_source := lower(
    pg_catalog.regexp_replace(function_record.prosrc, '[[:space:]]+', ' ', 'g')
  );
  if normalized_source ~ '(^|[^a-z_])execute[[:space:]]'
     or normalized_source ~ '(^|[^a-z_])format[[:space:]]*[(]'
     or normalized_source ~ '(^|[^a-z_])(call|perform|copy|merge)[[:space:]]' then
    raise exception 'ÉCHEC: SQL dynamique ou instruction indirecte interdite dans la RPC A3.';
  end if;
  if normalized_source !~ 'current_app_role[(][)] <> ''administrateur'''
     or normalized_source !~ 'configuration_status[[:space:]]*=[[:space:]]*''draft'''
     or normalized_source !~ 'insert into public[.]relation_field_config_audit' then
    raise exception 'ÉCHEC: contrôle Administrateur, forçage draft ou audit absent.';
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
end;
$$;

rollback;
