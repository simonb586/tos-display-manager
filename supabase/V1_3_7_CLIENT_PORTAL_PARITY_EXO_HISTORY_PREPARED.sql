-- V1.3.7 — projection Client fidèle et visibilité historique EXO.
-- Additif, idempotent. À exécuter seulement après le vérificateur READ ONLY associé.
begin;

do $$
declare v_demo_active bigint;v_unowned bigint;v_other bigint;
begin
 select count(*) into v_demo_active from public.infrastructures where client_id=1;
 select count(*) into v_unowned from public.infrastructures where client_id is null;
 select count(*) into v_other from public.infrastructures where client_id not in(1,2);
 raise notice 'BEFORE infrastructures demo=%, sans_client=%, autres_clients=%',v_demo_active,v_unowned,v_other;
 if v_demo_active<>0 or v_unowned<>0 or v_other<>0 then
  raise exception 'STOP_NO_GO_CLIENT_OWNERSHIP_CONTRADICTION';
 end if;
 if not exists(select 1 from public.clients where id=2 and upper(nom_client)='EXO' and statut='Actif') then
  raise exception 'STOP_NO_GO_EXO_CANONICAL_CLIENT_MISSING';
 end if;
end$$;

update public.campagnes_maitres set client_published=true
where client_id=2 and not client_published;
update public.campagnes_supports cs set client_visible=true
where not cs.client_visible and exists(select 1 from public.campagnes_maitres c where c.id=cs.campagne_id and c.client_id=2);
update public.support_photos p set client_visible=true
where not p.client_visible and(p.client_id=2 or exists(select 1 from public.infrastructures i where i.support_id=p.support_id and i.client_id=2));
update public.suivi_des_edt e set client_visible=true
where not e.client_visible and exists(select 1 from public.campagnes_maitres c where c.id=e.campagne_id and c.client_id=2);
update public.enjeux_terrain e set client_visible=true
where not e.client_visible and(e.client_id=2 or exists(select 1 from public.infrastructures i where i.support_id=e.support_id and i.client_id=2));
update public.activity_events set client_visible=true
where client_id='2' and not client_visible;

create or replace function public.client_portal_list_v1362(p_section text,p_page integer default 1,p_page_size integer default 25,p_filters jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();v_client bigint;v_role text;v_limit integer;v_offset integer;v_total bigint;v_rows jsonb;v_search text:=trim(coalesce(p_filters->>'search',''));
begin
 if v_uid is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='42501';end if;
 select client_id,role into v_client,v_role from public.utilisateurs where auth_user_id=v_uid and statut='Actif' and role in('Client','Client-Admin');
 if v_client is null then raise exception 'CLIENT_SCOPE_MISSING' using errcode='42501';end if;
 v_limit:=least(100,greatest(1,coalesce(p_page_size,25)));v_offset:=(greatest(1,coalesce(p_page,1))-1)*v_limit;
 if p_section in('supports','infrastructures')then
  select count(*)into v_total from public.infrastructures i where i.client_id=v_client and(v_search=''or concat_ws(' ',i.support_id,i.site,i.type_site,i.type_support,i.emplacement_visibilite)ilike'%'||v_search||'%');
  select coalesce(jsonb_agg(to_jsonb(q)),'[]')into v_rows from(
   select i.support_id,i.site,i.type_site,i.type_support,i.emplacement_visibilite,i.latitude,i.longitude,i.coordonnees_gps
   from public.infrastructures i where i.client_id=v_client and(v_search=''or concat_ws(' ',i.support_id,i.site,i.type_site,i.type_support,i.emplacement_visibilite)ilike'%'||v_search||'%')
   order by i.site nulls last,i.support_id limit v_limit offset v_offset)q;
 elsif p_section='campaigns'then
  select count(*)into v_total from public.campagnes_maitres c where c.client_id=v_client and c.client_published and(v_search=''or concat_ws(' ',c.nom_campagne,c.statut,c.business_context)ilike'%'||v_search||'%');
  select coalesce(jsonb_agg(to_jsonb(q)),'[]')into v_rows from(select c.id,c.nom_campagne,c.business_context,c.date_debut,c.date_fin,c.statut from public.campagnes_maitres c where c.client_id=v_client and c.client_published and(v_search=''or concat_ws(' ',c.nom_campagne,c.statut,c.business_context)ilike'%'||v_search||'%')order by c.date_debut desc nulls last,c.id desc limit v_limit offset v_offset)q;
 elsif p_section='photos'then
  select count(*)into v_total from public.support_photos p where p.client_id=v_client and p.client_visible and p.deleted_at is null and(v_search=''or concat_ws(' ',p.support_id,p.nom_fichier,p.type_photo,p.statut_validation)ilike'%'||v_search||'%');
  select coalesce(jsonb_agg(to_jsonb(q)),'[]')into v_rows from(select p.id,p.support_id,p.type_photo,p.nom_fichier,p.storage_bucket,p.storage_path,p.thumbnail_url,p.prise_le,p.statut_validation from public.support_photos p where p.client_id=v_client and p.client_visible and p.deleted_at is null and(v_search=''or concat_ws(' ',p.support_id,p.nom_fichier,p.type_photo,p.statut_validation)ilike'%'||v_search||'%')order by p.prise_le desc nulls last,p.id desc limit v_limit offset v_offset)q;
 elsif p_section='edt'then
  select count(*)into v_total from public.suivi_des_edt e join public.campagnes_maitres c on c.id=e.campagne_id where c.client_id=v_client and c.client_published and e.client_visible and(v_search=''or concat_ws(' ',e.no_edt,e.statut)ilike'%'||v_search||'%');
  select coalesce(jsonb_agg(to_jsonb(q)),'[]')into v_rows from(select e.id,e.no_edt,e.statut,e.date_debut_prevue,e.date_fin_prevue,e.campagne_id from public.suivi_des_edt e join public.campagnes_maitres c on c.id=e.campagne_id where c.client_id=v_client and c.client_published and e.client_visible and(v_search=''or concat_ws(' ',e.no_edt,e.statut)ilike'%'||v_search||'%')order by e.date_fin_prevue desc nulls last,e.id desc limit v_limit offset v_offset)q;
 elsif p_section='issues'then
  select count(*)into v_total from public.enjeux_terrain e where e.client_id=v_client and e.client_visible and(v_search=''or concat_ws(' ',e.support_id,e.reference,e.type_enjeu,e.description,e.statut)ilike'%'||v_search||'%');
  select coalesce(jsonb_agg(to_jsonb(q)),'[]')into v_rows from(select e.id,e.reference,e.support_id,e.type_enjeu,e.description,e.statut,e.priorite,e.created_at,e.resolved_at from public.enjeux_terrain e where e.client_id=v_client and e.client_visible and(v_search=''or concat_ws(' ',e.support_id,e.reference,e.type_enjeu,e.description,e.statut)ilike'%'||v_search||'%')order by e.created_at desc,e.id desc limit v_limit offset v_offset)q;
 elsif p_section='history'then
  select count(*)into v_total from public.activity_events a where a.client_id=v_client::text and a.client_visible and(v_search=''or concat_ws(' ',a.action,a.module,a.entity_type,a.support_id,a.status)ilike'%'||v_search||'%');
  select coalesce(jsonb_agg(to_jsonb(q)),'[]')into v_rows from(select a.id,a.occurred_at,a.action,a.module,a.entity_type,a.entity_id,a.campaign_id,a.edt_id,a.support_id,a.status from public.activity_events a where a.client_id=v_client::text and a.client_visible and(v_search=''or concat_ws(' ',a.action,a.module,a.entity_type,a.support_id,a.status)ilike'%'||v_search||'%')order by a.occurred_at desc,a.id desc limit v_limit offset v_offset)q;
 else return public.client_portal_list_v1361(p_section,p_page,p_page_size,p_filters);end if;
 return jsonb_build_object('section',p_section,'page',greatest(1,coalesce(p_page,1)),'page_size',v_limit,'total',v_total,'rows',v_rows,'client_id',v_client,'role',v_role);
end$$;

revoke all on function public.client_portal_list_v1362(text,integer,integer,jsonb) from public,anon;
grant execute on function public.client_portal_list_v1362(text,integer,integer,jsonb) to authenticated;
commit;
