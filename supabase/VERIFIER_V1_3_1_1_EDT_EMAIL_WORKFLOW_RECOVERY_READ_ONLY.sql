-- STRICTEMENT READ ONLY : validation de convergence V1.3.1.1.
begin read only;

with critical(object_type,object_name,present,conforming) as (
 select 'table','email_outbox',to_regclass('public.email_outbox') is not null,
  exists(select 1 from pg_class c where c.oid=to_regclass('public.email_outbox') and c.relrowsecurity)
 union all select 'table','email_delivery_log',to_regclass('public.email_delivery_log') is not null,
  exists(select 1 from pg_class c where c.oid=to_regclass('public.email_delivery_log') and c.relrowsecurity)
 union all select 'column','suivi_des_edt.requester_contact_id',exists(select 1 from information_schema.columns where table_schema='public' and table_name='suivi_des_edt' and column_name='requester_contact_id'),
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='suivi_des_edt' and column_name='requester_contact_id' and data_type='bigint')
 union all select 'policy','email_outbox_staff_read_v131',exists(select 1 from pg_policies where schemaname='public' and tablename='email_outbox' and policyname='email_outbox_staff_read_v131'),
  exists(select 1 from pg_policies where schemaname='public' and tablename='email_outbox' and policyname='email_outbox_staff_read_v131' and cmd='SELECT' and roles='{authenticated}' and qual like '%Administrateur%' and qual like '%Coordonnateur%' and qual!~*'(^|[^[:alnum:]_])true([^[:alnum:]_]|$)')
 union all select 'policy','email_delivery_staff_read_v131',exists(select 1 from pg_policies where schemaname='public' and tablename='email_delivery_log' and policyname='email_delivery_staff_read_v131'),
  exists(select 1 from pg_policies where schemaname='public' and tablename='email_delivery_log' and policyname='email_delivery_staff_read_v131' and cmd='SELECT' and roles='{authenticated}' and qual like '%Administrateur%' and qual like '%Coordonnateur%' and qual!~*'(^|[^[:alnum:]_])true([^[:alnum:]_]|$)')
 union all select 'index',v.name,to_regclass('public.'||v.name) is not null,to_regclass('public.'||v.name) is not null from (values('email_outbox_automatic_completion_uq'),('email_outbox_worker_idx'),('email_delivery_log_success_uq'),('email_delivery_log_edt_idx'))v(name)
 union all select 'function',v.signature,to_regprocedure(v.signature) is not null,
  exists(select 1 from pg_proc p where p.oid=to_regprocedure(v.signature) and p.prosecdef and p.proconfig@>array['search_path=public, pg_temp'])
 from (values('public.validate_edt_requester_v131()'),('public.enqueue_edt_completion_email_v131()'),('public.request_edt_email_retry_v131(bigint,boolean)'),('public.edt_email_status_v131(bigint)'),('public.claim_edt_completion_email_v131(bigint,integer)'),('public.edt_email_activity_v131()'))v(signature)
 union all select 'trigger',v.name,exists(select 1 from pg_trigger where tgname=v.name and not tgisinternal),
  exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid where t.tgname=v.name and not t.tgisinternal and p.proname=v.function_name)
 from (values('validate_edt_requester_v131','validate_edt_requester_v131'),('enqueue_edt_completion_email_v131','enqueue_edt_completion_email_v131'),('edt_email_activity_v131','edt_email_activity_v131'))v(name,function_name)
)
select object_type,object_name,case when not present then 'MISSING' when conforming then 'PRESENT_AND_CONFORMING' else 'PRESENT_BUT_MISMATCHED' end recovery_status
from critical order by object_type,object_name;

select c.table_name,c.column_name,c.data_type,c.is_nullable,c.column_default
from information_schema.columns c where c.table_schema='public' and ((c.table_name='suivi_des_edt' and c.column_name='requester_contact_id') or c.table_name in ('email_outbox','email_delivery_log'))
order by c.table_name,c.ordinal_position;

select tc.table_name,tc.constraint_name,tc.constraint_type,pg_get_constraintdef(pc.oid,true) definition
from information_schema.table_constraints tc join pg_constraint pc on pc.conname=tc.constraint_name and pc.conrelid=(quote_ident(tc.table_schema)||'.'||quote_ident(tc.table_name))::regclass
where tc.table_schema='public' and tc.table_name in ('suivi_des_edt','email_outbox','email_delivery_log') order by tc.table_name,tc.constraint_name;

select tablename,indexname,indexdef from pg_indexes where schemaname='public' and tablename in ('suivi_des_edt','email_outbox','email_delivery_log') order by tablename,indexname;

select policyname,tablename,roles,cmd,qual,with_check,
 case when coalesce(qual,'')~*'(^|[^[:alnum:]_])true([^[:alnum:]_]|$)' or coalesce(with_check,'')~*'(^|[^[:alnum:]_])true([^[:alnum:]_]|$)' then 'PRESENT_BUT_MISMATCHED' else 'PRESENT_AND_CONFORMING' end recovery_status
from pg_policies where schemaname='public' and tablename in ('email_outbox','email_delivery_log') order by tablename,policyname;

select cl.relname table_name,cl.relrowsecurity rls_enabled,cl.relforcerowsecurity rls_forced from pg_class cl join pg_namespace n on n.oid=cl.relnamespace where n.nspname='public' and cl.relname in ('email_outbox','email_delivery_log');

select grantee,table_name,string_agg(privilege_type,',' order by privilege_type) privileges
from information_schema.role_table_grants where table_schema='public' and table_name in ('email_outbox','email_delivery_log') and grantee in ('PUBLIC','anon','authenticated','service_role') group by grantee,table_name order by table_name,grantee;

select p.proname,pg_get_function_identity_arguments(p.oid) identity_arguments,p.prosecdef security_definer,p.proconfig,pg_get_functiondef(p.oid) function_definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('validate_edt_requester_v131','enqueue_edt_completion_email_v131','request_edt_email_retry_v131','edt_email_status_v131','claim_edt_completion_email_v131','edt_email_activity_v131') order by p.proname;

select p.proname,case when x.grantee=0 then 'PUBLIC' else pg_get_userbyid(x.grantee) end grantee,x.privilege_type,x.is_grantable
from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x
where n.nspname='public' and p.proname in ('validate_edt_requester_v131','enqueue_edt_completion_email_v131','request_edt_email_retry_v131','edt_email_status_v131','claim_edt_completion_email_v131','edt_email_activity_v131') order by p.proname,grantee;

select c.relname table_name,t.tgname trigger_name,pg_get_triggerdef(t.oid,true) trigger_definition,p.proname function_name
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid
where n.nspname='public' and t.tgname in ('validate_edt_requester_v131','enqueue_edt_completion_email_v131','edt_email_activity_v131') and not t.tgisinternal order by c.relname,t.tgname;

select count(*) edt_requester_client_mismatches from public.suivi_des_edt e left join public.campagnes_maitres c on c.id=e.campagne_id left join public.utilisateurs u on u.id=e.requester_contact_id where e.requester_contact_id is not null and (c.client_id is null or u.client_id is null or u.client_id<>c.client_id);
select count(*) report_requester_client_mismatches from public.edt_reports r join public.suivi_des_edt e on e.id=r.edt_id left join public.campagnes_maitres c on c.id=e.campagne_id left join public.utilisateurs u on u.id=r.requester_contact_id where c.client_id is null or u.client_id is null or u.client_id<>c.client_id;

select case when exists(select 1 from public.suivi_des_edt e join public.campagnes_maitres c on c.id=e.campagne_id join public.utilisateurs a on a.client_id=c.client_id join public.utilisateurs b on b.client_id<>c.client_id) then 'cross_client_fixture_available' else 'cross_client_fixture_unavailable' end cross_client_fixture;
select e.id edt_id,c.client_id edt_client_id,u.id foreign_requester_id,u.client_id requester_client_id,'would_be_rejected' structural_result from public.suivi_des_edt e join public.campagnes_maitres c on c.id=e.campagne_id join public.utilisateurs u on u.client_id<>c.client_id order by e.id,u.id limit 10;

select edt_id,event_type,count(*) automatic_outbox_duplicates from public.email_outbox where not manual_resend group by edt_id,event_type having count(*)>1;
select edt_id,event_type,report_version,count(*) successful_automatic_delivery_duplicates from public.email_delivery_log where status='sent' and not manual_resend group by edt_id,event_type,report_version having count(*)>1;

select case when b.id is null then 'MISSING' when b.public then 'PRESENT_BUT_MISMATCHED' else 'PRESENT_AND_CONFORMING' end recovery_status,b.id,b.public,b.file_size_limit,b.allowed_mime_types from (values(1)) seed(x) left join storage.buckets b on b.id='final-reports';

select to_regclass('public.activity_events') activity_events_table,
 exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid where t.tgname='edt_email_activity_v131' and p.proname='edt_email_activity_v131' and not t.tgisinternal) activity_trigger_conforming;

rollback;
