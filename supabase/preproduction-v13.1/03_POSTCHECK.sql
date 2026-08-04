-- BLOC 13.1 - POSTCONTROLE GLOBAL. Lecture seule; comparer chaque resultat au precontrole.
BEGIN READ ONLY;

select column_name,data_type,is_nullable,column_default
from information_schema.columns where table_schema='public' and table_name='relation_fields'
 and column_name in ('validation_rules','role_permissions','terrain_config','import_export_config',
 'relation_config','calculation_config','configuration_status','updated_at') order by column_name;
select column_name,count(*) as occurrences from information_schema.columns
where table_schema='public' and table_name='relation_fields'
 and column_name in ('terrain_config','import_export_config','relation_config','calculation_config')
group by column_name order by column_name;

select configuration_type,count(*) from public.relation_field_config_audit group by configuration_type order by configuration_type;
select expected.configuration_type,(seen.configuration_type is not null) as represented_in_history
from (values ('general'),('display'),('validation'),('permission'),('terrain'),('import_export'),('relation'),('calculation')) expected(configuration_type)
left join (select distinct configuration_type from public.relation_field_config_audit) seen using(configuration_type)
order by expected.configuration_type;
select conname,convalidated,pg_catalog.pg_get_constraintdef(oid,true) definition
from pg_catalog.pg_constraint where conrelid='public.relation_field_config_audit'::pg_catalog.regclass
 and conname='relation_field_config_audit_type_v01311c1_check';

select p.oid::pg_catalog.regprocedure signature,p.prosecdef,p.proconfig,
 pg_catalog.pg_get_userbyid(p.proowner) owner
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname like '%v0131a%' order by signature::text;
select routine_name,grantee,privilege_type from information_schema.routine_privileges
where routine_schema='public' and routine_name like '%v0131a%' order by routine_name,grantee;
select routine_name,grantee from information_schema.routine_privileges
where routine_schema='public' and routine_name like '%v0131a%' and grantee in ('PUBLIC','anon') order by routine_name,grantee;

select c.relname,pg_catalog.pg_get_userbyid(c.relowner) owner,c.relrowsecurity,c.relforcerowsecurity
from pg_catalog.pg_class c where c.relnamespace='public'::pg_catalog.regnamespace
 and c.relname in ('relation_fields','relation_field_config_audit','relation_rules') order by c.relname;
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_catalog.pg_policies
where schemaname='public' and tablename in ('relation_fields','relation_field_config_audit','relation_rules') order by tablename,policyname;
select event_object_table,trigger_name,event_manipulation,action_timing,action_statement
from information_schema.triggers where trigger_schema='public'
 and event_object_table in ('relation_fields','relation_field_config_audit','relation_rules') order by event_object_table,trigger_name;

-- Integrite declarative et historique.
select count(*) filter(where support_id is null) null_support_id,
 count(*) filter(where photo_principale_url is not null) main_photo_refs,
 count(*) filter(where photo_miniature_url is not null) thumbnail_refs
from public.infrastructures;
select count(*) relation_fields_rows,
 count(*) filter(where updated_at is null) null_updated_at,
 count(*) filter(where pg_catalog.jsonb_typeof(validation_rules)<>'object'
  or pg_catalog.jsonb_typeof(role_permissions)<>'object'
  or pg_catalog.jsonb_typeof(terrain_config)<>'object'
  or pg_catalog.jsonb_typeof(import_export_config)<>'object'
  or pg_catalog.jsonb_typeof(relation_config)<>'object'
  or pg_catalog.jsonb_typeof(calculation_config)<>'object') invalid_json
from public.relation_fields;
select count(*) audit_rows,count(*) filter(where relation_field_id is null) orphan_audit_refs
from public.relation_field_config_audit;
select 'relation_rules' object_name,count(*) exact_rows from public.relation_rules
union all select 'support_photos',count(*) from public.support_photos
union all select 'relation_field_config_audit',count(*) from public.relation_field_config_audit;

-- Aucun objet d'activation/consommateur attendu dans la base.
select n.nspname,c.relname,c.relkind from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and (c.relname ilike '%activation%' or c.relname ilike '%activate%') order by c.relname;
select p.oid::pg_catalog.regprocedure from pg_catalog.pg_proc p where p.pronamespace='public'::pg_catalog.regnamespace
 and (p.proname ilike '%activation%' or p.proname ilike '%activate%') order by 1::text;

ROLLBACK;
