-- STRICTEMENT READ ONLY; autonome avant et apres V1.3.6.4.
with target as(select 2::bigint id), domains as(
 select 'infrastructures' domain,(to_jsonb(i)->>'client_id')::bigint client_id,count(*) total from public.infrastructures i group by 2
 union all select 'campaigns',(to_jsonb(x)->>'client_id')::bigint,count(*) from public.campagnes_maitres x group by 2
 union all select 'campaign_supports',coalesce((to_jsonb(x)->>'client_id')::bigint,c.client_id),count(*) from public.campagnes_supports x left join public.campagnes_maitres c on c.id=x.campagne_id group by 2
 union all select 'visuals',coalesce((to_jsonb(x)->>'client_id')::bigint,c.client_id),count(*) from public.campagne_visuels_formats x left join public.campagnes_maitres c on c.id=x.campagne_id group by 2
 union all select 'photos',coalesce((to_jsonb(x)->>'client_id')::bigint,c.client_id),count(*) from public.support_photos x left join public.campagnes_maitres c on c.id=x.campagne_id group by 2
 union all select 'edt',coalesce((to_jsonb(x)->>'client_id')::bigint,c.client_id),count(*) from public.suivi_des_edt x left join public.campagnes_maitres c on c.id=x.campagne_id group by 2
 union all select 'edt_phases',coalesce((to_jsonb(x)->>'client_id')::bigint,(to_jsonb(e)->>'client_id')::bigint),count(*) from public.edt_phases x left join public.suivi_des_edt e on e.id=x.edt_id group by 2
 union all select 'issues',(to_jsonb(x)->>'client_id')::bigint,count(*) from public.enjeux_terrain x group by 2
 union all select 'requests',(to_jsonb(x)->>'client_id')::bigint,count(*) from public.requetes_clients x group by 2
 union all select 'work_orders',(to_jsonb(x)->>'client_id')::bigint,count(*) from public.bons_de_travail x group by 2
 union all select 'reports',(to_jsonb(x)->>'client_id')::bigint,count(*) from public.communications_finales x group by 2
 union all select 'history',case when trim(coalesce(x.client_id,''))~'^[0-9]+$' then trim(x.client_id)::bigint else null end,count(*) from public.activity_events x group by 2
), summary as(select domain,sum(total) total,sum(total)filter(where client_id=2) exo_id_2,sum(total)filter(where client_id is null) without_client,0::bigint ambiguous,sum(total)filter(where client_id=1) client_demo_id_1,sum(total)filter(where client_id not in(1,2) and client_id is not null) other_client from domains group by domain)
select jsonb_build_object('clients',(select jsonb_agg(jsonb_build_object('id',id,'nom',nom_client,'statut',statut)order by id)from public.clients),'exo_id_2_valid',(select exists(select 1 from public.clients where id=2 and regexp_replace(translate(lower(trim(nom_client)),'àáâäãåçèéêëìíîïñòóôöõùúûüýÿ','aaaaaaceeeeiiiinooooouuuuyy'),'[^a-z0-9]+','','g') in('exo','exomaryleneblanchette'))),'marylene',(select jsonb_build_object('id',id,'role',role,'statut',statut,'client_id',client_id,'auth',auth_user_id is not null)from public.utilisateurs where id=25),'domains',(select jsonb_agg(to_jsonb(summary)order by domain)from summary)) audit_v1364;
