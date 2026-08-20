-- PREPARATION UNIQUEMENT — NE PAS EXECUTER AVANT APPROBATION.
-- V1.3.6.1: couverture des sous-vues Client + aperçu administrateur sans impersonation Auth.
begin;

create or replace function public.client_portal_list_v1361(p_section text,p_page integer default 1,p_page_size integer default 25,p_filters jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();v_client bigint;v_role text;v_offset integer;v_limit integer;v_rows jsonb:='[]';v_total bigint:=0;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select u.client_id,u.role into v_client,v_role from public.utilisateurs u where u.auth_user_id=v_uid and u.statut='Actif' and u.role in('Client','Client-Admin') limit 1;
  if v_client is null then raise exception 'client_scope_denied' using errcode='42501'; end if;
  if p_section not in ('poster_directory','information_centers','information_centers_issues','stops','vehicles_trains') then raise exception 'invalid_section'; end if;
  v_limit:=least(100,greatest(1,coalesce(p_page_size,25)));
  v_offset:=(greatest(1,coalesce(p_page,1))-1)*v_limit;

  if p_section='poster_directory' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select distinct c.id campaign_id,c.nom_campagne,c.business_context,cs.support_id,cs.visuel_attendu visual,cs.statut,cs.no_edt
      from public.campagnes_supports cs join public.campagnes_maitres c on c.id=cs.campagne_id
      where c.client_id=v_client and c.client_published and cs.client_visible and public.client_can_access_campaign_v120(c.id)
      order by c.nom_campagne,cs.support_id limit v_limit offset v_offset) q;
  elsif p_section='information_centers' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select i.site,i.type_site,count(*) nombre_de_cadres,max(i.date_derniere_manipulation) derniere_intervention
      from public.campagnes_supports cs join public.campagnes_maitres c on c.id=cs.campagne_id join public.infrastructures i on i.support_id=cs.support_id
      where c.client_id=v_client and c.client_published and cs.client_visible and public.client_can_access_campaign_v120(c.id) and coalesce(i.site,'')<>''
      group by i.site,i.type_site
      order by i.site limit v_limit offset v_offset) q;
  elsif p_section='information_centers_issues' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select distinct i.site,e.support_id,e.type_enjeu,e.description,e.statut,e.priorite,e.created_at
      from public.enjeux_terrain e join public.infrastructures i on i.support_id=e.support_id
      where e.client_visible and exists(select 1 from public.campagnes_supports cs join public.campagnes_maitres c on c.id=cs.campagne_id where cs.support_id=e.support_id and c.client_id=v_client and c.client_published and cs.client_visible and public.client_can_access_campaign_v120(c.id))
      order by e.created_at desc limit v_limit offset v_offset) q;
  elsif p_section='stops' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select distinct i.support_id no_arret,i.emplacement_visibilite,i.type_support,i.site
      from public.campagnes_supports cs join public.campagnes_maitres c on c.id=cs.campagne_id join public.infrastructures i on i.support_id=cs.support_id
      where c.client_id=v_client and c.client_published and cs.client_visible and public.client_can_access_campaign_v120(c.id) and (i.type_site ilike '%arret%' or i.type_site ilike '%arrêt%' or i.support_id ilike 'A%')
      order by i.support_id limit v_limit offset v_offset) q;
  elsif p_section='vehicles_trains' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select distinct i.support_id,i.site voiture_train,i.type_support,i.emplacement_visibilite
      from public.campagnes_supports cs join public.campagnes_maitres c on c.id=cs.campagne_id join public.infrastructures i on i.support_id=cs.support_id
      where c.client_id=v_client and c.client_published and cs.client_visible and public.client_can_access_campaign_v120(c.id) and (i.type_site ilike '%voiture%' or i.type_site ilike '%train%' or i.type_support ilike '%voiture%' or i.type_support ilike '%train%')
      order by i.site,i.support_id limit v_limit offset v_offset) q;
  end if;

  return jsonb_build_object('section',p_section,'page',greatest(1,coalesce(p_page,1)),'page_size',v_limit,'total',v_total,'rows',v_rows);
end$$;

create or replace function public.admin_preview_client_portal_context_v1361(p_target_user_id bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_admin uuid:=auth.uid();v_target public.utilisateurs%rowtype;v_client jsonb;v_tables text[];v_sections jsonb:='{}'::jsonb;v_section text;v_role text;v_client_id bigint;
begin
  if v_admin is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not exists(select 1 from public.utilisateurs a where a.auth_user_id=v_admin and a.statut='Actif' and a.role='Administrateur') then raise exception 'admin_required' using errcode='42501'; end if;
  select * into v_target from public.utilisateurs u where u.id=p_target_user_id and u.statut='Actif' and u.role in('Client','Client-Admin');
  if not found or v_target.client_id is null then raise exception 'target_client_user_not_found' using errcode='42501'; end if;
  v_role:=v_target.role;v_client_id:=v_target.client_id;
  select to_jsonb(c) into v_client from public.clients c where c.id=v_client_id;
  select p.visible_tables into v_tables from public.role_ui_permissions p where p.role=v_role;

  foreach v_section in array array['campaigns','communications','supports','poster_directory','information_centers','information_centers_issues','stops','vehicles_trains','photos','reports','edt','issues','history','members'] loop
    v_sections:=jsonb_set(v_sections,array[v_section],public.admin_preview_client_portal_section_v1361(p_target_user_id,v_section,1,10),true);
  end loop;

  return jsonb_build_object(
    'target_user',jsonb_build_object('id',v_target.id,'nom',v_target.nom,'courriel',v_target.courriel,'role',v_role,'client_id',v_client_id,'statut',v_target.statut,'visible_tables',coalesce(v_tables,'{}'::text[])),
    'client',v_client,
    'visible_tables',coalesce(v_tables,'{}'::text[]),
    'campaign_access_status','Module 17 recalculé côté serveur',
    'sections',v_sections
  );
end$$;

create or replace function public.admin_preview_client_portal_section_v1361(p_target_user_id bigint,p_section text,p_page integer default 1,p_page_size integer default 25)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_admin uuid:=auth.uid();v_target public.utilisateurs%rowtype;v_client bigint;v_role text;v_offset integer;v_limit integer;v_rows jsonb:='[]';v_total bigint:=0;
begin
  if v_admin is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not exists(select 1 from public.utilisateurs a where a.auth_user_id=v_admin and a.statut='Actif' and a.role='Administrateur') then raise exception 'admin_required' using errcode='42501'; end if;
  select * into v_target from public.utilisateurs u where u.id=p_target_user_id and u.statut='Actif' and u.role in('Client','Client-Admin');
  if not found or v_target.client_id is null then raise exception 'target_client_user_not_found' using errcode='42501'; end if;
  v_client:=v_target.client_id;v_role:=v_target.role;v_limit:=least(100,greatest(1,coalesce(p_page_size,25)));v_offset:=(greatest(1,coalesce(p_page,1))-1)*v_limit;

  if p_section in('campaigns','communications') then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select c.id,c.nom_campagne,c.business_context,c.date_debut,c.date_fin,c.statut from public.campagnes_maitres c
      where c.client_id=v_client and c.client_published and c.business_context=case when p_section='campaigns' then 'marketing' else 'operational_communication' end
      and (v_role='Client-Admin' or exists(select 1 from public.client_campaign_access a where a.client_id=v_client and a.campaign_id=c.id and (a.user_id is null or a.user_id=v_target.auth_user_id)))
      order by c.date_fin desc nulls last,c.id desc limit v_limit offset v_offset) q;
  elsif p_section in('supports','poster_directory','information_centers','stops','vehicles_trains') then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select distinct i.site,i.support_id,i.type_support,i.emplacement_visibilite,cs.statut,cs.no_edt,c.id campaign_id,c.nom_campagne,c.business_context,cs.visuel_attendu visual
      from public.campagnes_supports cs join public.campagnes_maitres c on c.id=cs.campagne_id join public.infrastructures i on i.support_id=cs.support_id
      where c.client_id=v_client and c.client_published and cs.client_visible
      and (v_role='Client-Admin' or exists(select 1 from public.client_campaign_access a where a.client_id=v_client and a.campaign_id=c.id and (a.user_id is null or a.user_id=v_target.auth_user_id)))
      order by i.site,i.support_id,c.id limit v_limit offset v_offset) q;
  elsif p_section in('issues','information_centers_issues') then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select e.id,e.reference,e.support_id,e.type_enjeu,e.description,e.statut,e.priorite,e.created_at from public.enjeux_terrain e
      where e.client_visible and exists(select 1 from public.campagnes_supports cs join public.campagnes_maitres c on c.id=cs.campagne_id where cs.support_id=e.support_id and c.client_id=v_client and c.client_published and cs.client_visible)
      order by e.created_at desc limit v_limit offset v_offset) q;
  elsif p_section='photos' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select p.id,p.support_id,p.campagne_id,p.visuel_id,p.type_photo,p.nom_fichier,p.prise_le,p.statut_validation from public.support_photos p join public.campagnes_maitres c on c.id=p.campagne_id
      where c.client_id=v_client and c.client_published and p.client_visible order by p.prise_le desc,p.id desc limit v_limit offset v_offset) q;
  elsif p_section='reports' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select r.id,r.numero_edt,r.campagne,r.objet,r.sent_at,r.created_at from public.communications_finales r where r.client_id=v_client and r.client_published and r.statut in('Envoyé','Publié') order by r.created_at desc limit v_limit offset v_offset) q;
  elsif p_section='edt' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select e.id,e.no_edt,e.statut,e.date_debut_prevue,e.date_fin_prevue,e.campagne_id from public.suivi_des_edt e join public.campagnes_maitres c on c.id=e.campagne_id where c.client_id=v_client and c.client_published and e.client_visible order by e.date_fin_prevue desc nulls last,e.id desc limit v_limit offset v_offset) q;
  elsif p_section='history' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select a.id,a.occurred_at,a.action,a.module,a.entity_type,a.entity_id,a.campaign_id,a.edt_id,a.support_id,a.status from public.activity_events a where a.client_visible and a.client_id=v_client::text order by a.occurred_at desc,a.id desc limit v_limit offset v_offset) q;
  elsif p_section='members' and v_role='Client-Admin' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select u.id,u.nom,u.courriel,u.role,u.statut,u.updated_at from public.utilisateurs u where u.client_id=v_client and u.role in('Client','Client-Admin') order by u.nom,u.id limit v_limit offset v_offset) q;
  end if;

  return jsonb_build_object('section',p_section,'page',greatest(1,coalesce(p_page,1)),'page_size',v_limit,'total',v_total,'rows',v_rows);
end$$;

revoke all on function public.client_portal_list_v1361(text,integer,integer,jsonb) from public,anon;
revoke all on function public.admin_preview_client_portal_context_v1361(bigint) from public,anon;
revoke all on function public.admin_preview_client_portal_section_v1361(bigint,text,integer,integer) from public,anon;
grant execute on function public.client_portal_list_v1361(text,integer,integer,jsonb) to authenticated;
grant execute on function public.admin_preview_client_portal_context_v1361(bigint),public.admin_preview_client_portal_section_v1361(bigint,text,integer,integer) to authenticated;

commit;
