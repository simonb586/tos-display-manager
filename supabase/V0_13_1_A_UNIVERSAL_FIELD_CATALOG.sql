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
