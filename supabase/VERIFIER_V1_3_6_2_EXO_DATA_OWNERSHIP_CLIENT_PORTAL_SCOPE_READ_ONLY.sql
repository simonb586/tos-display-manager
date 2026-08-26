-- STRICTEMENT READ ONLY. Aucun DDL/DML et aucune dependance a une extension.
-- Autonome avant migration: to_jsonb(row)->>'client_id' tolere une colonne absente.
with client_names as (
  select regexp_replace(translate(lower(trim(nom_client)),'àáâäãåçèéêëìíîïñòóôöõùúûüýÿ','aaaaaaceeeeiiiinooooouuuuyy'),'[^a-z0-9]+','','g') normalized_name,
    count(*) match_count,min(id) resolved_client_id,array_agg(id order by id) client_ids
  from public.clients group by 1
), exo as (
  select id,nom_client from public.clients
  where regexp_replace(translate(lower(trim(nom_client)),'àáâäãåçèéêëìíîïñòóôöõùúûüýÿ','aaaaaaceeeeiiiinooooouuuuyy'),'[^a-z0-9]+','','g')='exo'
), ownership as (
  select 'infrastructures'::text domain,i.support_id::text entity_id,(to_jsonb(i)->>'client_id')::bigint direct_client,array_agg(distinct c.client_id) filter(where c.client_id is not null) derived_clients
  from public.infrastructures i left join public.campagnes_supports cs on cs.support_id=i.support_id left join public.campagnes_maitres c on c.id=cs.campagne_id group by i.support_id,(to_jsonb(i)->>'client_id')
  union all select 'campaigns',c.id::text,(to_jsonb(c)->>'client_id')::bigint,array[(to_jsonb(c)->>'client_id')::bigint] from public.campagnes_maitres c
  union all select 'campaign_supports',concat(cs.campagne_id,':',cs.support_id),(to_jsonb(cs)->>'client_id')::bigint,array[c.client_id] from public.campagnes_supports cs left join public.campagnes_maitres c on c.id=cs.campagne_id
  union all select 'visuals',v.id::text,(to_jsonb(v)->>'client_id')::bigint,array[c.client_id] from public.campagne_visuels_formats v left join public.campagnes_maitres c on c.id=v.campagne_id
  union all select 'photos',p.id::text,(to_jsonb(p)->>'client_id')::bigint,array[c.client_id] from public.support_photos p left join public.campagnes_maitres c on c.id=p.campagne_id
  union all select 'edt',e.id::text,(to_jsonb(e)->>'client_id')::bigint,array[c.client_id] from public.suivi_des_edt e left join public.campagnes_maitres c on c.id=e.campagne_id
  union all select 'edt_phases',p.id::text,(to_jsonb(p)->>'client_id')::bigint,array[(to_jsonb(e)->>'client_id')::bigint] from public.edt_phases p left join public.suivi_des_edt e on e.id=p.edt_id
  union all select 'issues',e.id::text,(to_jsonb(e)->>'client_id')::bigint,array[(to_jsonb(e)->>'client_id')::bigint] from public.enjeux_terrain e
  union all select 'work_orders',b.id::text,(to_jsonb(b)->>'client_id')::bigint,array[(to_jsonb(e)->>'client_id')::bigint] from public.bons_de_travail b left join public.suivi_des_edt e on e.id=b.edt_id
  union all select 'client_requests',r.id::text,(to_jsonb(r)->>'client_id')::bigint,array[(to_jsonb(r)->>'client_id')::bigint] from public.requetes_clients r
  union all select 'history',a.id::text,
    case when trim(coalesce(a.client_id,''))~'^[0-9]+$' then trim(a.client_id)::bigint when n.match_count=1 then n.resolved_client_id else null end,
    array[case when trim(coalesce(a.client_id,''))~'^[0-9]+$' then trim(a.client_id)::bigint when n.match_count=1 then n.resolved_client_id else null end]
    from public.activity_events a left join client_names n on n.normalized_name=regexp_replace(translate(lower(trim(a.client_id)),'àáâäãåçèéêëìíîïñòóôöõùúûüýÿ','aaaaaaceeeeiiiinooooouuuuyy'),'[^a-z0-9]+','','g')
  union all select 'reports',r.id::text,(to_jsonb(r)->>'client_id')::bigint,array[(to_jsonb(r)->>'client_id')::bigint] from public.communications_finales r
), classified as (
  select o.*,cardinality(array_remove(derived_clients,null))>1 or (direct_client is not null and exists(select 1 from unnest(derived_clients)d where d<>direct_client)) ambiguous from ownership o
), domain_counts as (
  select domain,count(*) total,count(*) filter(where not ambiguous and coalesce(direct_client,derived_clients[1])=(select id from exo)) exo,
    count(*) filter(where direct_client is null and cardinality(array_remove(derived_clients,null))=0) without_client,count(*) filter(where ambiguous) ambiguous,
    count(*) filter(where not ambiguous and coalesce(direct_client,derived_clients[1]) is distinct from (select id from exo) and coalesce(direct_client,derived_clients[1]) is not null) other_client
  from classified group by domain
), activity_history as (
  select case when a.client_id is null then 'NULL' when trim(a.client_id)='' then 'EMPTY' when trim(a.client_id)~'^[0-9]+$' then 'NUMERIC'
    when coalesce(n.match_count,0)=1 then 'TEXT_RESOLVED' when coalesce(n.match_count,0)>1 then 'TEXT_AMBIGUOUS' else 'TEXT_UNRESOLVED' end category,
    a.client_id,n.resolved_client_id,n.match_count
  from public.activity_events a left join client_names n on n.normalized_name=regexp_replace(translate(lower(trim(a.client_id)),'àáâäãåçèéêëìíîïñòóôöõùúûüýÿ','aaaaaaceeeeiiiinooooouuuuyy'),'[^a-z0-9]+','','g')
), activity_counts as (
  select category,count(*) rows_count,count(distinct client_id) distinct_values from activity_history group by category
), activity_values as (
  select category,client_id,count(*) rows_count,max(resolved_client_id) resolved_client_id,max(match_count) match_count from activity_history where client_id is not null group by category,client_id
), marylene as (
  select u.id,u.courriel,u.role,u.statut,u.client_id,c.nom_client,u.auth_user_id is not null auth_user_id_present,coalesce(p.visible_tables,'{}'::text[]) visible_tables,
    (select count(*) from public.client_campaign_access a where a.client_id=u.client_id and (a.user_id is null or a.user_id=u.auth_user_id)) campaign_access_count,
    (select status from public.client_member_invitations i where lower(i.email)=lower(u.courriel) order by i.created_at desc limit 1) invitation_status
  from public.utilisateurs u left join public.clients c on c.id=u.client_id left join public.role_ui_permissions p on p.role=u.role
  where regexp_replace(translate(lower(trim(u.nom)),'àáâäãåçèéêëìíîïñòóôöõùúûüýÿ','aaaaaaceeeeiiiinooooouuuuyy'),'[^a-z0-9]+','','g')='maryleneblanchette'
)
select jsonb_build_object('read_only_verifier','SUCCESS','exo',jsonb_build_object('match_count',(select count(*) from exo),'matches',coalesce((select jsonb_agg(to_jsonb(exo)) from exo),'[]'::jsonb)),
  'domains',coalesce((select jsonb_agg(to_jsonb(domain_counts) order by domain) from domain_counts),'[]'::jsonb),'activity_events',jsonb_build_object('total',(select count(*) from activity_history),'categories',coalesce((select jsonb_agg(to_jsonb(activity_counts) order by category) from activity_counts),'[]'::jsonb),'values',coalesce((select jsonb_agg(to_jsonb(activity_values) order by category,rows_count desc) from activity_values),'[]'::jsonb)),
  'marylene',jsonb_build_object('match_count',(select count(*) from marylene),'matches',coalesce((select jsonb_agg(to_jsonb(marylene)) from marylene),'[]'::jsonb))) audit_v1362;
