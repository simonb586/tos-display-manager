begin read only;

select c.relname = 'relation_field_config_audit' as audit_table_present
from pg_catalog.pg_class c
where c.oid = 'public.relation_field_config_audit'::pg_catalog.regclass;

select a.attname = 'configuration_type' and not a.attisdropped as configuration_type_present
from pg_catalog.pg_attribute a
where a.attrelid = 'public.relation_field_config_audit'::pg_catalog.regclass
  and a.attname = 'configuration_type';

with target as (
  select pg_catalog.pg_get_constraintdef(c.oid) definition
  from pg_catalog.pg_constraint c
  where c.conrelid = 'public.relation_field_config_audit'::pg_catalog.regclass
    and c.conname = 'relation_field_config_audit_type_v01311c1_check'
    and c.contype = 'c'
)
select
  definition,
  definition like '%general%' as allows_general,
  definition like '%display%' as allows_display,
  definition like '%validation%' as allows_validation,
  definition like '%permission%' as allows_permission,
  definition like '%terrain%' as allows_terrain,
  definition like '%import_export%' as allows_import_export,
  definition like '%relation%' as allows_relation,
  definition like '%calculation%' as allows_calculation,
  definition not like '%unknown_test_value%' as rejects_unknown_test_value_by_closed_list
from target;

select count(*) = 0 as no_c1_table
from pg_catalog.pg_class
where relnamespace = 'public'::pg_catalog.regnamespace
  and relname like '%v01311c1%';

select count(*) = 0 as no_c1_column
from pg_catalog.pg_attribute
where attrelid = 'public.relation_field_config_audit'::pg_catalog.regclass
  and attname like '%v01311c1%'
  and not attisdropped;

select c.relrowsecurity, c.relforcerowsecurity
from pg_catalog.pg_class c
where c.oid = 'public.relation_field_config_audit'::pg_catalog.regclass;

select count(*) = 0 as no_c1_trigger
from pg_catalog.pg_trigger
where tgrelid = 'public.relation_field_config_audit'::pg_catalog.regclass
  and tgname like '%v01311c1%'
  and not tgisinternal;

select grantee, privilege_type
from information_schema.table_privileges
where table_schema = 'public'
  and table_name = 'relation_field_config_audit'
order by grantee, privilege_type;

rollback;
