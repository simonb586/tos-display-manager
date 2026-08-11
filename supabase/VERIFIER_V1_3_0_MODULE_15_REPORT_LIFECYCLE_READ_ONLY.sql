begin read only;

select to_regclass('public.reports') as reports_table;
select to_regclass('public.communications_finales') communications_finales_intacte,to_regclass('public.edt_phase_reports') edt_phase_reports_intacte,to_regclass('public.activity_events') activity_events_intacte;
select column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name='reports' order by ordinal_position;
select conname,pg_get_constraintdef(oid) definition from pg_constraint where conrelid='public.reports'::regclass order by conname;
select indexname,indexdef from pg_indexes where schemaname='public' and tablename='reports' order by indexname;
select c.relrowsecurity,c.relforcerowsecurity from pg_class c where c.oid='public.reports'::regclass;
select policyname,cmd,roles,qual,with_check from pg_policies where schemaname='public' and tablename='reports' order by policyname;
select grantee,privilege_type from information_schema.role_table_grants where table_schema='public' and table_name='reports' order by grantee,privilege_type;
select exists(select 1 from information_schema.role_table_grants where table_schema='public' and table_name='reports' and grantee='PUBLIC') public_has_privilege,has_table_privilege('anon','public.reports','select') anon_select,has_table_privilege('authenticated','public.reports','select') authenticated_select;
select p.proname,p.prosecdef,p.proconfig,exists(select 1 from information_schema.routine_privileges rp where rp.specific_schema='public' and rp.routine_name=p.proname and rp.grantee='PUBLIC') public_execute,has_function_privilege('anon',p.oid,'execute') anon_execute,has_function_privilege('authenticated',p.oid,'execute') authenticated_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('module15_generate_report_v130','module15_transition_report_v130','module15_client_reports_v130','module15_report_activity_v130') order by p.proname;
select p.proname,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('module15_generate_report_v130','module15_transition_report_v130','module15_client_reports_v130') order by p.proname;
select status,count(*) from public.reports group by status order by status;
select count(*) invalid_status from public.reports where status not in ('draft','generated','published','archived','error');
select count(*) invalid_publication from public.reports where (status='published') is distinct from (client_published and published_at is not null);
select count(*) invalid_archive from public.reports where status='archived' and archived_at is null;
select count(*) archived_internal_history from public.reports where status='archived';
select count(*) client_invisible_drafts from public.reports where status in ('draft','generated','archived','error') and client_published;
select count(*) invalid_campaign_scope from public.reports where report_type='campaign' and (campaign_id is null or communication_id is not null);
select count(*) invalid_communication_scope from public.reports where report_type='operational_communication' and (communication_id is null or campaign_id is not null);
select client_id,count(distinct client_id) organizations,count(*) published_reports from public.reports where status='published' and client_published group by client_id order by client_id;
select count(*) cross_client_campaign_links from public.reports r join public.campagnes_maitres c on c.id=coalesce(r.campaign_id,r.communication_id) where r.client_id is distinct from c.client_id;
select event_object_table,trigger_name,action_timing,event_manipulation from information_schema.triggers where event_object_schema='public' and event_object_table='reports';

rollback;
