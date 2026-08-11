-- STRICTEMENT READ ONLY
begin read only;
select table_name from information_schema.tables where table_schema='public' and table_name='edt_reports';
select column_name,data_type,is_nullable from information_schema.columns where table_schema='public' and table_name='edt_reports' order by ordinal_position;
select conname,pg_get_constraintdef(oid) from pg_constraint where conrelid='public.edt_reports'::regclass order by conname;
select indexname,indexdef from pg_indexes where schemaname='public' and tablename='edt_reports' order by indexname;
select policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' and tablename='edt_reports' order by policyname;
select c.relname,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='edt_reports';
select grantee,privilege_type from information_schema.role_table_grants where table_schema='public' and table_name='edt_reports' and grantee in ('PUBLIC','anon','authenticated') order by grantee,privilege_type;
select has_table_privilege('anon','public.edt_reports','select') anon_select,has_table_privilege('anon','public.edt_reports','insert') anon_insert,has_table_privilege('authenticated','public.edt_reports','select') authenticated_select;
select table_name from information_schema.tables where table_schema='public' and table_name in ('reports','edt_phase_reports','communications_finales') order by table_name;
select e.id,e.no_edt,e.statut,count(r.id) report_count,max(r.report_version) latest_version from public.suivi_des_edt e left join public.edt_reports r on r.edt_id=e.id where e.statut='Complété' group by e.id,e.no_edt,e.statut order by e.id;
select r.id,r.edt_id,e.no_edt,r.report_version,r.status,r.report_path,r.generated_at,r.client_visible from public.edt_reports r join public.suivi_des_edt e on e.id=r.edt_id order by r.edt_id,r.report_version desc;
rollback;
