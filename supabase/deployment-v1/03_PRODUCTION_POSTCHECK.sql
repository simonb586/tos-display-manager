-- V1.0 - POSTCONTROLE PRODUCTION. STRICTEMENT EN LECTURE SEULE.
BEGIN READ ONLY;

-- Colonnes et contraintes attendues.
select column_name,data_type,is_nullable,column_default from information_schema.columns
where table_schema='public' and table_name='relation_fields' and column_name in
 ('field_type','validation_rules','role_permissions','terrain_config','import_export_config','relation_config','calculation_config','configuration_status','updated_at')
order by column_name;
select conname,convalidated,pg_catalog.pg_get_constraintdef(oid,true) definition
from pg_catalog.pg_constraint where conrelid in
 ('public.relation_fields'::pg_catalog.regclass,'public.relation_field_config_audit'::pg_catalog.regclass)
order by conrelid::pg_catalog.regclass::text,conname;
select configuration_type,count(*) from public.relation_field_config_audit group by configuration_type order by configuration_type;
select count(*) incompatible_audit_rows from public.relation_field_config_audit
where configuration_type is not null and configuration_type not in
 ('general','display','validation','permission','terrain','import_export','relation','calculation');

-- Signatures, propriétaire, mode de sécurité et search_path.
select p.oid::pg_catalog.regprocedure signature,pg_catalog.pg_get_userbyid(p.proowner) owner,
 p.prosecdef,p.proconfig
from pg_catalog.pg_proc p where p.pronamespace='public'::pg_catalog.regnamespace
 and (p.proname like '%v0131%' or p.proname in ('current_app_role','mark_current_user_active'))
order by 1;
select routine_name,grantee,privilege_type from information_schema.routine_privileges
where routine_schema='public' and routine_name like '%v0131%' order by routine_name,grantee,privilege_type;
select routine_name,grantee from information_schema.routine_privileges
where routine_schema='public' and routine_name like '%v0131%' and grantee in ('PUBLIC','anon')
order by routine_name,grantee;

-- RLS et triggers : comparer strictement au précontrôle, sauf automation_definitions attendu.
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_catalog.pg_policies
where schemaname='public' and tablename in
 ('relation_fields','relation_field_config_audit','relation_rules','support_photos','automation_definitions')
order by tablename,policyname;
select event_object_table,trigger_name,event_manipulation,action_timing,action_statement
from information_schema.triggers where trigger_schema='public' and event_object_table in
 ('infrastructures','relation_fields','relation_field_config_audit','relation_rules','support_photos','automation_definitions')
order by event_object_table,trigger_name;

-- Intégrité et absence de perte.
select count(*) infrastructures_rows,count(*) filter(where support_id is null or pg_catalog.btrim(support_id::text)='') invalid_support_id,
 count(distinct support_id) distinct_support_id from public.infrastructures;
select count(*) photo_rows,count(*) filter(where not exists(select 1 from public.infrastructures i where i.support_id=p.support_id)) orphan_support_refs
from public.support_photos p;
select 'relation_fields' object_name,count(*) exact_rows from public.relation_fields
union all select 'relation_rules',count(*) from public.relation_rules
union all select 'historique_des_campagnes',count(*) from public.historique_des_campagnes
union all select 'relation_field_config_audit',count(*) from public.relation_field_config_audit;

-- Aucun objet SQL A10/activation attendu.
select c.relname conflict_object from pg_catalog.pg_class c where c.relnamespace='public'::pg_catalog.regnamespace
 and (c.relname ilike '%field%activation%' or c.relname ilike '%configuration%activation%');
select p.proname conflict_function from pg_catalog.pg_proc p where p.pronamespace='public'::pg_catalog.regnamespace
 and (p.proname ilike '%field%activation%' or p.proname ilike '%configuration%activation%');

-- Verdict final. Le bouton/projection A10 théoriques sont contrôlés par les tests locaux A10/13.1.1.
with required_functions(signature) as (values
 ('public.list_public_schema_fields_v0131a()'),
 ('public.save_relation_field_general_draft_v0131a3(text,text,text,text,text,integer)'),
 ('public.save_relation_field_display_draft_v0131a42(text,text,text,boolean,boolean,boolean,integer,boolean)'),
 ('public.save_relation_field_validation_draft_v0131a53(text,text,text,jsonb,timestamp with time zone)'),
 ('public.save_relation_field_permission_draft_v0131a6(text,text,text,jsonb,timestamp with time zone)'),
 ('public.save_relation_field_terrain_draft_v0131a7(text,text,text,jsonb,timestamp with time zone)'),
 ('public.save_relation_field_import_export_draft_v0131a8(text,text,text,jsonb,timestamp with time zone)'),
 ('public.save_relation_field_relation_draft_v0131a9(text,text,text,jsonb,timestamp with time zone)'),
 ('public.save_relation_field_calculation_draft_v0131a9(text,text,text,jsonb,timestamp with time zone)')
), causes as (
 select 'fonction absente: '||signature cause from required_functions where pg_catalog.to_regprocedure(signature) is null
 union all select 'contrainte C1 absente' where not exists(select 1 from pg_catalog.pg_constraint where conrelid='public.relation_field_config_audit'::pg_catalog.regclass and conname='relation_field_config_audit_type_v01311c1_check')
 union all select 'type audit incompatible' where exists(select 1 from public.relation_field_config_audit where configuration_type is not null and configuration_type not in ('general','display','validation','permission','terrain','import_export','relation','calculation'))
 union all select 'support_id invalide' where exists(select 1 from public.infrastructures where support_id is null or pg_catalog.btrim(support_id::text)='')
 union all select 'photo orpheline' where exists(select 1 from public.support_photos p where not exists(select 1 from public.infrastructures i where i.support_id=p.support_id))
)
select case when exists(select 1 from causes) then 'NO-GO' else 'GO POUR DÉPLOIEMENT FRONTAL' end verdict,
 coalesce(pg_catalog.string_agg(cause,'; '),'contrôles automatiques conformes; comparer les compteurs et inventaires') causes from causes;

ROLLBACK;
