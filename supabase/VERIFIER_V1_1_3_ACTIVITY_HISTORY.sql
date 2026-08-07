begin read only;

with checks as (
  select 'activity_events_table' check_name, to_regclass('public.activity_events') is not null ok
  union all select 'terrain_history_view', to_regclass('public.terrain_sync_history_v113') is not null
  union all select 'required_columns', not exists (
    select 1 from (values
      ('activity_events','occurred_at','timestamp with time zone','NO'),
      ('activity_events','source_system','text','NO'),
      ('activity_events','source_record_id','text','NO'),
      ('activity_events','source_occurred_at','timestamp with time zone','NO'),
      ('activity_events','reconstruction_method','text','NO'),
      ('activity_events','confidence','text','NO'),
      ('activity_events','metadata','jsonb','NO'),
      ('terrain_sync_diagnostics','attempt','integer','NO'),
      ('terrain_sync_diagnostics','last_attempt_at','timestamp with time zone','YES'),
      ('terrain_sync_diagnostics','resolved_at','timestamp with time zone','YES'),
      ('terrain_sync_diagnostics','resolved_by','uuid','YES'),
      ('terrain_sync_diagnostics','resolution','text','YES')
    ) expected(table_name,column_name,data_type,is_nullable)
    left join information_schema.columns actual on actual.table_schema='public' and actual.table_name=expected.table_name and actual.column_name=expected.column_name
    where (actual.data_type,actual.is_nullable) is distinct from (expected.data_type,expected.is_nullable)
  )
  union all select 'provenance_unique', exists (
    select 1 from pg_constraint where conrelid='public.activity_events'::regclass and contype='u'
      and pg_get_constraintdef(oid) ilike '%(source_system, source_record_id)%'
  )
  union all select 'expected_indexes', 6=(select count(*) from pg_indexes where schemaname='public' and indexname in(
    'activity_events_actor_idx','activity_events_entities_idx','activity_events_module_idx','activity_events_occurred_idx','terrain_sync_history_idx','terrain_sync_reference_idx'))
  union all select 'rls_enabled', 2=(select count(*) from pg_class where oid in('public.activity_events'::regclass,'public.terrain_sync_diagnostics'::regclass) and relrowsecurity)
  union all select 'terrain_view_security_invoker', exists(select 1 from pg_class where oid='public.terrain_sync_history_v113'::regclass and 'security_invoker=true'=any(coalesce(reloptions,'{}'::text[])))
  union all select 'postgres_owners', 2=(select count(*) from pg_class where oid in('public.activity_events'::regclass,'public.terrain_sync_diagnostics'::regclass) and pg_get_userbyid(relowner)='postgres')
  union all select 'minimal_policies', 3=(select count(*) from pg_policies where schemaname='public' and tablename in('activity_events','terrain_sync_diagnostics') and roles='{authenticated}')
  union all select 'no_public_or_anon_table_acl', not exists (
    select 1 from information_schema.role_table_grants where table_schema='public' and table_name='activity_events' and grantee in('PUBLIC','anon')
  )
  union all select 'authenticated_acl', exists (
    select 1 from information_schema.role_table_grants where table_schema='public' and table_name='activity_events' and grantee='authenticated' and privilege_type='SELECT'
  )
  union all select 'security_definer_search_path', 3=(
    select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in('capture_activity_source_v113','resolve_terrain_sync_v113','request_terrain_sync_retry_v113')
      and p.prosecdef and 'search_path=public'=any(coalesce(p.proconfig,'{}'::text[]))
  )
  union all select 'no_public_or_anon_rpc', not exists (
    select 1 from information_schema.routine_privileges where routine_schema='public'
      and routine_name in('resolve_terrain_sync_v113','request_terrain_sync_retry_v113') and grantee in('PUBLIC','anon')
  )
  union all select 'capture_triggers', 7=(
    select count(distinct trigger_name) from information_schema.triggers where trigger_schema='public' and trigger_name like 'activity_capture_%_v113'
  )
  union all select 'valid_confidence_only', not exists(select 1 from public.activity_events where confidence not in('exact','derived'))
  union all select 'complete_provenance', not exists(select 1 from public.activity_events where source_system is null or source_record_id is null or source_occurred_at is null)
  union all select 'no_duplicate_provenance', not exists(select 1 from public.activity_events group by source_system,source_record_id having count(*)>1)
)
select
  bool_and(ok) as go,
  jsonb_object_agg(check_name,ok order by check_name) as checks,
  count(*) filter(where ok) as passed,
  count(*) filter(where not ok) as failed
from checks;

rollback;
