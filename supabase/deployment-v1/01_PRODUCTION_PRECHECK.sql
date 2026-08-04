-- V1.0 - PRECONTROLE PRODUCTION. STRICTEMENT EN LECTURE SEULE.
BEGIN READ ONLY;

select pg_catalog.version() as postgres_version;

-- Socle historique obligatoire : toute ligne false impose NO-GO.
with required_objects(kind,name,present) as (
 values
 ('table','infrastructures',pg_catalog.to_regclass('public.infrastructures') is not null),
 ('table','utilisateurs',pg_catalog.to_regclass('public.utilisateurs') is not null),
 ('table','relation_fields',pg_catalog.to_regclass('public.relation_fields') is not null),
 ('table','relation_rules',pg_catalog.to_regclass('public.relation_rules') is not null),
 ('table','campagnes_maitres',pg_catalog.to_regclass('public.campagnes_maitres') is not null),
 ('table','campagne_visuels_formats',pg_catalog.to_regclass('public.campagne_visuels_formats') is not null),
 ('table','suivi_des_edt',pg_catalog.to_regclass('public.suivi_des_edt') is not null),
 ('table','bons_de_travail',pg_catalog.to_regclass('public.bons_de_travail') is not null),
 ('table','support_photos',pg_catalog.to_regclass('public.support_photos') is not null),
 ('table','historique_des_campagnes',pg_catalog.to_regclass('public.historique_des_campagnes') is not null),
 ('function','current_app_role',pg_catalog.to_regprocedure('public.current_app_role()') is not null),
 ('function','diagnostic_systeme_v07',pg_catalog.to_regprocedure('public.diagnostic_systeme_v07()') is not null),
 ('function','mark_current_user_active',pg_catalog.to_regprocedure('public.mark_current_user_active()') is not null),
 ('function','photo_delete',pg_catalog.to_regprocedure('public.supprimer_photo_support_v0129_lot3(text)') is not null)
)
select * from required_objects order by kind,name;

-- Structure, conflits de colonnes et objets V0.13.1 éventuellement déjà présents.
select table_name,column_name,data_type,udt_name,is_nullable,column_default,ordinal_position
from information_schema.columns where table_schema='public'
 and table_name in ('infrastructures','relation_fields','relation_field_config_audit','support_photos')
order by table_name,ordinal_position;
select c.conrelid::pg_catalog.regclass::text table_name,c.conname,c.contype,c.convalidated,
 pg_catalog.pg_get_constraintdef(c.oid,true) definition
from pg_catalog.pg_constraint c where c.conrelid in
 (pg_catalog.to_regclass('public.relation_fields'),pg_catalog.to_regclass('public.relation_field_config_audit'))
order by table_name,c.conname;
select p.oid::pg_catalog.regprocedure signature,p.prosecdef,p.proconfig,
 pg_catalog.pg_get_userbyid(p.proowner) owner
from pg_catalog.pg_proc p where p.pronamespace='public'::pg_catalog.regnamespace
 and (p.proname like '%v0131%' or p.proname in ('current_app_role','mark_current_user_active'))
order by 1;

-- Propriétaires, droits, RLS et triggers avant migration.
select c.relname,pg_catalog.pg_get_userbyid(c.relowner) owner,c.relrowsecurity,c.relforcerowsecurity
from pg_catalog.pg_class c where c.relnamespace='public'::pg_catalog.regnamespace
 and c.relname in ('infrastructures','relation_fields','relation_field_config_audit','relation_rules','support_photos','automation_definitions')
order by c.relname;
select table_name,grantee,privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name in ('relation_fields','relation_field_config_audit','relation_rules','support_photos','automation_definitions')
order by table_name,grantee,privilege_type;
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_catalog.pg_policies
where schemaname='public' and tablename in ('relation_fields','relation_field_config_audit','relation_rules','support_photos','automation_definitions')
order by tablename,policyname;
select event_object_table,trigger_name,event_manipulation,action_timing,action_statement
from information_schema.triggers where trigger_schema='public'
 and event_object_table in ('infrastructures','relation_fields','relation_field_config_audit','relation_rules','support_photos','automation_definitions')
order by event_object_table,trigger_name;

-- Intégrité et compteurs du socle.
select count(*) infrastructures_rows,count(*) filter(where support_id is null or pg_catalog.btrim(support_id::text)='') invalid_support_id,
 count(distinct support_id) distinct_support_id from public.infrastructures;
select count(*) photo_rows,count(*) filter(where support_id is null) null_support_id,
 count(*) filter(where not exists(select 1 from public.infrastructures i where i.support_id=p.support_id)) orphan_support_refs
from public.support_photos p;
select 'relation_fields' object_name,count(*) exact_rows from public.relation_fields
union all select 'relation_rules',count(*) from public.relation_rules
union all select 'historique_des_campagnes',count(*) from public.historique_des_campagnes;

-- Verdict automatique pour les causes déterminables avant A1/A3.
with causes as (
 select 'objet obligatoire absent: '||x.name cause from (values
  ('infrastructures',pg_catalog.to_regclass('public.infrastructures') is not null),
  ('utilisateurs',pg_catalog.to_regclass('public.utilisateurs') is not null),
  ('relation_fields',pg_catalog.to_regclass('public.relation_fields') is not null),
  ('relation_rules',pg_catalog.to_regclass('public.relation_rules') is not null),
  ('support_photos',pg_catalog.to_regclass('public.support_photos') is not null),
  ('current_app_role()',pg_catalog.to_regprocedure('public.current_app_role()') is not null)
 ) x(name,present) where not x.present
 union all select 'support_id NULL ou vide' where exists(select 1 from public.infrastructures where support_id is null or pg_catalog.btrim(support_id::text)='')
 union all select 'référence photo orpheline' where exists(select 1 from public.support_photos p where not exists(select 1 from public.infrastructures i where i.support_id=p.support_id))
)
select case when exists(select 1 from causes) then 'NO-GO' else 'GO' end verdict,
 coalesce(pg_catalog.string_agg(cause,'; '),'aucune cause bloquante détectée') causes from causes;

ROLLBACK;
