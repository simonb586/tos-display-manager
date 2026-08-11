-- STRICTEMENT READ ONLY : inventaire et contrôles post-migration V1.3.1.
begin read only;

select expected.object_type,expected.object_name,
 case expected.object_type
  when 'table' then to_regclass('public.'||expected.object_name) is not null
  when 'function' then to_regprocedure(expected.object_name) is not null
  when 'trigger' then exists(select 1 from pg_trigger where tgname=expected.object_name and not tgisinternal)
 end as present
from (values
 ('table','edt_reports'),('table','email_outbox'),('table','email_delivery_log'),
 ('function','public.validate_edt_requester_v131()'),('function','public.enqueue_edt_completion_email_v131()'),
 ('function','public.request_edt_email_retry_v131(bigint,boolean)'),('function','public.edt_email_status_v131(bigint)'),
 ('function','public.claim_edt_completion_email_v131(bigint,integer)'),('function','public.edt_email_activity_v131()'),
 ('trigger','validate_edt_requester_v131'),('trigger','enqueue_edt_completion_email_v131'),('trigger','edt_email_activity_v131')
) expected(object_type,object_name) order by expected.object_type,expected.object_name;

select c.table_name,c.column_name,c.data_type,c.is_nullable,c.column_default
from information_schema.columns c
where c.table_schema='public' and ((c.table_name='suivi_des_edt' and c.column_name='requester_contact_id') or c.table_name in ('email_outbox','email_delivery_log'))
order by c.table_name,c.ordinal_position;

select cl.relname table_name,cl.relrowsecurity rls_enabled,cl.relforcerowsecurity rls_forced
from pg_class cl join pg_namespace n on n.oid=cl.relnamespace
where n.nspname='public' and cl.relname in ('edt_reports','email_outbox','email_delivery_log');

select policyname,tablename,roles,cmd,qual,with_check,
 (coalesce(qual,'')~*'(^|[^[:alnum:]_])true([^[:alnum:]_]|$)' or coalesce(with_check,'')~*'(^|[^[:alnum:]_])true([^[:alnum:]_]|$)') dangerous_true
from pg_policies where schemaname='public' and tablename in ('email_outbox','email_delivery_log')
order by tablename,policyname;

select grantee,table_name,string_agg(privilege_type,',' order by privilege_type) privileges
from information_schema.role_table_grants
where table_schema='public' and table_name in ('email_outbox','email_delivery_log') and grantee in ('PUBLIC','anon','authenticated','service_role')
group by grantee,table_name order by table_name,grantee;

select p.proname,pg_get_function_identity_arguments(p.oid) identity_arguments,p.prosecdef security_definer,p.provolatile,
 p.proconfig,pg_get_userbyid(p.proowner) owner
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('validate_edt_requester_v131','enqueue_edt_completion_email_v131','request_edt_email_retry_v131','edt_email_status_v131','claim_edt_completion_email_v131','edt_email_activity_v131')
order by p.proname;

select p.proname,pg_get_function_identity_arguments(p.oid) identity_arguments,
 case when x.grantee=0 then 'PUBLIC' else pg_get_userbyid(x.grantee) end grantee,x.privilege_type,x.is_grantable
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x
where n.nspname='public' and p.proname in ('validate_edt_requester_v131','enqueue_edt_completion_email_v131','request_edt_email_retry_v131','edt_email_status_v131','claim_edt_completion_email_v131','edt_email_activity_v131')
order by p.proname,grantee;

select p.proname,pg_get_functiondef(p.oid) function_definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('validate_edt_requester_v131','enqueue_edt_completion_email_v131','request_edt_email_retry_v131','edt_email_status_v131','claim_edt_completion_email_v131','edt_email_activity_v131')
order by p.proname;

select c.relname table_name,t.tgname trigger_name,pg_get_triggerdef(t.oid,true) trigger_definition,p.proname function_name
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid
where n.nspname='public' and t.tgname in ('validate_edt_requester_v131','enqueue_edt_completion_email_v131','edt_email_activity_v131') and not t.tgisinternal
order by c.relname,t.tgname;

select tc.constraint_name,tc.table_name,tc.constraint_type,pg_get_constraintdef(pc.oid,true) definition
from information_schema.table_constraints tc join pg_constraint pc on pc.conname=tc.constraint_name and pc.conrelid=(quote_ident(tc.table_schema)||'.'||quote_ident(tc.table_name))::regclass
where tc.table_schema='public' and tc.table_name in ('suivi_des_edt','email_outbox','email_delivery_log')
order by tc.table_name,tc.constraint_name;

select tablename,indexname,indexdef from pg_indexes
where schemaname='public' and tablename in ('suivi_des_edt','email_outbox','email_delivery_log')
order by tablename,indexname;

select id bucket_id,public as publicly_readable,file_size_limit,allowed_mime_types
from storage.buckets where id='final-reports';

select count(*) edt_requester_client_mismatches
from public.suivi_des_edt e left join public.campagnes_maitres c on c.id=e.campagne_id left join public.utilisateurs u on u.id=e.requester_contact_id
where e.requester_contact_id is not null and (c.client_id is null or u.client_id is null or u.client_id<>c.client_id);

select count(*) report_requester_client_mismatches
from public.edt_reports r join public.suivi_des_edt e on e.id=r.edt_id left join public.campagnes_maitres c on c.id=e.campagne_id left join public.utilisateurs u on u.id=r.requester_contact_id
where c.client_id is null or u.client_id is null or u.client_id<>c.client_id;

select case when exists(
 select 1 from public.suivi_des_edt e join public.campagnes_maitres c on c.id=e.campagne_id
 join public.utilisateurs same_client on same_client.client_id=c.client_id
 join public.utilisateurs other_client on other_client.client_id<>c.client_id
 where same_client.courriel is not null and other_client.courriel is not null
) then 'cross_client_fixture_available' else 'cross_client_fixture_unavailable' end cross_client_fixture;

select e.id edt_id,c.client_id edt_client_id,u.id foreign_requester_id,u.client_id requester_client_id,'would_be_rejected' structural_result
from public.suivi_des_edt e join public.campagnes_maitres c on c.id=e.campagne_id join public.utilisateurs u on u.client_id<>c.client_id
where u.courriel is not null order by e.id,u.id limit 10;

select o.id,o.edt_id,e.statut,o.event_type,o.idempotency_key,o.status,o.attempt_count,o.report_id,r.report_version,o.last_error
from public.email_outbox o join public.suivi_des_edt e on e.id=o.edt_id left join public.edt_reports r on r.id=o.report_id
order by o.created_at desc;

select edt_id,event_type,report_version,count(*) successful_automatic_deliveries
from public.email_delivery_log where status='sent' and not manual_resend
group by edt_id,event_type,report_version having count(*)>1;

rollback;
