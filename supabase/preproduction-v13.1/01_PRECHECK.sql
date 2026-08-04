-- BLOC 13.1 - PRECONTROLE GLOBAL. Lecture seule; aucune fonction applicative n'est appelee.
BEGIN READ ONLY;

select pg_catalog.version() as postgres_version;
select n.nspname, pg_catalog.pg_get_userbyid(n.nspowner) as owner
from pg_catalog.pg_namespace n where n.nspname = 'public';

-- Objets et structure avant migration.
select c.relname, c.relkind, pg_catalog.pg_get_userbyid(c.relowner) as owner,
       c.relrowsecurity, c.relforcerowsecurity
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
 ('relation_fields','relation_field_config_audit','relation_rules','validation_rules','role_permissions')
order by c.relname;

select table_name,column_name,data_type,udt_name,is_nullable,column_default,ordinal_position
from information_schema.columns
where table_schema='public' and table_name in ('relation_fields','relation_field_config_audit')
order by table_name,ordinal_position;

-- Presence/absence explicite des colonnes declaratives A1-A9.
select expected.column_name, (actual.column_name is not null) as present, actual.data_type, actual.is_nullable
from (values ('validation_rules'),('role_permissions'),('terrain_config'),('import_export_config'),
             ('relation_config'),('calculation_config'),('configuration_status'),('updated_at')) expected(column_name)
left join information_schema.columns actual on actual.table_schema='public'
 and actual.table_name='relation_fields' and actual.column_name=expected.column_name
order by expected.column_name;

select c.conname,c.contype,c.convalidated,pg_catalog.pg_get_constraintdef(c.oid,true) as definition
from pg_catalog.pg_constraint c
where c.conrelid in (pg_catalog.to_regclass('public.relation_fields'),
                     pg_catalog.to_regclass('public.relation_field_config_audit'))
order by c.conrelid::pg_catalog.regclass::text,c.conname;

-- Inventaire des valeurs et anomalies. Ces tables sont des prerequis du paquet;
-- une relation absente fait echouer le precontrole et impose NO-GO.
select configuration_type,count(*) from public.relation_field_config_audit group by configuration_type order by configuration_type;
select event_type,count(*) from public.relation_field_config_audit group by event_type order by event_type;
select id,configuration_type from public.relation_field_config_audit
where configuration_type is not null and configuration_type not in
 ('general','display','validation','permission','terrain','import_export','relation','calculation')
order by id;
select configuration_status,count(*) from public.relation_fields group by configuration_status order by configuration_status;
select updated_at is null as updated_at_is_null,count(*) from public.relation_fields group by updated_at is null;
select count(*) filter(where validation_rules is null) validation_rules_null,
 count(*) filter(where role_permissions is null) role_permissions_null,
 count(*) filter(where relation_config is null) relation_config_null,
 count(*) filter(where calculation_config is null) calculation_config_null,
 count(*) filter(where pg_catalog.jsonb_typeof(validation_rules)<>'object') validation_rules_non_object,
 count(*) filter(where pg_catalog.jsonb_typeof(role_permissions)<>'object') role_permissions_non_object,
 count(*) filter(where pg_catalog.jsonb_typeof(relation_config)<>'object') relation_config_non_object,
 count(*) filter(where pg_catalog.jsonb_typeof(calculation_config)<>'object') calculation_config_non_object
from public.relation_fields;
select validation_rules,count(*) from public.relation_fields group by validation_rules order by count(*) desc,validation_rules::text;

-- Fonctions/RPC, proprietaires, mode de securite et search_path.
select p.oid::pg_catalog.regprocedure as signature,p.prokind,p.prosecdef,p.proconfig,
 pg_catalog.pg_get_userbyid(p.proowner) as owner
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and (p.proname like '%v0131a%' or p.proname like '%v01311c1%')
order by signature::text;
select routine_name,grantee,privilege_type
from information_schema.routine_privileges
where routine_schema='public' and (routine_name like '%v0131a%' or routine_name like '%v01311c1%')
order by routine_name,grantee,privilege_type;

-- Grants/revocations observables, politiques RLS et triggers.
select table_name,grantee,privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name in ('relation_fields','relation_field_config_audit','relation_rules')
order by table_name,grantee,privilege_type;
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_catalog.pg_policies where schemaname='public'
 and tablename in ('relation_fields','relation_field_config_audit','relation_rules') order by tablename,policyname;
select event_object_table,trigger_name,event_manipulation,action_timing,action_statement
from information_schema.triggers where trigger_schema='public'
 and event_object_table in ('relation_fields','relation_field_config_audit','relation_rules')
order by event_object_table,trigger_name,event_manipulation;

-- Statistiques et tables metier a proteger (empreinte logique avant travaux).
select c.relname,coalesce(s.n_live_tup,0) estimated_rows
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
left join pg_catalog.pg_stat_user_tables s on s.relid=c.oid
where n.nspname='public' and c.relkind in ('r','p') order by c.relname;
select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'
 and table_name not in ('relation_fields','relation_field_config_audit') order by table_name;
select 'relation_fields' table_name,count(*) exact_rows from public.relation_fields
union all select 'relation_field_config_audit',count(*) from public.relation_field_config_audit
union all select 'relation_rules',count(*) from public.relation_rules;

ROLLBACK;
