begin read only;

with source_rows as (
  select 'journal_des_evenements' source_system,id::text source_record_id,created_at occurred_at,action is not null and table_concernee is not null recoverable,'exact' confidence,utilisateur actor,null::text status from public.journal_des_evenements
  union all select 'operations_history',id::text,created_at,action is not null and coalesce(entity_id,entity_reference) is not null,'exact',user_email,null::text from public.operations_history
  union all select 'terrain_sync_diagnostics',id::text,created_at,etape is not null and reference is not null,'exact',utilisateur,statut from public.terrain_sync_diagnostics
  union all select 'terrain_operations',id::text,created_at,type_operation is not null and reference is not null,'exact',utilisateur,statut from public.terrain_operations
  union all select 'photo_action_log',id::text,created_at,action is not null and photo_id is not null,'exact',user_id::text,null::text from public.photo_action_log
  union all select 'support_photos',id::text,coalesce(prise_le,created_at),coalesce(prise_le,created_at) is not null,'derived',utilisateur,statut_validation from public.support_photos
  union all select 'journal_propagations',id::text,created_at,declencheur is not null and operation_id is not null,'exact',utilisateur,statut from public.journal_propagations
  union all select 'relation_field_config_audit',id::text,changed_at,changed_at is not null and relation_field_id is not null,'exact',changed_by::text,configuration_status from public.relation_field_config_audit
  union all select 'historique_des_campagnes',id::text,created_at,created_at is not null and support_id is not null and coalesce(campagne,visuel,no_edt) is not null,'derived',utilisateur,null::text from public.historique_des_campagnes
  union all select 'edt_supports',id::text,created_at,created_at is not null and support_id is not null and edt_id is not null,'derived',assigne_a,statut from public.edt_supports
  union all select 'suivi_des_edt',id::text,created_at,created_at is not null and no_edt is not null,'derived',coordonnateur,statut from public.suivi_des_edt
), annotated as (
  select r.*,e.id is not null already_present from source_rows r
  left join public.activity_events e using(source_system,source_record_id)
), per_source as (
  select source_system source,count(*) total,count(*) filter(where recoverable) recoverable,
    count(*) filter(where recoverable and confidence='exact') exact,
    count(*) filter(where recoverable and confidence='derived') derived,
    count(*) filter(where not recoverable) unknown,
    count(*) filter(where recoverable and already_present) duplicates,
    count(*) filter(where recoverable and not already_present) would_insert,
    min(occurred_at) filter(where recoverable) first_at,max(occurred_at) filter(where recoverable) last_at,
    count(*) filter(where recoverable and nullif(trim(actor),'') is not null) user_known,
    count(*) filter(where recoverable and nullif(trim(actor),'') is null) user_unknown
  from annotated group by source_system
), current_state as (
  select count(*) current_events,count(*) filter(where confidence='exact') current_exact,
    count(*) filter(where confidence='derived') current_derived,count(distinct nullif(trim(actor_email),'')) current_users
  from public.activity_events
), terrain as (
  select count(*) filter(where recoverable) recoverable,
    count(*) filter(where recoverable and lower(coalesce(status,'')) in('echec','échec','erreur','error','failed','échouée')) errors
  from annotated where source_system in('terrain_sync_diagnostics','terrain_operations')
)
select jsonb_build_object(
  'current',(select to_jsonb(current_state) from current_state),
  'sources',(select jsonb_agg(to_jsonb(per_source) order by source) from per_source),
  'totals',(select jsonb_build_object(
    'recoverable',sum(recoverable),'exact',sum(exact),'derived',sum(derived),'unknown',sum(unknown),
    'duplicates',sum(duplicates),'would_insert',sum(would_insert),'first_at',min(first_at),'last_at',max(last_at),
    'user_known',sum(user_known),'user_unknown',sum(user_unknown)) from per_source),
  'terrain',(select to_jsonb(terrain) from terrain)
) as dry_run;

rollback;
