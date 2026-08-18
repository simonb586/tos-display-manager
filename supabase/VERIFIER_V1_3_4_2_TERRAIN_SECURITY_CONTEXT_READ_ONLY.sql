-- V1.3.4.2 — VERIFICATEUR READ ONLY — aucune écriture.
select p.proname,pg_get_function_identity_arguments(p.oid) arguments,p.prosecdef security_definer,r.rolname owner,p.proconfig,
 has_function_privilege('anon',p.oid,'execute') anon_execute,
 has_function_privilege('authenticated',p.oid,'execute') authenticated_execute,
 has_function_privilege('public',p.oid,'execute') public_execute,
 position('auth.uid()' in pg_get_functiondef(p.oid))>0 checks_auth_uid,
 position('utilisateurs' in pg_get_functiondef(p.oid))>0 checks_profile
from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner
where n.nspname='public' and p.proname in ('finaliser_installation_terrain_v01210','finaliser_installation_terrain_v01273','finaliser_installation_terrain_v0127','finaliser_intervention_terrain_v01273','finaliser_intervention_terrain_v1342','resolve_terrain_sync_v113','request_terrain_sync_retry_v113','lister_contextes_terrain_v1342') order by p.proname,arguments;

select column_name,data_type,is_nullable from information_schema.columns where table_schema='public' and table_name='enjeux_terrain' and column_name='edt_phase_id';
select tc.constraint_name,ccu.table_name referenced_table,ccu.column_name referenced_column from information_schema.table_constraints tc join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name and ccu.constraint_schema=tc.constraint_schema where tc.table_schema='public' and tc.table_name='enjeux_terrain' and tc.constraint_type='FOREIGN KEY' and ccu.table_name='edt_phases';
select indexname,indexdef from pg_indexes where schemaname='public' and tablename='enjeux_terrain' and indexname='enjeux_terrain_edt_phase_v1342_idx';
select count(*) deterministic_backfill_candidates from public.enjeux_terrain e where e.edt_phase_id is null and 1=(select count(distinct es.phase_id) from public.edt_supports es where es.support_id=e.support_id and es.phase_id is not null);
select count(*) ambiguous_issue_contexts from public.enjeux_terrain e where e.edt_phase_id is null and 1<(select count(distinct es.phase_id) from public.edt_supports es where es.support_id=e.support_id and es.phase_id is not null);
select count(*) issues_without_known_context from public.enjeux_terrain e where e.edt_phase_id is null and 0=(select count(distinct es.phase_id) from public.edt_supports es where es.support_id=e.support_id and es.phase_id is not null);
select count(*) invalid_persisted_contexts from public.enjeux_terrain e left join public.edt_supports es on es.phase_id=e.edt_phase_id and es.support_id=e.support_id where e.edt_phase_id is not null and es.id is null;
select relname,relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relname in ('enjeux_terrain','edt_phases','edt_supports');
