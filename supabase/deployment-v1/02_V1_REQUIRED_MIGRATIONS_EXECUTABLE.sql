-- V1.0 - MIGRATIONS CONSOLIDÉES EXÉCUTABLES
-- Reproduction ordonnée des dix migrations officielles; validation globale C1 exclue.
-- Arrêt automatique à la première erreur PostgreSQL.

-- ============================================================================
-- SOURCE 1/10 : V0_13_1_A_UNIVERSAL_FIELD_CATALOG.sql
-- POINT D'ARRÊT LOGIQUE : toute erreur interrompt l'exécution avant la suite.
-- ============================================================================
-- TOS Display Manager — Phase 13.1-A1
-- Fondations non destructives du catalogue universel des champs.
-- Cette migration n'active aucune configuration et ne modifie aucune donnée métier.

begin;

alter table public.relation_fields
  add column if not exists field_type text,
  add column if not exists help_text text,
  add column if not exists default_value jsonb,
  add column if not exists required_override boolean,
  add column if not exists readonly_override boolean,
  add column if not exists unique_override boolean,
  add column if not exists display_order integer,
  add column if not exists show_in_grid boolean,
  add column if not exists show_in_form boolean,
  add column if not exists show_in_360 boolean,
  add column if not exists show_on_mobile boolean,
  add column if not exists available_in_import boolean,
  add column if not exists available_in_export boolean,
  add column if not exists validation_rules jsonb not null default '{}'::jsonb,
  add column if not exists choice_options jsonb not null default '[]'::jsonb,
  add column if not exists file_config jsonb not null default '{}'::jsonb,
  add column if not exists relation_config jsonb not null default '{}'::jsonb,
  add column if not exists calculation_config jsonb not null default '{}'::jsonb,
  add column if not exists role_permissions jsonb not null default '{}'::jsonb,
  add column if not exists configuration_status text not null default 'unconfigured',
  add column if not exists technical_name_locked boolean not null default true,
  add column if not exists physical_data_type text,
  add column if not exists physical_udt_name text,
  add column if not exists physical_is_nullable boolean,
  add column if not exists physical_column_default text,
  add column if not exists physical_maximum_length integer,
  add column if not exists physical_numeric_precision integer,
  add column if not exists physical_numeric_scale integer,
  add column if not exists physical_ordinal_position integer,
  add column if not exists physical_is_primary_key boolean,
  add column if not exists physical_is_unique boolean,
  add column if not exists physical_is_foreign_key boolean,
  add column if not exists physical_foreign_table text,
  add column if not exists physical_foreign_column text,
  add column if not exists physical_is_generated boolean,
  add column if not exists physical_generation_expression text,
  add column if not exists physical_is_identity boolean;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.relation_fields'::regclass
       and conname = 'relation_fields_field_type_v0131a_check'
  ) then
    alter table public.relation_fields
      add constraint relation_fields_field_type_v0131a_check
      check (
        field_type is null or field_type in (
          'short_text',
          'long_text',
          'number',
          'currency',
          'date',
          'datetime',
          'boolean',
          'single_select',
          'multi_select',
          'photo',
          'file',
          'relation',
          'calculated'
        )
      ) not valid;
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.relation_fields'::regclass
       and conname = 'relation_fields_configuration_status_v0131a_check'
  ) then
    alter table public.relation_fields
      add constraint relation_fields_configuration_status_v0131a_check
      check (configuration_status in ('unconfigured', 'draft', 'active', 'inactive'))
      not valid;
  end if;
end;
$$;

create or replace function public.list_public_schema_fields_v0131a()
returns table(
  table_name text,
  column_name text,
  data_type text,
  udt_name text,
  ordinal_position integer,
  is_nullable boolean,
  column_default text,
  character_maximum_length integer,
  numeric_precision integer,
  numeric_scale integer,
  is_primary_key boolean,
  is_unique boolean,
  is_foreign_key boolean,
  foreign_table_name text,
  foreign_column_name text,
  is_generated boolean,
  generation_expression text,
  is_identity boolean
)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select
    c.table_name::text,
    c.column_name::text,
    c.data_type::text,
    c.udt_name::text,
    c.ordinal_position,
    c.is_nullable = 'YES',
    c.column_default::text,
    c.character_maximum_length,
    c.numeric_precision,
    c.numeric_scale,
    exists (
      select 1
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on kcu.constraint_schema = tc.constraint_schema
         and kcu.constraint_name = tc.constraint_name
         and kcu.table_schema = tc.table_schema
         and kcu.table_name = tc.table_name
       where tc.constraint_type = 'PRIMARY KEY'
         and tc.table_schema = c.table_schema
         and tc.table_name = c.table_name
         and kcu.column_name = c.column_name
    ),
    exists (
      select 1
        from pg_catalog.pg_index index_record
        join pg_catalog.pg_class table_record
          on table_record.oid = index_record.indrelid
        join pg_catalog.pg_namespace schema_record
          on schema_record.oid = table_record.relnamespace
        join pg_catalog.pg_attribute attribute_record
          on attribute_record.attrelid = table_record.oid
         and attribute_record.attnum = any(index_record.indkey)
       where index_record.indisunique
         and index_record.indnkeyatts = 1
         and schema_record.nspname = c.table_schema
         and table_record.relname = c.table_name
         and attribute_record.attname = c.column_name
    ),
    fk.foreign_table_name is not null,
    fk.foreign_table_name,
    fk.foreign_column_name,
    c.is_generated <> 'NEVER',
    nullif(c.generation_expression, '')::text,
    c.is_identity = 'YES'
  from information_schema.columns c
  left join lateral (
    select
      referenced_kcu.table_name::text as foreign_table_name,
      referenced_kcu.column_name::text as foreign_column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_schema = tc.constraint_schema
     and kcu.constraint_name = tc.constraint_name
     and kcu.table_schema = tc.table_schema
     and kcu.table_name = tc.table_name
    join information_schema.referential_constraints rc
      on rc.constraint_schema = tc.constraint_schema
     and rc.constraint_name = tc.constraint_name
    join information_schema.key_column_usage referenced_kcu
      on referenced_kcu.constraint_schema = rc.unique_constraint_schema
     and referenced_kcu.constraint_name = rc.unique_constraint_name
     and referenced_kcu.ordinal_position = kcu.position_in_unique_constraint
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = c.table_schema
      and tc.table_name = c.table_name
      and kcu.column_name = c.column_name
    order by tc.constraint_name
    limit 1
  ) fk on true
  where c.table_schema = 'public'
    and c.table_name not in ('schema_migrations', 'spatial_ref_sys')
  order by c.table_name, c.ordinal_position;
$$;

alter function public.list_public_schema_fields_v0131a()
  owner to postgres;

revoke all on function public.list_public_schema_fields_v0131a()
from public, anon;

grant execute on function public.list_public_schema_fields_v0131a()
to authenticated;

create or replace function public.refresh_relation_field_physical_metadata_v0131a()
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  metadata_record record;
  affected_count integer := 0;
begin
  if public.current_app_role() <> 'Administrateur' then
    raise exception 'Permission administrateur requise.';
  end if;

  for metadata_record in
    select * from public.list_public_schema_fields_v0131a()
  loop
    insert into public.relation_fields(
      module_name,
      table_name,
      field_name,
      field_label,
      is_primary_source,
      triggers_updates,
      visible_terrain,
      terrain_roles,
      terrain_readonly,
      validation_status,
      physical_data_type,
      physical_udt_name,
      physical_is_nullable,
      physical_column_default,
      physical_maximum_length,
      physical_numeric_precision,
      physical_numeric_scale,
      physical_ordinal_position,
      physical_is_primary_key,
      physical_is_unique,
      physical_is_foreign_key,
      physical_foreign_table,
      physical_foreign_column,
      physical_is_generated,
      physical_generation_expression,
      physical_is_identity,
      updated_at
    )
    values(
      initcap(replace(metadata_record.table_name, '_', ' ')),
      metadata_record.table_name,
      metadata_record.column_name,
      initcap(replace(metadata_record.column_name, '_', ' ')),
      true,
      false,
      false,
      '{}'::text[],
      true,
      'À confirmer',
      metadata_record.data_type,
      metadata_record.udt_name,
      metadata_record.is_nullable,
      metadata_record.column_default,
      metadata_record.character_maximum_length,
      metadata_record.numeric_precision,
      metadata_record.numeric_scale,
      metadata_record.ordinal_position,
      metadata_record.is_primary_key,
      metadata_record.is_unique,
      metadata_record.is_foreign_key,
      metadata_record.foreign_table_name,
      metadata_record.foreign_column_name,
      metadata_record.is_generated,
      metadata_record.generation_expression,
      metadata_record.is_identity,
      now()
    )
    on conflict(table_name, field_name) do update
      set physical_data_type = excluded.physical_data_type,
          physical_udt_name = excluded.physical_udt_name,
          physical_is_nullable = excluded.physical_is_nullable,
          physical_column_default = excluded.physical_column_default,
          physical_maximum_length = excluded.physical_maximum_length,
          physical_numeric_precision = excluded.physical_numeric_precision,
          physical_numeric_scale = excluded.physical_numeric_scale,
          physical_ordinal_position = excluded.physical_ordinal_position,
          physical_is_primary_key = excluded.physical_is_primary_key,
          physical_is_unique = excluded.physical_is_unique,
          physical_is_foreign_key = excluded.physical_is_foreign_key,
          physical_foreign_table = excluded.physical_foreign_table,
          physical_foreign_column = excluded.physical_foreign_column,
          physical_is_generated = excluded.physical_is_generated,
          physical_generation_expression = excluded.physical_generation_expression,
          physical_is_identity = excluded.physical_is_identity,
          updated_at = now();

    affected_count := affected_count + 1;
  end loop;

  return affected_count;
end;
$$;

alter function public.refresh_relation_field_physical_metadata_v0131a()
  owner to postgres;

revoke all on function public.refresh_relation_field_physical_metadata_v0131a()
from public, anon;

grant execute on function public.refresh_relation_field_physical_metadata_v0131a()
to authenticated;

comment on function public.refresh_relation_field_physical_metadata_v0131a() is
  'Synchronise uniquement le catalogue relation_fields. Ne modifie aucune table métier.';

comment on column public.relation_fields.configuration_status is
  'unconfigured conserve le comportement historique; aucune configuration universelle n''est active.';

comment on column public.relation_fields.technical_name_locked is
  'Documente l''immutabilité du nom technique. Aucun renommage automatique n''est fourni.';

commit;


-- Contrôle léger après V0_13_1_A_UNIVERSAL_FIELD_CATALOG.sql
DO $v1check$ BEGIN
  IF pg_catalog.to_regprocedure('public.list_public_schema_fields_v0131a()') IS NULL THEN RAISE EXCEPTION 'V1 A1: fonction essentielle absente'; END IF;
END $v1check$;

-- ============================================================================
-- SOURCE 2/10 : V0_13_1_A3_FIELD_GENERAL_DRAFT.sql
-- POINT D'ARRÊT LOGIQUE : toute erreur interrompt l'exécution avant la suite.
-- ============================================================================
-- TOS Display Manager — Phase 13.1-A3
-- Configuration générale des champs en brouillon.
-- Migration additive : aucune table métier et aucune colonne physique métier ne sont modifiées.

begin;

create table if not exists public.relation_field_config_audit (
  id bigserial primary key,
  relation_field_id bigint not null,
  table_name text not null,
  field_name text not null,
  old_values jsonb not null,
  new_values jsonb not null,
  changed_by uuid not null,
  changed_at timestamptz not null default now(),
  configuration_status text not null default 'draft'
    check (configuration_status = 'draft')
);

create index if not exists relation_field_config_audit_field_idx
  on public.relation_field_config_audit(relation_field_id, changed_at desc);

alter table public.relation_field_config_audit owner to postgres;
alter sequence public.relation_field_config_audit_id_seq owner to postgres;

revoke all on public.relation_field_config_audit from public, anon, authenticated;
revoke all on sequence public.relation_field_config_audit_id_seq from public, anon, authenticated;

create or replace function public.save_relation_field_general_draft_v0131a3(
  p_table_name text,
  p_field_name text,
  p_field_label text,
  p_field_type text,
  p_help_text text,
  p_display_order integer
)
returns public.relation_fields
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_old public.relation_fields%rowtype;
  v_updated public.relation_fields%rowtype;
  v_old_values jsonb;
  v_new_values jsonb;
begin
  if auth.uid() is null or public.current_app_role() <> 'Administrateur' then
    raise exception 'Permission administrateur requise.';
  end if;

  if nullif(trim(p_table_name), '') is null or nullif(trim(p_field_name), '') is null then
    raise exception 'La table et le nom technique sont obligatoires.';
  end if;

  select *
    into v_old
    from public.relation_fields
   where table_name = p_table_name
     and field_name = p_field_name
   for update;

  if not found then
    raise exception 'Champ inconnu dans relation_fields.';
  end if;

  if coalesce(v_old.technical_name_locked, true) = false then
    raise exception 'Le nom technique doit demeurer verrouillé.';
  end if;

  if coalesce(v_old.physical_is_primary_key, false)
     or coalesce(v_old.physical_is_foreign_key, false)
     or coalesce(v_old.physical_is_generated, false)
     or coalesce(v_old.physical_is_identity, false)
     or lower(v_old.field_name) in (
       'id', 'support_id', 'created_at', 'updated_at', 'deleted_at', 'auth_user_id',
       'photo_principale_url', 'photo_miniature_url', 'visuel_actuel_cadre'
     )
     or lower(v_old.field_name) like '%\_id' escape '\'
  then
    raise exception 'Ce champ système ou identifiant technique est protégé.';
  end if;

  if nullif(trim(p_field_label), '') is null or char_length(trim(p_field_label)) > 160 then
    raise exception 'Le libellé doit contenir entre 1 et 160 caractères.';
  end if;

  if p_field_type is null or p_field_type not in (
    'short_text', 'long_text', 'number', 'currency', 'date', 'datetime',
    'boolean', 'single_select', 'multi_select', 'photo', 'file',
    'relation', 'calculated'
  ) then
    raise exception 'Type fonctionnel invalide.';
  end if;

  if char_length(coalesce(p_help_text, '')) > 4000 then
    raise exception 'Le texte d''aide dépasse 4 000 caractères.';
  end if;

  if p_display_order is not null and (p_display_order < 0 or p_display_order > 100000) then
    raise exception 'L''ordre d''affichage doit être compris entre 0 et 100 000.';
  end if;

  v_old_values := jsonb_build_object(
    'field_label', v_old.field_label,
    'field_type', v_old.field_type,
    'help_text', v_old.help_text,
    'display_order', v_old.display_order,
    'configuration_status', v_old.configuration_status
  );

  update public.relation_fields
     set field_label = trim(p_field_label),
         field_type = p_field_type,
         help_text = nullif(trim(coalesce(p_help_text, '')), ''),
         display_order = p_display_order,
         configuration_status = 'draft',
         technical_name_locked = true,
         updated_at = now()
   where id = v_old.id
   returning * into v_updated;

  v_new_values := jsonb_build_object(
    'field_label', v_updated.field_label,
    'field_type', v_updated.field_type,
    'help_text', v_updated.help_text,
    'display_order', v_updated.display_order,
    'configuration_status', v_updated.configuration_status
  );

  insert into public.relation_field_config_audit(
    relation_field_id,
    table_name,
    field_name,
    old_values,
    new_values,
    changed_by,
    changed_at,
    configuration_status
  )
  values(
    v_updated.id,
    v_updated.table_name,
    v_updated.field_name,
    v_old_values,
    v_new_values,
    auth.uid(),
    now(),
    'draft'
  );

  return v_updated;
end;
$$;

alter function public.save_relation_field_general_draft_v0131a3(
  text, text, text, text, text, integer
) owner to postgres;

revoke all on function public.save_relation_field_general_draft_v0131a3(
  text, text, text, text, text, integer
) from public, anon;

grant execute on function public.save_relation_field_general_draft_v0131a3(
  text, text, text, text, text, integer
) to authenticated;

comment on function public.save_relation_field_general_draft_v0131a3(
  text, text, text, text, text, integer
) is 'Met à jour uniquement les métadonnées générales autorisées de relation_fields, force draft et journalise le changement.';

commit;


-- Contrôle léger après V0_13_1_A3_FIELD_GENERAL_DRAFT.sql
DO $v1check$ BEGIN
  IF pg_catalog.to_regclass('public.relation_field_config_audit') IS NULL OR pg_catalog.to_regprocedure('public.save_relation_field_general_draft_v0131a3(text,text,text,text,text,integer)') IS NULL THEN RAISE EXCEPTION 'V1 A3: objets essentiels absents'; END IF;
END $v1check$;

-- ============================================================================
-- SOURCE 3/10 : V0_13_1_A4_2_DISPLAY_DRAFT.sql
-- POINT D'ARRÊT LOGIQUE : toute erreur interrompt l'exécution avant la suite.
-- ============================================================================
-- TOS Display Manager — Phase 13.1-A4.2
-- Stockage additif des brouillons DisplayConfig 1.0.0.
-- N'active aucune configuration et ne modifie aucune table métier.

begin;

alter table public.relation_field_config_audit
  add column if not exists audit_schema_version text,
  add column if not exists configuration_type text,
  add column if not exists contract_name text,
  add column if not exists contract_version text,
  add column if not exists changed_properties text[],
  add column if not exists actor_user_id uuid,
  add column if not exists occurred_at timestamptz,
  add column if not exists transaction_id text;

do $$
begin
  if not exists (
    select 1
      from pg_catalog.pg_constraint
     where conrelid = 'public.relation_field_config_audit'::pg_catalog.regclass
       and conname = 'relation_field_config_audit_type_v0131a42_check'
  ) then
    alter table public.relation_field_config_audit
      add constraint relation_field_config_audit_type_v0131a42_check
      check (
        configuration_type is null
        or configuration_type in ('general', 'display')
      ) not valid;
  end if;
end;
$$;

create or replace function public.save_relation_field_display_draft_v0131a42(
  p_table_name text,
  p_field_name text,
  p_contract_version text,
  p_show_in_grid boolean,
  p_show_in_form boolean,
  p_show_in_360 boolean,
  p_display_order integer,
  p_readonly_override boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_old public.relation_fields%rowtype;
  v_updated public.relation_fields%rowtype;
  v_old_values jsonb;
  v_new_values jsonb;
  v_changed_properties text[] := array[]::text[];
  v_actor uuid;
begin
  v_actor := auth.uid();
  if v_actor is null or public.current_app_role() <> 'Administrateur' then
    raise exception 'Permission administrateur requise.';
  end if;

  if p_contract_version is distinct from '1.0.0' then
    raise exception 'Version DisplayConfig non supportée.';
  end if;

  if p_table_name is null or pg_catalog.btrim(p_table_name) = ''
     or p_field_name is null or pg_catalog.btrim(p_field_name) = '' then
    raise exception 'La table et le nom technique sont obligatoires.';
  end if;

  if p_display_order is not null
     and (p_display_order < 0 or p_display_order > 100000) then
    raise exception 'L''ordre d''affichage doit être compris entre 0 et 100 000.';
  end if;

  select *
    into v_old
    from public.relation_fields
   where table_name = p_table_name
     and field_name = p_field_name
   for update;

  if not found then
    raise exception 'Champ ou table inconnu dans relation_fields.';
  end if;

  if coalesce(v_old.physical_is_primary_key, false)
     or coalesce(v_old.physical_is_foreign_key, false)
     or coalesce(v_old.physical_is_generated, false)
     or coalesce(v_old.physical_is_identity, false)
     or pg_catalog.lower(v_old.field_name) in (
       'id', 'support_id', 'created_at', 'updated_at', 'deleted_at',
       'auth_user_id', 'photo_principale_url', 'photo_miniature_url',
       'visuel_actuel_cadre'
     )
     or pg_catalog.lower(v_old.field_name) like '%\_id' escape '\'
  then
    raise exception 'Ce champ système ou identifiant technique est protégé.';
  end if;

  if v_old.show_in_grid is not distinct from p_show_in_grid
     and v_old.show_in_form is not distinct from p_show_in_form
     and v_old.show_in_360 is not distinct from p_show_in_360
     and v_old.display_order is not distinct from p_display_order
     and v_old.readonly_override is not distinct from p_readonly_override
     and v_old.configuration_status = 'draft' then
    return pg_catalog.jsonb_build_object(
      'changed', false,
      'status', 'no_change',
      'contractName', 'DisplayConfig',
      'contractVersion', '1.0.0'
    );
  end if;

  if v_old.show_in_grid is distinct from p_show_in_grid then
    v_changed_properties := pg_catalog.array_append(v_changed_properties, 'show_in_grid');
  end if;
  if v_old.show_in_form is distinct from p_show_in_form then
    v_changed_properties := pg_catalog.array_append(v_changed_properties, 'show_in_form');
  end if;
  if v_old.show_in_360 is distinct from p_show_in_360 then
    v_changed_properties := pg_catalog.array_append(v_changed_properties, 'show_in_360');
  end if;
  if v_old.display_order is distinct from p_display_order then
    v_changed_properties := pg_catalog.array_append(v_changed_properties, 'display_order');
  end if;
  if v_old.readonly_override is distinct from p_readonly_override then
    v_changed_properties := pg_catalog.array_append(v_changed_properties, 'readonly_override');
  end if;
  if v_old.configuration_status is distinct from 'draft' then
    v_changed_properties := pg_catalog.array_append(v_changed_properties, 'configuration_status');
  end if;

  v_old_values := pg_catalog.jsonb_build_object(
    'show_in_grid', v_old.show_in_grid,
    'show_in_form', v_old.show_in_form,
    'show_in_360', v_old.show_in_360,
    'display_order', v_old.display_order,
    'readonly_override', v_old.readonly_override,
    'configuration_status', v_old.configuration_status
  );

  update public.relation_fields
     set show_in_grid = p_show_in_grid,
         show_in_form = p_show_in_form,
         show_in_360 = p_show_in_360,
         display_order = p_display_order,
         readonly_override = p_readonly_override,
         configuration_status = 'draft',
         updated_at = pg_catalog.now()
   where id = v_old.id
   returning * into v_updated;

  v_new_values := pg_catalog.jsonb_build_object(
    'show_in_grid', v_updated.show_in_grid,
    'show_in_form', v_updated.show_in_form,
    'show_in_360', v_updated.show_in_360,
    'display_order', v_updated.display_order,
    'readonly_override', v_updated.readonly_override,
    'configuration_status', v_updated.configuration_status
  );

  insert into public.relation_field_config_audit(
    relation_field_id,
    table_name,
    field_name,
    old_values,
    new_values,
    changed_by,
    changed_at,
    configuration_status,
    audit_schema_version,
    configuration_type,
    contract_name,
    contract_version,
    changed_properties,
    actor_user_id,
    occurred_at,
    transaction_id
  )
  values(
    v_updated.id,
    v_updated.table_name,
    v_updated.field_name,
    v_old_values,
    v_new_values,
    v_actor,
    pg_catalog.now(),
    'draft',
    '1.0.0',
    'display',
    'DisplayConfig',
    '1.0.0',
    v_changed_properties,
    v_actor,
    pg_catalog.now(),
    pg_catalog.txid_current()::text
  );

  return pg_catalog.jsonb_build_object(
    'changed', true,
    'status', 'draft_saved',
    'contractName', 'DisplayConfig',
    'contractVersion', '1.0.0',
    'changedProperties', pg_catalog.to_jsonb(v_changed_properties)
  );
end;
$$;

alter function public.save_relation_field_display_draft_v0131a42(
  text, text, text, boolean, boolean, boolean, integer, boolean
) owner to postgres;

revoke all on function public.save_relation_field_display_draft_v0131a42(
  text, text, text, boolean, boolean, boolean, integer, boolean
) from public, anon;

grant execute on function public.save_relation_field_display_draft_v0131a42(
  text, text, text, boolean, boolean, boolean, integer, boolean
) to authenticated;

comment on function public.save_relation_field_display_draft_v0131a42(
  text, text, text, boolean, boolean, boolean, integer, boolean
) is 'Enregistre uniquement un brouillon DisplayConfig 1.0.0 dans relation_fields avec audit commun versionné.';

commit;


-- Contrôle léger après V0_13_1_A4_2_DISPLAY_DRAFT.sql
DO $v1check$ BEGIN
  IF pg_catalog.to_regprocedure('public.save_relation_field_display_draft_v0131a42(text,text,text,boolean,boolean,boolean,integer,boolean)') IS NULL THEN RAISE EXCEPTION 'V1 A4: RPC essentielle absente'; END IF;
END $v1check$;

-- ============================================================================
-- SOURCE 4/10 : V0_13_1_A5_VALIDATION_DRAFT.sql
-- POINT D'ARRÊT LOGIQUE : toute erreur interrompt l'exécution avant la suite.
-- ============================================================================
-- TOS Display Manager — Phase 13.1-A5
-- Stockage additif des brouillons ValidationConfig 1.0.0.
-- À valider en préproduction avant toute exécution. Aucune activation métier.

begin;

alter table public.relation_field_config_audit
  add column if not exists actor_app_role text,
  add column if not exists event_type text;

alter table public.relation_fields
  alter column validation_rules set default '{}'::jsonb,
  alter column validation_rules set not null;

comment on column public.relation_fields.validation_rules is
  'Brouillon administratif ValidationConfig 1.0.0. {} signifie aucune configuration préparée; aucune activation implicite.';
comment on column public.relation_field_config_audit.actor_app_role is
  'Rôle applicatif de l’acteur au moment de l’événement administratif.';
comment on column public.relation_field_config_audit.event_type is
  'Type versionné de l’événement de configuration administrative.';

do $$
begin
  if exists (
    select 1 from pg_catalog.pg_constraint
     where conrelid = 'public.relation_field_config_audit'::pg_catalog.regclass
       and conname = 'relation_field_config_audit_type_v0131a42_check'
  ) then
    alter table public.relation_field_config_audit
      drop constraint relation_field_config_audit_type_v0131a42_check;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
     where conrelid = 'public.relation_field_config_audit'::pg_catalog.regclass
       and conname = 'relation_field_config_audit_type_v0131a5_check'
  ) then
    alter table public.relation_field_config_audit
      add constraint relation_field_config_audit_type_v0131a5_check
      check (configuration_type is null or configuration_type in ('general','display','validation'))
      not valid;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
     where conrelid = 'public.relation_fields'::pg_catalog.regclass
       and conname = 'relation_fields_validation_rules_object_v0131a5_check'
  ) then
    alter table public.relation_fields
      add constraint relation_fields_validation_rules_object_v0131a5_check
      check (pg_catalog.jsonb_typeof(validation_rules) = 'object') not valid;
  end if;
end;
$$;

create or replace function public.normalize_validation_config_v0131a5(
  p_config jsonb
)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $$
declare
  v_allowed_keys constant text[] := array[
    'requiredOverride', 'minimumLength', 'maximumLength', 'minimumValue',
    'maximumValue', 'allowedValues', 'errorMessages'
  ];
  v_message_keys constant text[] := array[
    'requiredOverride', 'minimumLength', 'maximumLength', 'minimumValue',
    'maximumValue', 'allowedValues'
  ];
  v_key text;
  v_item jsonb;
  v_message text;
  v_allowed jsonb;
  v_messages jsonb;
  v_min_length integer;
  v_max_length integer;
  v_min_value numeric;
  v_max_value numeric;
begin
  if p_config is null or pg_catalog.jsonb_typeof(p_config) <> 'object' then
    raise exception using message = 'Configuration de validation invalide.', detail = '{"code":"invalid_payload"}';
  end if;

  for v_key in select pg_catalog.jsonb_object_keys(p_config)
  loop
    if not (v_key = any(v_allowed_keys)) then
      raise exception using message = 'Propriété ValidationConfig inconnue.', detail = pg_catalog.jsonb_build_object('code','unknown_property','field',v_key)::text;
    end if;
  end loop;

  if p_config ? 'requiredOverride'
     and p_config->'requiredOverride' <> 'null'::jsonb
     and pg_catalog.jsonb_typeof(p_config->'requiredOverride') <> 'boolean' then
    raise exception using message = 'requiredOverride doit être booléen ou null.', detail = '{"code":"invalid_required_override","field":"requiredOverride"}';
  end if;

  if p_config ? 'minimumLength' and p_config->'minimumLength' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_config->'minimumLength') <> 'number'
       or (p_config->>'minimumLength') !~ '^[0-9]+$' then
      raise exception using message = 'Longueur minimale invalide.', detail = '{"code":"invalid_minimum_length","field":"minimumLength"}';
    end if;
    v_min_length := (p_config->>'minimumLength')::integer;
  end if;
  if p_config ? 'maximumLength' and p_config->'maximumLength' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_config->'maximumLength') <> 'number'
       or (p_config->>'maximumLength') !~ '^[0-9]+$' then
      raise exception using message = 'Longueur maximale invalide.', detail = '{"code":"invalid_maximum_length","field":"maximumLength"}';
    end if;
    v_max_length := (p_config->>'maximumLength')::integer;
  end if;
  if v_min_length is not null and v_max_length is not null and v_min_length > v_max_length then
    raise exception using message = 'La longueur minimale ne peut pas dépasser la longueur maximale.', detail = '{"code":"minimum_length_exceeds_maximum_length","field":"maximumLength"}';
  end if;

  if p_config ? 'minimumValue' and p_config->'minimumValue' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_config->'minimumValue') <> 'number' then
      raise exception using message = 'Valeur minimale invalide.', detail = '{"code":"invalid_minimum_value","field":"minimumValue"}';
    end if;
    v_min_value := (p_config->>'minimumValue')::numeric;
  end if;
  if p_config ? 'maximumValue' and p_config->'maximumValue' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_config->'maximumValue') <> 'number' then
      raise exception using message = 'Valeur maximale invalide.', detail = '{"code":"invalid_maximum_value","field":"maximumValue"}';
    end if;
    v_max_value := (p_config->>'maximumValue')::numeric;
  end if;
  if v_min_value is not null and v_max_value is not null and v_min_value > v_max_value then
    raise exception using message = 'La valeur minimale ne peut pas dépasser la valeur maximale.', detail = '{"code":"minimum_value_exceeds_maximum_value","field":"maximumValue"}';
  end if;

  v_allowed := coalesce(p_config->'allowedValues', 'null'::jsonb);
  if v_allowed <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(v_allowed) <> 'array' then
      raise exception using message = 'Valeurs permises invalides.', detail = '{"code":"invalid_allowed_values","field":"allowedValues"}';
    end if;
    if pg_catalog.jsonb_array_length(v_allowed) > 100 or pg_catalog.octet_length(v_allowed::text) > 65536 then
      raise exception using message = 'La liste de valeurs permises est trop grande.', detail = '{"code":"allowed_values_too_large","field":"allowedValues"}';
    end if;
    for v_item in select value from pg_catalog.jsonb_array_elements(v_allowed)
    loop
      if pg_catalog.jsonb_typeof(v_item) = 'null' then
        raise exception using message = 'null est interdit dans les valeurs permises.', detail = '{"code":"null_allowed_value","field":"allowedValues"}';
      end if;
      if pg_catalog.jsonb_typeof(v_item) not in ('string','number','boolean')
         or (pg_catalog.jsonb_typeof(v_item) = 'string' and pg_catalog.char_length(v_item #>> '{}') > 500) then
        raise exception using message = 'Valeur permise invalide.', detail = '{"code":"invalid_allowed_values","field":"allowedValues"}';
      end if;
    end loop;
    if exists (
      select 1 from pg_catalog.jsonb_array_elements(v_allowed) item(value)
       group by pg_catalog.jsonb_typeof(value), value having count(*) > 1
    ) then
      raise exception using message = 'Une valeur permise est présente plusieurs fois.', detail = '{"code":"duplicate_allowed_value","field":"allowedValues"}';
    end if;
  end if;

  v_messages := coalesce(p_config->'errorMessages', 'null'::jsonb);
  if v_messages <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(v_messages) <> 'object' then
      raise exception using message = 'Messages de validation invalides.', detail = '{"code":"invalid_error_messages","field":"errorMessages"}';
    end if;
    for v_key, v_item in select key, value from pg_catalog.jsonb_each(v_messages)
    loop
      if not (v_key = any(v_message_keys)) then
        raise exception using message = 'Clé de message inconnue.', detail = pg_catalog.jsonb_build_object('code','unknown_error_message_key','field',v_key)::text;
      end if;
      if pg_catalog.jsonb_typeof(v_item) <> 'string' then
        raise exception using message = 'Message de validation invalide.', detail = '{"code":"invalid_error_messages","field":"errorMessages"}';
      end if;
      v_message := pg_catalog.btrim(v_item #>> '{}');
      if v_message = '' then
        raise exception using message = 'Un message de validation est vide.', detail = '{"code":"error_message_empty","field":"errorMessages"}';
      end if;
      if pg_catalog.char_length(v_message) > 300 then
        raise exception using message = 'Un message de validation est trop long.', detail = '{"code":"error_message_too_long","field":"errorMessages"}';
      end if;
      if v_message ~* '<[^>]*>|javascript[[:space:]]*:|<script|[$][{]|[{][{]' then
        raise exception using message = 'Un message contient du contenu interdit.', detail = '{"code":"error_message_unsafe","field":"errorMessages"}';
      end if;
      v_messages := pg_catalog.jsonb_set(v_messages, array[v_key], pg_catalog.to_jsonb(v_message), false);
    end loop;
  end if;

  return pg_catalog.jsonb_build_object(
    'requiredOverride', coalesce(p_config->'requiredOverride', 'null'::jsonb),
    'minimumLength', coalesce(p_config->'minimumLength', 'null'::jsonb),
    'maximumLength', coalesce(p_config->'maximumLength', 'null'::jsonb),
    'minimumValue', coalesce(p_config->'minimumValue', 'null'::jsonb),
    'maximumValue', coalesce(p_config->'maximumValue', 'null'::jsonb),
    'allowedValues', v_allowed,
    'errorMessages', v_messages
  );
end;
$$;

alter function public.normalize_validation_config_v0131a5(jsonb) owner to postgres;
revoke all on function public.normalize_validation_config_v0131a5(jsonb) from public, anon, authenticated;

create or replace function public.save_relation_field_validation_draft_v0131a53(
  p_table_name text,
  p_field_name text,
  p_contract_version text,
  p_validation_config jsonb,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_old public.relation_fields%rowtype;
  v_old_config jsonb;
  v_new_config jsonb;
  v_changed text[] := array[]::text[];
  v_key text;
  v_actor uuid := auth.uid();
  v_role text;
  v_updated_at timestamptz;
begin
  v_role := public.current_app_role();
  if v_actor is null then
    raise exception using message = 'Authentification requise.', detail = '{"code":"unauthorized"}';
  end if;
  if v_role <> 'Administrateur' then
    raise exception using message = 'Permission administrateur requise.', detail = '{"code":"administrator_required"}';
  end if;
  if p_contract_version is distinct from '1.0.0' then
    raise exception using message = 'Version ValidationConfig non supportée.', detail = '{"code":"unsupported_contract_version"}';
  end if;
  if p_expected_updated_at is null then
    raise exception using message = 'Horodatage attendu obligatoire.', detail = '{"code":"invalid_payload","field":"expectedUpdatedAt"}';
  end if;

  select * into v_old
    from public.relation_fields
   where table_name = p_table_name and field_name = p_field_name
   for update;
  if not found then
    raise exception using message = 'Champ inconnu dans relation_fields.', detail = '{"code":"field_not_found"}';
  end if;
  if v_old.updated_at is distinct from p_expected_updated_at then
    raise exception using message = 'Ce brouillon a été modifié par un autre administrateur.', detail = '{"code":"stale_draft"}';
  end if;
  if coalesce(v_old.physical_is_primary_key,false)
     or coalesce(v_old.physical_is_foreign_key,false)
     or coalesce(v_old.physical_is_generated,false)
     or coalesce(v_old.physical_is_identity,false)
     or v_old.field_type = 'calculated'
     or lower(v_old.field_name) in (
       'id','support_id','created_at','updated_at','deleted_at','auth_user_id',
       'photo_principale_url','photo_miniature_url','visuel_actuel_cadre'
     )
     or lower(v_old.field_name) like '%\_id' escape '\'
  then
    raise exception using message = 'Ce champ est protégé.', detail = '{"code":"field_protected"}';
  end if;

  v_new_config := public.normalize_validation_config_v0131a5(p_validation_config);
  v_old_config := public.normalize_validation_config_v0131a5(
    case when v_old.validation_rules = '{}'::jsonb then '{}'::jsonb else v_old.validation_rules end
  );

  if v_old.field_type in ('number','currency')
     and (v_new_config->'minimumLength' <> 'null'::jsonb or v_new_config->'maximumLength' <> 'null'::jsonb)
     or v_old.field_type in ('short_text','long_text')
     and (v_new_config->'minimumValue' <> 'null'::jsonb or v_new_config->'maximumValue' <> 'null'::jsonb)
     or v_old.field_type in ('date','datetime','boolean','single_select','multi_select','photo','file','relation')
     and (
       v_new_config->'minimumLength' <> 'null'::jsonb
       or v_new_config->'maximumLength' <> 'null'::jsonb
       or v_new_config->'minimumValue' <> 'null'::jsonb
       or v_new_config->'maximumValue' <> 'null'::jsonb
     )
  then
    raise exception using message = 'Règle incompatible avec le type du champ.', detail = '{"code":"incompatible_field_type"}';
  end if;

  if v_old_config = v_new_config and v_old.configuration_status = 'draft' then
    return pg_catalog.jsonb_build_object(
      'ok',true,'changed',false,'code','no_change',
      'validationConfig',v_old_config,'contractVersion','1.0.0','updatedAt',v_old.updated_at
    );
  end if;

  foreach v_key in array array[
    'requiredOverride','minimumLength','maximumLength','minimumValue',
    'maximumValue','allowedValues','errorMessages'
  ] loop
    if v_old_config->v_key is distinct from v_new_config->v_key then
      v_changed := pg_catalog.array_append(v_changed,v_key);
    end if;
  end loop;

  update public.relation_fields
     set validation_rules = v_new_config,
         configuration_status = 'draft',
         updated_at = pg_catalog.now()
   where id = v_old.id
   returning updated_at into v_updated_at;

  insert into public.relation_field_config_audit(
    relation_field_id,table_name,field_name,old_values,new_values,changed_by,
    changed_at,configuration_status,audit_schema_version,configuration_type,
    contract_name,contract_version,changed_properties,actor_user_id,occurred_at,
    transaction_id,actor_app_role,event_type
  ) values (
    v_old.id,v_old.table_name,v_old.field_name,
    pg_catalog.jsonb_build_object('validationConfig',v_old_config,'configuration_status',v_old.configuration_status),
    pg_catalog.jsonb_build_object('validationConfig',v_new_config,'configuration_status','draft'),
    v_actor,pg_catalog.now(),'draft','1.0.0','validation','ValidationConfig',
    '1.0.0',v_changed,v_actor,pg_catalog.now(),pg_catalog.txid_current()::text,
    v_role,'validation_draft_saved'
  );

  return pg_catalog.jsonb_build_object(
    'ok',true,'changed',true,'code','saved','validationConfig',v_new_config,
    'contractVersion','1.0.0','updatedAt',v_updated_at,
    'changedProperties',pg_catalog.to_jsonb(v_changed)
  );
end;
$$;

alter function public.save_relation_field_validation_draft_v0131a53(
  text,text,text,jsonb,timestamptz
) owner to postgres;
revoke all on function public.save_relation_field_validation_draft_v0131a53(
  text,text,text,jsonb,timestamptz
) from public, anon;
grant execute on function public.save_relation_field_validation_draft_v0131a53(
  text,text,text,jsonb,timestamptz
) to authenticated;

comment on function public.save_relation_field_validation_draft_v0131a53(
  text,text,text,jsonb,timestamptz
) is 'Enregistre atomiquement un brouillon ValidationConfig 1.0.0 avec concurrence et audit commun; aucune activation.';

commit;


-- Contrôle léger après V0_13_1_A5_VALIDATION_DRAFT.sql
DO $v1check$ BEGIN
  IF pg_catalog.to_regprocedure('public.save_relation_field_validation_draft_v0131a53(text,text,text,jsonb,timestamp with time zone)') IS NULL THEN RAISE EXCEPTION 'V1 A5: RPC essentielle absente'; END IF;
END $v1check$;

-- ============================================================================
-- SOURCE 5/10 : V0_13_1_A6_PERMISSION_DRAFT.sql
-- POINT D'ARRÊT LOGIQUE : toute erreur interrompt l'exécution avant la suite.
-- ============================================================================
-- Phase 13.1-A6 — fichier local non exécuté. Brouillons PermissionConfig uniquement.
begin;
alter table public.relation_fields alter column role_permissions set default '{}'::jsonb, alter column role_permissions set not null;
comment on column public.relation_fields.role_permissions is 'Brouillon PermissionConfig 1.0.0; aucune autorité sur RLS ou les droits réels.';
do $$ begin
  if not exists(select 1 from pg_catalog.pg_constraint where conrelid='public.relation_fields'::pg_catalog.regclass and conname='relation_fields_role_permissions_object_v0131a6_check') then
    alter table public.relation_fields add constraint relation_fields_role_permissions_object_v0131a6_check check(pg_catalog.jsonb_typeof(role_permissions)='object') not valid;
  end if;
  if exists(select 1 from pg_catalog.pg_constraint where conrelid='public.relation_field_config_audit'::pg_catalog.regclass and conname='relation_field_config_audit_type_v0131a5_check') then
    alter table public.relation_field_config_audit drop constraint relation_field_config_audit_type_v0131a5_check;
  end if;
  if not exists(select 1 from pg_catalog.pg_constraint where conrelid='public.relation_field_config_audit'::pg_catalog.regclass and conname='relation_field_config_audit_type_v0131a6_check') then
    alter table public.relation_field_config_audit add constraint relation_field_config_audit_type_v0131a6_check check(configuration_type is null or configuration_type in('general','display','validation','permission')) not valid;
  end if;
end $$;

create or replace function public.normalize_permission_config_v0131a6(p_config jsonb) returns jsonb language plpgsql immutable security invoker set search_path=pg_catalog as $$
declare v_key text;v_role text;v_rule jsonb;v_cap text;v_roles constant text[]:=array['Administrateur','Coordonnateur','Installateur','Client-Admin','Client'];v_general jsonb;v_role_rules jsonb;
begin
 if p_config is null or pg_catalog.jsonb_typeof(p_config)<>'object' then raise exception using message='PermissionConfig invalide.',detail='{"code":"invalid_payload"}';end if;
 for v_key in select pg_catalog.jsonb_object_keys(p_config) loop if v_key not in('generalRule','roleRules','priorityStrategy','conservativeDeny') then raise exception using message='Propriété inconnue.',detail=pg_catalog.jsonb_build_object('code','unknown_property','field',v_key)::text;end if;end loop;
 if coalesce(p_config->>'priorityStrategy','deny-wins')<>'deny-wins' or coalesce((p_config->>'conservativeDeny')::boolean,true)is not true then raise exception using message='deny-wins et conservativeDeny sont obligatoires.',detail='{"code":"unsafe_strategy"}';end if;
 v_general:=coalesce(p_config->'generalRule','null'::jsonb);v_role_rules:=coalesce(p_config->'roleRules','null'::jsonb);
 if v_general<>'null'::jsonb then
  if pg_catalog.jsonb_typeof(v_general)<>'object' then raise exception using message='Règle générale invalide.',detail='{"code":"invalid_general_rule"}';end if;
  for v_cap in select pg_catalog.jsonb_object_keys(v_general) loop if v_cap not in('visible','editable') or (v_general->v_cap<>'null'::jsonb and pg_catalog.jsonb_typeof(v_general->v_cap)<>'boolean') then raise exception using message='Capacité invalide.',detail='{"code":"invalid_rule"}';end if;end loop;
  v_general:=pg_catalog.jsonb_build_object('visible',coalesce(v_general->'visible','null'::jsonb),'editable',coalesce(v_general->'editable','null'::jsonb));
 end if;
 if v_role_rules<>'null'::jsonb then
  if pg_catalog.jsonb_typeof(v_role_rules)<>'object' then raise exception using message='Règles de rôles invalides.',detail='{"code":"invalid_role_rules"}';end if;
  for v_role,v_rule in select key,value from pg_catalog.jsonb_each(v_role_rules) loop
   if not(v_role=any(v_roles)) then raise exception using message='Rôle inconnu.',detail=pg_catalog.jsonb_build_object('code','unknown_role','field',v_role)::text;end if;
   if pg_catalog.jsonb_typeof(v_rule)<>'object' then raise exception using message='Règle de rôle invalide.',detail='{"code":"invalid_role_rule"}';end if;
   for v_cap in select pg_catalog.jsonb_object_keys(v_rule) loop if v_cap not in('visible','editable') or (v_rule->v_cap<>'null'::jsonb and pg_catalog.jsonb_typeof(v_rule->v_cap)<>'boolean') then raise exception using message='Capacité invalide.',detail='{"code":"invalid_rule"}';end if;end loop;
   v_role_rules:=pg_catalog.jsonb_set(v_role_rules,array[v_role],pg_catalog.jsonb_build_object('visible',coalesce(v_rule->'visible','null'::jsonb),'editable',coalesce(v_rule->'editable','null'::jsonb)),false);
  end loop;
 end if;
 return pg_catalog.jsonb_build_object('generalRule',v_general,'roleRules',v_role_rules,'priorityStrategy','deny-wins','conservativeDeny',true);
end $$;
alter function public.normalize_permission_config_v0131a6(jsonb) owner to postgres;
revoke all on function public.normalize_permission_config_v0131a6(jsonb) from public,anon,authenticated;

create or replace function public.save_relation_field_permission_draft_v0131a6(p_table_name text,p_field_name text,p_contract_version text,p_permission_config jsonb,p_expected_updated_at timestamptz) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_old public.relation_fields%rowtype;v_old_config jsonb;v_new_config jsonb;v_changed text[]:=array[]::text[];v_key text;v_actor uuid:=auth.uid();v_role text;v_updated_at timestamptz;
begin
 v_role:=public.current_app_role();if v_actor is null then raise exception using message='Authentification requise.',detail='{"code":"unauthorized"}';end if;if v_role<>'Administrateur' then raise exception using message='Permission administrateur requise.',detail='{"code":"administrator_required"}';end if;
 if p_contract_version is distinct from '1.0.0' then raise exception using message='Version non supportée.',detail='{"code":"unsupported_contract_version"}';end if;if p_expected_updated_at is null then raise exception using message='Horodatage obligatoire.',detail='{"code":"invalid_payload","field":"expectedUpdatedAt"}';end if;
 select * into v_old from public.relation_fields where table_name=p_table_name and field_name=p_field_name for update;if not found then raise exception using message='Champ inconnu.',detail='{"code":"field_not_found"}';end if;if v_old.updated_at is distinct from p_expected_updated_at then raise exception using message='Brouillon obsolète.',detail='{"code":"stale_draft"}';end if;
 if coalesce(v_old.physical_is_primary_key,false)or coalesce(v_old.physical_is_foreign_key,false)or coalesce(v_old.physical_is_generated,false)or coalesce(v_old.physical_is_identity,false)or v_old.field_type='calculated'or lower(v_old.field_name)in('id','support_id','created_at','updated_at','deleted_at','auth_user_id','photo_principale_url','photo_miniature_url','visuel_actuel_cadre')or lower(v_old.field_name)like '%\_id' escape '\' then raise exception using message='Champ protégé.',detail='{"code":"field_protected"}';end if;
 v_new_config:=public.normalize_permission_config_v0131a6(p_permission_config);v_old_config:=public.normalize_permission_config_v0131a6(case when v_old.role_permissions='{}'::jsonb then '{}'::jsonb else v_old.role_permissions end);
 if v_old_config=v_new_config and v_old.configuration_status='draft' then return pg_catalog.jsonb_build_object('ok',true,'changed',false,'code','no_change','permissionConfig',v_old_config,'contractVersion','1.0.0','updatedAt',v_old.updated_at);end if;
 foreach v_key in array array['generalRule','roleRules','priorityStrategy','conservativeDeny'] loop if v_old_config->v_key is distinct from v_new_config->v_key then v_changed:=pg_catalog.array_append(v_changed,v_key);end if;end loop;
 update public.relation_fields set role_permissions=v_new_config,configuration_status='draft',updated_at=pg_catalog.now() where id=v_old.id returning updated_at into v_updated_at;
 insert into public.relation_field_config_audit(relation_field_id,table_name,field_name,old_values,new_values,changed_by,changed_at,configuration_status,audit_schema_version,configuration_type,contract_name,contract_version,changed_properties,actor_user_id,occurred_at,transaction_id,actor_app_role,event_type)values(v_old.id,v_old.table_name,v_old.field_name,pg_catalog.jsonb_build_object('permissionConfig',v_old_config,'configuration_status',v_old.configuration_status),pg_catalog.jsonb_build_object('permissionConfig',v_new_config,'configuration_status','draft'),v_actor,pg_catalog.now(),'draft','1.0.0','permission','PermissionConfig','1.0.0',v_changed,v_actor,pg_catalog.now(),pg_catalog.txid_current()::text,v_role,'permission_draft_saved');
 return pg_catalog.jsonb_build_object('ok',true,'changed',true,'code','saved','permissionConfig',v_new_config,'contractVersion','1.0.0','updatedAt',v_updated_at,'changedProperties',pg_catalog.to_jsonb(v_changed));
end $$;
alter function public.save_relation_field_permission_draft_v0131a6(text,text,text,jsonb,timestamptz) owner to postgres;
revoke all on function public.save_relation_field_permission_draft_v0131a6(text,text,text,jsonb,timestamptz) from public,anon;
grant execute on function public.save_relation_field_permission_draft_v0131a6(text,text,text,jsonb,timestamptz) to authenticated;
comment on function public.save_relation_field_permission_draft_v0131a6(text,text,text,jsonb,timestamptz)is 'Sauvegarde un brouillon PermissionConfig 1.0.0; aucune activation ni autorité RLS.';
commit;


-- Contrôle léger après V0_13_1_A6_PERMISSION_DRAFT.sql
DO $v1check$ BEGIN
  IF pg_catalog.to_regprocedure('public.save_relation_field_permission_draft_v0131a6(text,text,text,jsonb,timestamp with time zone)') IS NULL THEN RAISE EXCEPTION 'V1 A6: RPC essentielle absente'; END IF;
END $v1check$;

-- ============================================================================
-- SOURCE 6/10 : V0_13_1_A7_TERRAIN_DRAFT.sql
-- POINT D'ARRÊT LOGIQUE : toute erreur interrompt l'exécution avant la suite.
-- ============================================================================
-- Phase 13.1-A7 — fichier local non exécuté. Aucun branchement à TerrainApp.
begin;
alter table public.relation_fields add column if not exists terrain_config jsonb not null default '{}'::jsonb;
comment on column public.relation_fields.terrain_config is 'Brouillon administratif TerrainConfig 1.0.0; aucune consommation Terrain réelle.';
do $$ begin
 if not exists(select 1 from pg_catalog.pg_constraint where conrelid='public.relation_fields'::pg_catalog.regclass and conname='relation_fields_terrain_config_object_v0131a7_check')then alter table public.relation_fields add constraint relation_fields_terrain_config_object_v0131a7_check check(pg_catalog.jsonb_typeof(terrain_config)='object')not valid;end if;
 if exists(select 1 from pg_catalog.pg_constraint where conrelid='public.relation_field_config_audit'::pg_catalog.regclass and conname='relation_field_config_audit_type_v0131a6_check')then alter table public.relation_field_config_audit drop constraint relation_field_config_audit_type_v0131a6_check;end if;
 if not exists(select 1 from pg_catalog.pg_constraint where conrelid='public.relation_field_config_audit'::pg_catalog.regclass and conname='relation_field_config_audit_type_v0131a7_check')then alter table public.relation_field_config_audit add constraint relation_field_config_audit_type_v0131a7_check check(configuration_type is null or configuration_type in('general','display','validation','permission','terrain'))not valid;end if;
end $$;
create or replace function public.normalize_terrain_config_v0131a7(p_config jsonb)returns jsonb language plpgsql immutable security invoker set search_path=pg_catalog as $$
declare v_key text;v_role text;v_roles jsonb;v_sections constant text[]:=array['Identification','Intervention','Inspection','Enjeu','Photos'];v_allowed_roles constant text[]:=array['Administrateur','Coordonnateur','Installateur'];v_critical constant jsonb:='["support_id","photo_principale_url","photo_miniature_url","visuel_actuel_cadre"]'::jsonb;v_section text;v_order integer;
begin
 if p_config is null or pg_catalog.jsonb_typeof(p_config)<>'object'then raise exception using message='TerrainConfig invalide.',detail='{"code":"invalid_payload"}';end if;
 for v_key in select pg_catalog.jsonb_object_keys(p_config)loop if v_key not in('visibleOnTerrain','readonlyOnTerrain','terrainRoles','terrainSection','terrainDisplayOrder','criticalFields')then raise exception using message='Propriété inconnue.',detail=pg_catalog.jsonb_build_object('code','unknown_property','field',v_key)::text;end if;end loop;
 foreach v_key in array array['visibleOnTerrain','readonlyOnTerrain']loop if p_config?v_key and p_config->v_key<>'null'::jsonb and pg_catalog.jsonb_typeof(p_config->v_key)<>'boolean'then raise exception using message='Booléen ou null attendu.',detail=pg_catalog.jsonb_build_object('code','invalid_boolean','field',v_key)::text;end if;end loop;
 v_roles:=coalesce(p_config->'terrainRoles','null'::jsonb);if v_roles<>'null'::jsonb then if pg_catalog.jsonb_typeof(v_roles)<>'array'then raise exception using message='Liste de rôles invalide.',detail='{"code":"invalid_roles"}';end if;if exists(select 1 from pg_catalog.jsonb_array_elements_text(v_roles)r group by r having count(*)>1)then raise exception using message='Rôle dupliqué.',detail='{"code":"duplicate_role"}';end if;for v_role in select value from pg_catalog.jsonb_array_elements_text(v_roles)loop if not(v_role=any(v_allowed_roles))then raise exception using message='Rôle Terrain inconnu.',detail=pg_catalog.jsonb_build_object('code','unknown_role','field',v_role)::text;end if;end loop;select coalesce(pg_catalog.jsonb_agg(value order by value),'[]'::jsonb)into v_roles from pg_catalog.jsonb_array_elements_text(v_roles);end if;
 v_section:=p_config->>'terrainSection';if v_section is not null and(v_section=''or pg_catalog.char_length(v_section)>100 or not(v_section=any(v_sections)))then raise exception using message='Section Terrain inconnue.',detail='{"code":"invalid_section","field":"terrainSection"}';end if;
 if p_config->'terrainDisplayOrder'<>'null'::jsonb then if pg_catalog.jsonb_typeof(p_config->'terrainDisplayOrder')<>'number'or(p_config->>'terrainDisplayOrder')!~'^[0-9]+$'then raise exception using message='Ordre Terrain invalide.',detail='{"code":"invalid_order","field":"terrainDisplayOrder"}';end if;v_order:=(p_config->>'terrainDisplayOrder')::integer;if v_order>100000 then raise exception using message='Ordre Terrain hors limites.',detail='{"code":"invalid_order","field":"terrainDisplayOrder"}';end if;end if;
 if p_config?'criticalFields'and p_config->'criticalFields'<>v_critical then raise exception using message='Champs critiques immuables.',detail='{"code":"critical_fields_immutable"}';end if;
 return pg_catalog.jsonb_build_object('visibleOnTerrain',coalesce(p_config->'visibleOnTerrain','null'::jsonb),'readonlyOnTerrain',coalesce(p_config->'readonlyOnTerrain','null'::jsonb),'terrainRoles',v_roles,'terrainSection',coalesce(p_config->'terrainSection','null'::jsonb),'terrainDisplayOrder',coalesce(p_config->'terrainDisplayOrder','null'::jsonb),'criticalFields',v_critical);
end $$;
alter function public.normalize_terrain_config_v0131a7(jsonb)owner to postgres;revoke all on function public.normalize_terrain_config_v0131a7(jsonb)from public,anon,authenticated;
create or replace function public.save_relation_field_terrain_draft_v0131a7(p_table_name text,p_field_name text,p_contract_version text,p_terrain_config jsonb,p_expected_updated_at timestamptz)returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_old public.relation_fields%rowtype;v_old_config jsonb;v_new_config jsonb;v_changed text[]:=array[]::text[];v_key text;v_actor uuid:=auth.uid();v_role text;v_updated_at timestamptz;
begin v_role:=public.current_app_role();if v_actor is null then raise exception using message='Authentification requise.',detail='{"code":"unauthorized"}';end if;if v_role<>'Administrateur'then raise exception using message='Permission administrateur requise.',detail='{"code":"administrator_required"}';end if;if p_contract_version is distinct from'1.0.0'then raise exception using message='Version non supportée.',detail='{"code":"unsupported_contract_version"}';end if;if p_expected_updated_at is null then raise exception using message='Horodatage obligatoire.',detail='{"code":"invalid_payload","field":"expectedUpdatedAt"}';end if;
 select*into v_old from public.relation_fields where table_name=p_table_name and field_name=p_field_name for update;if not found then raise exception using message='Champ inconnu.',detail='{"code":"field_not_found"}';end if;if v_old.updated_at is distinct from p_expected_updated_at then raise exception using message='Brouillon obsolète.',detail='{"code":"stale_draft"}';end if;
 v_new_config:=public.normalize_terrain_config_v0131a7(p_terrain_config);v_old_config:=public.normalize_terrain_config_v0131a7(case when v_old.terrain_config='{}'::jsonb then'{}'::jsonb else v_old.terrain_config end);
 if lower(v_old.field_name)in('support_id','photo_principale_url','photo_miniature_url','visuel_actuel_cadre')and v_new_config->'visibleOnTerrain'='false'::jsonb then raise exception using message='Champ critique non masquable.',detail='{"code":"critical_field_hidden"}';end if;
 if coalesce(v_old.physical_is_primary_key,false)or coalesce(v_old.physical_is_foreign_key,false)or coalesce(v_old.physical_is_generated,false)or coalesce(v_old.physical_is_identity,false)or v_old.field_type='calculated'or lower(v_old.field_name)in('id','created_at','updated_at','deleted_at','auth_user_id')or lower(v_old.field_name)like'%\_id'escape'\'then raise exception using message='Champ protégé.',detail='{"code":"field_protected"}';end if;
 if v_old_config=v_new_config and v_old.configuration_status='draft'then return pg_catalog.jsonb_build_object('ok',true,'changed',false,'code','no_change','terrainConfig',v_old_config,'contractVersion','1.0.0','updatedAt',v_old.updated_at);end if;
 foreach v_key in array array['visibleOnTerrain','readonlyOnTerrain','terrainRoles','terrainSection','terrainDisplayOrder','criticalFields']loop if v_old_config->v_key is distinct from v_new_config->v_key then v_changed:=pg_catalog.array_append(v_changed,v_key);end if;end loop;
 update public.relation_fields set terrain_config=v_new_config,configuration_status='draft',updated_at=pg_catalog.now()where id=v_old.id returning updated_at into v_updated_at;
 insert into public.relation_field_config_audit(relation_field_id,table_name,field_name,old_values,new_values,changed_by,changed_at,configuration_status,audit_schema_version,configuration_type,contract_name,contract_version,changed_properties,actor_user_id,occurred_at,transaction_id,actor_app_role,event_type)values(v_old.id,v_old.table_name,v_old.field_name,pg_catalog.jsonb_build_object('terrainConfig',v_old_config,'configuration_status',v_old.configuration_status),pg_catalog.jsonb_build_object('terrainConfig',v_new_config,'configuration_status','draft'),v_actor,pg_catalog.now(),'draft','1.0.0','terrain','TerrainConfig','1.0.0',v_changed,v_actor,pg_catalog.now(),pg_catalog.txid_current()::text,v_role,'terrain_draft_saved');return pg_catalog.jsonb_build_object('ok',true,'changed',true,'code','saved','terrainConfig',v_new_config,'contractVersion','1.0.0','updatedAt',v_updated_at,'changedProperties',pg_catalog.to_jsonb(v_changed));end $$;
alter function public.save_relation_field_terrain_draft_v0131a7(text,text,text,jsonb,timestamptz)owner to postgres;revoke all on function public.save_relation_field_terrain_draft_v0131a7(text,text,text,jsonb,timestamptz)from public,anon;grant execute on function public.save_relation_field_terrain_draft_v0131a7(text,text,text,jsonb,timestamptz)to authenticated;comment on function public.save_relation_field_terrain_draft_v0131a7(text,text,text,jsonb,timestamptz)is'Brouillon TerrainConfig 1.0.0 sans activation ni consommation Terrain.';
commit;


-- Contrôle léger après V0_13_1_A7_TERRAIN_DRAFT.sql
DO $v1check$ BEGIN
  IF pg_catalog.to_regprocedure('public.save_relation_field_terrain_draft_v0131a7(text,text,text,jsonb,timestamp with time zone)') IS NULL THEN RAISE EXCEPTION 'V1 A7: RPC essentielle absente'; END IF;
END $v1check$;

-- ============================================================================
-- SOURCE 7/10 : V0_13_1_A8_IMPORT_EXPORT_DRAFT.sql
-- POINT D'ARRÊT LOGIQUE : toute erreur interrompt l'exécution avant la suite.
-- ============================================================================
-- A8 local non exécuté; aucun import/export réel.
begin;alter table public.relation_fields add column if not exists import_export_config jsonb not null default'{}'::jsonb;comment on column public.relation_fields.import_export_config is'Brouillon ImportExportConfig 1.0.0 sans activation.';
do $$begin if not exists(select 1 from pg_catalog.pg_constraint where conrelid='public.relation_fields'::pg_catalog.regclass and conname='relation_fields_import_export_config_v0131a8_check')then alter table public.relation_fields add constraint relation_fields_import_export_config_v0131a8_check check(pg_catalog.jsonb_typeof(import_export_config)='object')not valid;end if;if exists(select 1 from pg_catalog.pg_constraint where conrelid='public.relation_field_config_audit'::pg_catalog.regclass and conname='relation_field_config_audit_type_v0131a7_check')then alter table public.relation_field_config_audit drop constraint relation_field_config_audit_type_v0131a7_check;end if;if not exists(select 1 from pg_catalog.pg_constraint where conrelid='public.relation_field_config_audit'::pg_catalog.regclass and conname='relation_field_config_audit_type_v0131a8_check')then alter table public.relation_field_config_audit add constraint relation_field_config_audit_type_v0131a8_check check(configuration_type is null or configuration_type in('general','display','validation','permission','terrain','import_export'))not valid;end if;end$$;
create or replace function public.normalize_import_export_config_v0131a8(p jsonb)returns jsonb language plpgsql immutable security invoker set search_path=pg_catalog as $$declare k text;v jsonb;s text;arr jsonb;begin if p is null or pg_catalog.jsonb_typeof(p)<>'object'then raise exception using detail='{"code":"invalid_payload"}';end if;for k in select pg_catalog.jsonb_object_keys(p)loop if k not in('availableInImport','availableInExport','importColumnName','exportColumnName','importAliases','exportAliases','defaultValue','exchangeContractVersion')then raise exception using detail='{"code":"unknown_property"}';end if;end loop;foreach k in array array['availableInImport','availableInExport']loop if p?k and p->k<>'null'::jsonb and pg_catalog.jsonb_typeof(p->k)<>'boolean'then raise exception using detail='{"code":"invalid_boolean"}';end if;end loop;foreach k in array array['importColumnName','exportColumnName']loop if p->k<>'null'::jsonb then s:=pg_catalog.btrim(p->>k);if s=''or pg_catalog.char_length(s)>200 or s~'^[=+@-]|[[:cntrl:]]'or s~*'javascript[[:space:]]*:|<[^>]+>'then raise exception using detail='{"code":"unsafe_text"}';end if;p:=pg_catalog.jsonb_set(p,array[k],pg_catalog.to_jsonb(s),false);end if;end loop;foreach k in array array['importAliases','exportAliases']loop arr:=coalesce(p->k,'null'::jsonb);if arr<>'null'::jsonb then if pg_catalog.jsonb_typeof(arr)<>'array'or pg_catalog.jsonb_array_length(arr)>50 then raise exception using detail='{"code":"invalid_aliases"}';end if;for v in select value from pg_catalog.jsonb_array_elements(arr)loop if pg_catalog.jsonb_typeof(v)<>'string'or pg_catalog.char_length(v#>>'{}')>200 or pg_catalog.btrim(v#>>'{}')=''or(v#>>'{}')~'^[=+@-]|[[:cntrl:]]'then raise exception using detail='{"code":"unsafe_alias"}';end if;end loop;if exists(select 1 from pg_catalog.jsonb_array_elements_text(arr)x group by pg_catalog.lower(pg_catalog.btrim(x))having count(*)>1)then raise exception using detail='{"code":"duplicate_alias"}';end if;end if;end loop;if coalesce(p->>'exchangeContractVersion','1.0.0')<>'1.0.0'then raise exception using detail='{"code":"unsupported_contract_version"}';end if;if p->'defaultValue'<>'null'::jsonb and pg_catalog.jsonb_typeof(p->'defaultValue')not in('string','number','boolean')then raise exception using detail='{"code":"invalid_default"}';end if;return pg_catalog.jsonb_build_object('availableInImport',coalesce(p->'availableInImport','null'::jsonb),'availableInExport',coalesce(p->'availableInExport','null'::jsonb),'importColumnName',coalesce(p->'importColumnName','null'::jsonb),'exportColumnName',coalesce(p->'exportColumnName','null'::jsonb),'importAliases',coalesce(p->'importAliases','null'::jsonb),'exportAliases',coalesce(p->'exportAliases','null'::jsonb),'defaultValue',coalesce(p->'defaultValue','null'::jsonb),'exchangeContractVersion','1.0.0');end$$;alter function public.normalize_import_export_config_v0131a8(jsonb)owner to postgres;revoke all on function public.normalize_import_export_config_v0131a8(jsonb)from public,anon,authenticated;
create or replace function public.save_relation_field_import_export_draft_v0131a8(p_table_name text,p_field_name text,p_contract_version text,p_import_export_config jsonb,p_expected_updated_at timestamptz)returns jsonb language plpgsql security definer set search_path=pg_catalog as $$declare o public.relation_fields%rowtype;n jsonb;old jsonb;actor uuid:=auth.uid();app_role text;ts timestamptz;begin app_role:=public.current_app_role();if actor is null then raise exception using detail='{"code":"unauthorized"}';end if;if app_role<>'Administrateur'then raise exception using detail='{"code":"administrator_required"}';end if;if p_contract_version is distinct from'1.0.0'or p_expected_updated_at is null then raise exception using detail='{"code":"invalid_payload"}';end if;select*into o from public.relation_fields where table_name=p_table_name and field_name=p_field_name for update;if not found then raise exception using detail='{"code":"field_not_found"}';end if;if o.updated_at is distinct from p_expected_updated_at then raise exception using detail='{"code":"stale_draft"}';end if;n:=public.normalize_import_export_config_v0131a8(p_import_export_config);old:=public.normalize_import_export_config_v0131a8(case when o.import_export_config='{}'::jsonb then'{}'::jsonb else o.import_export_config end);if old=n and o.configuration_status='draft'then return pg_catalog.jsonb_build_object('changed',false,'code','no_change','importExportConfig',old,'updatedAt',o.updated_at);end if;update public.relation_fields set import_export_config=n,configuration_status='draft',updated_at=pg_catalog.now()where id=o.id returning updated_at into ts;insert into public.relation_field_config_audit(relation_field_id,table_name,field_name,old_values,new_values,changed_by,changed_at,configuration_status,audit_schema_version,configuration_type,contract_name,contract_version,changed_properties,actor_user_id,occurred_at,transaction_id,actor_app_role,event_type)values(o.id,o.table_name,o.field_name,pg_catalog.jsonb_build_object('importExportConfig',old),pg_catalog.jsonb_build_object('importExportConfig',n),actor,pg_catalog.now(),'draft','1.0.0','import_export','ImportExportConfig','1.0.0',array['importExportConfig'],actor,pg_catalog.now(),pg_catalog.txid_current()::text,app_role,'import_export_draft_saved');return pg_catalog.jsonb_build_object('changed',true,'code','saved','importExportConfig',n,'updatedAt',ts);end$$;alter function public.save_relation_field_import_export_draft_v0131a8(text,text,text,jsonb,timestamptz)owner to postgres;revoke all on function public.save_relation_field_import_export_draft_v0131a8(text,text,text,jsonb,timestamptz)from public,anon;grant execute on function public.save_relation_field_import_export_draft_v0131a8(text,text,text,jsonb,timestamptz)to authenticated;commit;


-- Contrôle léger après V0_13_1_A8_IMPORT_EXPORT_DRAFT.sql
DO $v1check$ BEGIN
  IF pg_catalog.to_regprocedure('public.save_relation_field_import_export_draft_v0131a8(text,text,text,jsonb,timestamp with time zone)') IS NULL THEN RAISE EXCEPTION 'V1 A8: RPC essentielle absente'; END IF;
END $v1check$;

-- ============================================================================
-- SOURCE 8/10 : V0_13_1_1_C1_FIX_A9_AUDIT_TYPES.sql
-- POINT D'ARRÊT LOGIQUE : toute erreur interrompt l'exécution avant la suite.
-- ============================================================================
-- Bloc 13.1.1-C1 — correctif additif local, non exécuté.
-- Seule la contrainte CHECK de configuration_type de l'audit commun est remplacée.
begin;

do $$
begin
  if not exists (
    select 1
      from pg_catalog.pg_constraint
     where conrelid = 'public.relation_field_config_audit'::pg_catalog.regclass
       and conname = 'relation_field_config_audit_type_v0131a8_check'
       and contype = 'c'
  ) then
    raise exception 'Contrainte audit A8 attendue absente; correctif C1 non appliqué.';
  end if;
end;
$$;

alter table public.relation_field_config_audit
  drop constraint relation_field_config_audit_type_v0131a8_check;

alter table public.relation_field_config_audit
  add constraint relation_field_config_audit_type_v01311c1_check
  check (
    configuration_type is null
    or configuration_type in (
      'general',
      'display',
      'validation',
      'permission',
      'terrain',
      'import_export',
      'relation',
      'calculation'
    )
  ) not valid;

comment on constraint relation_field_config_audit_type_v01311c1_check
  on public.relation_field_config_audit is
  'Correctif 13.1.1-C1: conserve A3-A8 et autorise les audits RelationConfig/CalculationConfig A9.';

commit;


-- Contrôle léger après V0_13_1_1_C1_FIX_A9_AUDIT_TYPES.sql
DO $v1check$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.relation_field_config_audit'::pg_catalog.regclass AND conname='relation_field_config_audit_type_v01311c1_check') THEN RAISE EXCEPTION 'V1 C1: contrainte essentielle absente'; END IF;
END $v1check$;

-- ============================================================================
-- SOURCE 9/10 : V0_13_1_A9_RELATIONS_CALCULATIONS_DRAFT.sql
-- POINT D'ARRÊT LOGIQUE : toute erreur interrompt l'exécution avant la suite.
-- ============================================================================
-- A9 local non exécuté. relation_rules demeure inchangée et autoritaire.
-- Événements d'audit produits atomiquement : relation_draft_saved, calculation_draft_saved.
begin;alter table public.relation_fields alter column relation_config set default'{}'::jsonb,alter column calculation_config set default'{}'::jsonb;comment on column public.relation_fields.relation_config is'Brouillon RelationConfig 1.0.0';comment on column public.relation_fields.calculation_config is'Brouillon CalculationConfig 1.0.0; jamais exécuté';
create or replace function public.normalize_a9_config_v0131a9(p jsonb,p_type text)returns jsonb language plpgsql immutable security invoker set search_path=pg_catalog as $$begin if p is null or pg_catalog.jsonb_typeof(p)<>'object'then raise exception using detail='{"code":"invalid_payload"}';end if;if p_type='relation'then if coalesce(p->>'status','draft')<>'draft'or coalesce(p->>'relationRulesCompatibility','legacy-authoritative')<>'legacy-authoritative'then raise exception using detail='{"code":"legacy_authority_required"}';end if;return pg_catalog.jsonb_build_object('physicalRelation',coalesce(p->'physicalRelation','null'::jsonb),'functionalRelation',coalesce(p->'functionalRelation','null'::jsonb),'sourceTable',coalesce(p->'sourceTable','null'::jsonb),'sourceField',coalesce(p->'sourceField','null'::jsonb),'targetTable',coalesce(p->'targetTable','null'::jsonb),'targetField',coalesce(p->'targetField','null'::jsonb),'cardinality',coalesce(p->'cardinality','null'::jsonb),'status','draft','relationRulesCompatibility','legacy-authoritative');end if;if coalesce(p->>'cycleDetection','required')<>'required'then raise exception using detail='{"code":"cycle_detection_required"}';end if;return pg_catalog.jsonb_build_object('calculationType',coalesce(p->'calculationType','null'::jsonb),'dependencies',coalesce(p->'dependencies','null'::jsonb),'expression',coalesce(p->'expression','null'::jsonb),'nullHandling',coalesce(p->'nullHandling','null'::jsonb),'cycleDetection','required');end$$;alter function public.normalize_a9_config_v0131a9(jsonb,text)owner to postgres;revoke all on function public.normalize_a9_config_v0131a9(jsonb,text)from public,anon,authenticated;
create or replace function public.save_relation_field_a9_draft_v0131a9(p_table_name text,p_field_name text,p_contract_version text,p_config jsonb,p_expected_updated_at timestamptz,p_type text)returns jsonb language plpgsql security definer set search_path=pg_catalog as $$declare o public.relation_fields%rowtype;n jsonb;old jsonb;actor uuid:=auth.uid();app_role text;ts timestamptz;begin app_role:=public.current_app_role();if actor is null or app_role<>'Administrateur'then raise exception using detail='{"code":"administrator_required"}';end if;if p_contract_version is distinct from'1.0.0'or p_expected_updated_at is null or p_type not in('relation','calculation')then raise exception using detail='{"code":"invalid_payload"}';end if;select*into o from public.relation_fields where table_name=p_table_name and field_name=p_field_name for update;if not found then raise exception using detail='{"code":"field_not_found"}';end if;if o.updated_at is distinct from p_expected_updated_at then raise exception using detail='{"code":"stale_draft"}';end if;n:=public.normalize_a9_config_v0131a9(p_config,p_type);old:=public.normalize_a9_config_v0131a9(case when p_type='relation'then o.relation_config else o.calculation_config end,p_type);if old=n and o.configuration_status='draft'then return pg_catalog.jsonb_build_object('changed',false,'code','no_change','updatedAt',o.updated_at);end if;if p_type='relation'then update public.relation_fields set relation_config=n,configuration_status='draft',updated_at=pg_catalog.now()where id=o.id returning updated_at into ts;else update public.relation_fields set calculation_config=n,configuration_status='draft',updated_at=pg_catalog.now()where id=o.id returning updated_at into ts;end if;insert into public.relation_field_config_audit(relation_field_id,table_name,field_name,old_values,new_values,changed_by,changed_at,configuration_status,audit_schema_version,configuration_type,contract_name,contract_version,changed_properties,actor_user_id,occurred_at,transaction_id,actor_app_role,event_type)values(o.id,o.table_name,o.field_name,old,n,actor,pg_catalog.now(),'draft','1.0.0',p_type,case when p_type='relation'then'RelationConfig'else'CalculationConfig'end,'1.0.0',array[p_type],actor,pg_catalog.now(),pg_catalog.txid_current()::text,app_role,p_type||'_draft_saved');return pg_catalog.jsonb_build_object('changed',true,'code','saved','updatedAt',ts);end$$;
create or replace function public.save_relation_field_relation_draft_v0131a9(p_table_name text,p_field_name text,p_contract_version text,p_relation_config jsonb,p_expected_updated_at timestamptz)returns jsonb language sql security definer set search_path=pg_catalog as $$select public.save_relation_field_a9_draft_v0131a9(p_table_name,p_field_name,p_contract_version,p_relation_config,p_expected_updated_at,'relation')$$;
create or replace function public.save_relation_field_calculation_draft_v0131a9(p_table_name text,p_field_name text,p_contract_version text,p_calculation_config jsonb,p_expected_updated_at timestamptz)returns jsonb language sql security definer set search_path=pg_catalog as $$select public.save_relation_field_a9_draft_v0131a9(p_table_name,p_field_name,p_contract_version,p_calculation_config,p_expected_updated_at,'calculation')$$;
alter function public.save_relation_field_a9_draft_v0131a9(text,text,text,jsonb,timestamptz,text)owner to postgres;alter function public.save_relation_field_relation_draft_v0131a9(text,text,text,jsonb,timestamptz)owner to postgres;alter function public.save_relation_field_calculation_draft_v0131a9(text,text,text,jsonb,timestamptz)owner to postgres;revoke all on function public.save_relation_field_relation_draft_v0131a9(text,text,text,jsonb,timestamptz)from public,anon;revoke all on function public.save_relation_field_calculation_draft_v0131a9(text,text,text,jsonb,timestamptz)from public,anon;grant execute on function public.save_relation_field_relation_draft_v0131a9(text,text,text,jsonb,timestamptz)to authenticated;grant execute on function public.save_relation_field_calculation_draft_v0131a9(text,text,text,jsonb,timestamptz)to authenticated;commit;


-- Contrôle léger après V0_13_1_A9_RELATIONS_CALCULATIONS_DRAFT.sql
DO $v1check$ BEGIN
  IF pg_catalog.to_regprocedure('public.save_relation_field_relation_draft_v0131a9(text,text,text,jsonb,timestamp with time zone)') IS NULL OR pg_catalog.to_regprocedure('public.save_relation_field_calculation_draft_v0131a9(text,text,text,jsonb,timestamp with time zone)') IS NULL THEN RAISE EXCEPTION 'V1 A9: RPC essentielles absentes'; END IF;
END $v1check$;

-- ============================================================================
-- SOURCE 10/10 : V0_13_1_AUTOMATION_ASSISTANT.sql
-- POINT D'ARRÊT LOGIQUE : toute erreur interrompt l'exécution avant la suite.
-- ============================================================================
-- TOS Display Manager v0.13.1
-- Assistant d'automatisation déclaratif. Aucune règle n'est exécutée ou traduite.

begin;

create table if not exists public.automation_definitions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  status text not null default 'draft'
    check (status in ('draft','pending_validation','active','inactive')),
  priority text not null default 'normal'
    check (priority in ('critical','high','normal','low')),
  definition jsonb not null default '{}'::jsonb
    check (jsonb_typeof(definition) = 'object'),
  schema_version integer not null default 1 check (schema_version > 0),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid not null default auth.uid(),
  updated_at timestamptz not null default now(),
  approved_by uuid,
  approved_at timestamptz,
  constraint automation_active_requires_approval check (
    status <> 'active' or (approved_by is not null and approved_at is not null)
  )
);

create index if not exists automation_definitions_status_idx
  on public.automation_definitions(status, updated_at desc);
create index if not exists automation_definitions_updated_idx
  on public.automation_definitions(updated_at desc);

alter table public.automation_definitions enable row level security;

drop policy if exists automation_definitions_admin_read on public.automation_definitions;
create policy automation_definitions_admin_read
on public.automation_definitions for select to authenticated
using (public.current_app_role() = 'Administrateur');

drop policy if exists automation_definitions_admin_insert on public.automation_definitions;
create policy automation_definitions_admin_insert
on public.automation_definitions for insert to authenticated
with check (
  public.current_app_role() = 'Administrateur'
  and created_by = auth.uid()
  and updated_by = auth.uid()
  and approved_by is null
  and approved_at is null
  and status <> 'active'
);

drop policy if exists automation_definitions_admin_update on public.automation_definitions;
create policy automation_definitions_admin_update
on public.automation_definitions for update to authenticated
using (public.current_app_role() = 'Administrateur')
with check (public.current_app_role() = 'Administrateur');

drop policy if exists automation_definitions_admin_delete on public.automation_definitions;
create policy automation_definitions_admin_delete
on public.automation_definitions for delete to authenticated
using (public.current_app_role() = 'Administrateur');

revoke all on public.automation_definitions from anon, authenticated;
grant select, insert, delete on public.automation_definitions to authenticated;
grant update(name,status,priority,definition,schema_version,updated_at)
  on public.automation_definitions to authenticated;

create or replace function public.prepare_automation_definition_v0131()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.name := btrim(new.name);
  new.updated_by := auth.uid();
  new.updated_at := now();

  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.approved_by := null;
    new.approved_at := null;
    if new.status = 'active' then new.status := 'pending_validation'; end if;
  elsif old.name is distinct from new.name
     or old.priority is distinct from new.priority
     or old.definition is distinct from new.definition
     or old.schema_version is distinct from new.schema_version then
    new.approved_by := null;
    new.approved_at := null;
    if old.status = 'active' or new.status = 'active' then
      new.status := 'pending_validation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prepare_automation_definition_v0131
  on public.automation_definitions;
create trigger prepare_automation_definition_v0131
before insert or update on public.automation_definitions
for each row execute function public.prepare_automation_definition_v0131();

create or replace function public.approve_automation_definition_v0131(
  p_automation_id uuid
)
returns public.automation_definitions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_definition public.automation_definitions%rowtype;
begin
  if public.current_app_role() <> 'Administrateur' then
    raise exception 'Permission administrateur requise.';
  end if;

  select * into v_definition
    from public.automation_definitions
   where id = p_automation_id
   for update;
  if not found then raise exception 'Automatisation introuvable.'; end if;

  if jsonb_typeof(v_definition.definition->'triggers') <> 'array'
     or jsonb_array_length(v_definition.definition->'triggers') = 0 then
    raise exception 'Au moins un déclencheur est requis.';
  end if;
  if jsonb_typeof(v_definition.definition->'targets') <> 'array'
     or jsonb_array_length(v_definition.definition->'targets') = 0 then
    raise exception 'Au moins un module cible est requis.';
  end if;

  update public.automation_definitions
     set status = 'active',
         approved_by = auth.uid(),
         approved_at = now(),
         updated_by = auth.uid(),
         updated_at = now()
   where id = p_automation_id
   returning * into v_definition;

  return v_definition;
end;
$$;

grant execute on function public.approve_automation_definition_v0131(uuid)
  to authenticated;

comment on table public.automation_definitions is
  'Configurations déclaratives du Mode simple. Aucun déclencheur SQL ne lit cette table.';

commit;


-- Contrôle léger après V0_13_1_AUTOMATION_ASSISTANT.sql
DO $v1check$ BEGIN
  IF pg_catalog.to_regclass('public.automation_definitions') IS NULL OR pg_catalog.to_regprocedure('public.approve_automation_definition_v0131(uuid)') IS NULL THEN RAISE EXCEPTION 'V1 Automatisations: objets essentiels absents'; END IF;
END $v1check$;

SELECT 'V1_MIGRATIONS_COMPLETE' AS verdict;
