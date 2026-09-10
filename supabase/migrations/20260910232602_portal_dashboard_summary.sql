-- Canonical aggregate counts; no business data, existing ACL or RLS changes.
CREATE OR REPLACE FUNCTION public.dashboard_key(value text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$ SELECT trim(both '_' from regexp_replace(lower(translate(replace(coalesce(value,''),'&',' et '),'àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ','aaaeeeeiioouuucAAAEEEEIIOOUUUC')),'[^a-z0-9]+','_','g')) $$;
REVOKE ALL ON FUNCTION public.dashboard_key(text) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.dashboard_key(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.client_portal_list_v120(p_section text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 25, p_filters jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=auth.uid();v_client bigint;v_role text;v_offset integer;v_limit integer;v_rows jsonb:='[]';v_total bigint:=0;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Client','Client-Admin')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.utilisateurs sec_actor JOIN public.clients sec_client ON sec_client.id=sec_actor.client_id WHERE sec_actor.auth_user_id=auth.uid() AND lower(coalesce(sec_actor.statut,''))='actif')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_client_required' USING ERRCODE='42501';END IF;

BEGIN

  select client_id,role into v_client,v_role from public.utilisateurs
   where auth_user_id=v_uid and statut='Actif' and role in ('Client','Client-Admin');
  if v_client is null then raise exception 'client_scope_denied' using errcode='42501'; end if;
  if p_section not in ('dashboard','campaigns','communications','supports','photos','reports','edt','issues','history','members') then raise exception 'invalid_section'; end if;
  if p_section='members' and v_role<>'Client-Admin' then raise exception 'client_admin_required' using errcode='42501'; end if;
  v_limit:=least(case when p_section='photos' then 50 else 100 end,greatest(1,coalesce(p_page_size,25)));
  v_offset:=(greatest(1,coalesce(p_page,1))-1)*v_limit;

  if p_section in ('campaigns','communications') then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select c.id,c.nom_campagne,c.business_context,c.date_debut,c.date_fin,c.statut
      from public.campagnes_maitres c where c.client_id=v_client and c.client_published
       and c.business_context=case when p_section='campaigns' then 'marketing' else 'operational_communication' end
       and (v_role='Client-Admin' or public.client_can_access_campaign_v120(c.id))
      order by c.date_fin desc nulls last,c.id desc limit v_limit offset v_offset) q;
  elsif p_section='supports' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select i.site,i.support_id,i.type_support,i.emplacement_visibilite,cs.statut,cs.no_edt,c.id campaign_id,c.nom_campagne,c.business_context,cs.visuel_attendu visual
      from public.campagnes_supports cs join public.campagnes_maitres c on c.id=cs.campagne_id
      join public.infrastructures i on i.support_id=cs.support_id
      where c.client_id=v_client and c.client_published and cs.client_visible and public.client_can_access_campaign_v120(c.id)
      order by i.site,i.support_id,c.id limit v_limit offset v_offset) q;
  elsif p_section='photos' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select p.id,p.support_id,p.campagne_id,p.visuel_id,p.type_photo,p.nom_fichier,p.storage_bucket,p.storage_path,p.prise_le,p.statut_validation
      from public.support_photos p join public.campagnes_maitres c on c.id=p.campagne_id
      where c.client_id=v_client and c.client_published and p.client_visible and public.client_can_access_campaign_v120(c.id)
      order by p.prise_le desc,p.id desc limit v_limit offset v_offset) q;
  elsif p_section='reports' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select r.id,r.numero_edt,r.campagne,r.objet,r.report_path,r.sent_at,r.created_at
      from public.communications_finales r where r.client_id=v_client and r.client_published and r.statut in ('Envoyé','Publié')
      order by r.created_at desc limit v_limit offset v_offset) q;
  elsif p_section='edt' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select e.id,e.no_edt,e.statut,e.date_debut_prevue,e.date_fin_prevue,e.rapport_final_envoye,e.rapport_final_path,e.campagne_id
      from public.suivi_des_edt e join public.campagnes_maitres c on c.id=e.campagne_id
      where c.client_id=v_client and c.client_published and e.client_visible and public.client_can_access_campaign_v120(c.id)
      order by e.date_fin_prevue desc nulls last,e.id desc limit v_limit offset v_offset) q;
  elsif p_section='issues' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select e.id,e.reference,e.support_id,e.type_enjeu,e.description,e.statut,e.priorite,e.created_at
      from public.enjeux_terrain e where e.client_visible and exists(select 1 from public.campagnes_supports cs join public.campagnes_maitres c on c.id=cs.campagne_id where cs.support_id=e.support_id and c.client_id=v_client and c.client_published and public.client_can_access_campaign_v120(c.id))
      order by e.created_at desc limit v_limit offset v_offset) q;
  elsif p_section='history' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select a.id,a.occurred_at,a.action,a.module,a.entity_type,a.entity_id,a.campaign_id,a.edt_id,a.support_id,a.status
      from public.activity_events a where a.client_visible and a.client_id=v_client::text
       and a.action in ('campagne_publiee','photo_ajoutee','edt_termine','rapport_disponible','enjeu_ouvert','communication_publiee')
      order by a.occurred_at desc,a.id desc limit v_limit offset v_offset) q;
  elsif p_section='members' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select u.id,u.nom,u.courriel,u.role,u.statut,u.updated_at from public.utilisateurs u
      where u.client_id=v_client and u.role in ('Client','Client-Admin') order by u.nom,u.id limit v_limit offset v_offset) q;
  else
    declare v_tables text[];v_columns jsonb;v_sections jsonb:='{}';v_kpis jsonb:='{}';v_value bigint;v_identity jsonb;
begin
 SELECT array_agg(CASE WHEN t='*' THEN '*' ELSE public.dashboard_key(t) END) INTO v_tables FROM public.role_ui_permissions p CROSS JOIN LATERAL unnest(p.visible_tables)t WHERE p.role=v_role;
 SELECT visible_columns INTO v_columns FROM public.role_ui_permissions WHERE role=v_role;
 SELECT jsonb_build_object('user_id',u.auth_user_id,'profile_id',u.id,'name',u.nom,'role',u.role,'client_id',u.client_id,'organization_id',u.client_id,'client_name',c.nom_client) INTO v_identity FROM public.utilisateurs u JOIN public.clients c ON c.id=u.client_id WHERE u.auth_user_id=v_uid AND u.statut='Actif';
IF ('*'=any(v_tables) OR v_tables && ARRAY['infrastructures']) THEN
 SELECT (SELECT count(*) FROM public.infrastructures i WHERE i.client_id=v_client) INTO v_value;
 v_sections:=v_sections||jsonb_build_object('supports',jsonb_build_object('total',v_value));
SELECT count(*) INTO v_value FROM public.infrastructures i WHERE i.client_id=v_client AND public.dashboard_key(i.actif) NOT IN ('non','false','0','inactif','inactive');v_kpis:=v_kpis||jsonb_build_object('infrastructures_active',v_value);
END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['poster_directory','repertoire_des_affiches']) THEN
 SELECT (SELECT count(*) FROM (
      select distinct c.id campaign_id,c.nom_campagne,c.business_context,cs.support_id,cs.visuel_attendu visual,cs.statut,cs.no_edt
      from public.campagnes_supports cs join public.campagnes_maitres c on c.id=cs.campagne_id
      where c.client_id=v_client and c.client_published and cs.client_visible and public.client_can_access_campaign_v120(c.id)) dashboard_domain) INTO v_value;
 v_sections:=v_sections||jsonb_build_object('poster_directory',jsonb_build_object('total',v_value));
END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['information_centers','centres_d_information','centres_dinformation']) THEN
 SELECT (SELECT count(*) FROM (
      select i.site,i.type_site,count(*) nombre_de_cadres,max(i.date_derniere_manipulation) derniere_intervention
      from public.campagnes_supports cs join public.campagnes_maitres c on c.id=cs.campagne_id join public.infrastructures i on i.support_id=cs.support_id
      where c.client_id=v_client and c.client_published and cs.client_visible and public.client_can_access_campaign_v120(c.id) and coalesce(i.site,'')<>''
      group by i.site,i.type_site) dashboard_domain) INTO v_value;
 v_sections:=v_sections||jsonb_build_object('information_centers',jsonb_build_object('total',v_value));
END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['information_centers_issues','c_i_avec_enjeux','ci_avec_enjeux']) THEN
 SELECT (SELECT count(*) FROM (
      select distinct i.site,e.support_id,e.type_enjeu,e.description,e.statut,e.priorite,e.created_at
      from public.enjeux_terrain e join public.infrastructures i on i.support_id=e.support_id
      where e.client_visible and exists(select 1 from public.campagnes_supports cs join public.campagnes_maitres c on c.id=cs.campagne_id where cs.support_id=e.support_id and c.client_id=v_client and c.client_published and cs.client_visible and public.client_can_access_campaign_v120(c.id))) dashboard_domain) INTO v_value;
 v_sections:=v_sections||jsonb_build_object('information_centers_issues',jsonb_build_object('total',v_value));
END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['stops','liste_des_arrets']) THEN
 SELECT (SELECT count(*) FROM (
      select distinct i.support_id no_arret,i.emplacement_visibilite,i.type_support,i.site
      from public.campagnes_supports cs join public.campagnes_maitres c on c.id=cs.campagne_id join public.infrastructures i on i.support_id=cs.support_id
      where c.client_id=v_client and c.client_published and cs.client_visible and public.client_can_access_campaign_v120(c.id) and (i.type_site ilike '%arret%' or i.type_site ilike '%arrêt%' or i.support_id ilike 'A%')) dashboard_domain) INTO v_value;
 v_sections:=v_sections||jsonb_build_object('stops',jsonb_build_object('total',v_value));
END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['vehicles_trains','voitures_trains','voitures_et_trains']) THEN
 SELECT (SELECT count(*) FROM (
      select distinct i.support_id,i.site voiture_train,i.type_support,i.emplacement_visibilite
      from public.campagnes_supports cs join public.campagnes_maitres c on c.id=cs.campagne_id join public.infrastructures i on i.support_id=cs.support_id
      where c.client_id=v_client and c.client_published and cs.client_visible and public.client_can_access_campaign_v120(c.id) and (i.type_site ilike '%voiture%' or i.type_site ilike '%train%' or i.type_support ilike '%voiture%' or i.type_support ilike '%train%')) dashboard_domain) INTO v_value;
 v_sections:=v_sections||jsonb_build_object('vehicles_trains',jsonb_build_object('total',v_value));
END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['campaigns','campagnes','campagnes_et_visuels','campagnes_maitres']) THEN
 SELECT (SELECT count(*) FROM (
      select c.id,c.nom_campagne,c.business_context,c.date_debut,c.date_fin,c.statut
      from public.campagnes_maitres c where c.client_id=v_client and c.client_published
       and c.business_context=case when 'campaigns'='campaigns' then 'marketing' else 'operational_communication' end
       and (v_role='Client-Admin' or public.client_can_access_campaign_v120(c.id))) dashboard_domain) INTO v_value;
 v_sections:=v_sections||jsonb_build_object('campaigns',jsonb_build_object('total',v_value));
SELECT count(*) INTO v_value FROM public.campagnes_maitres c WHERE c.client_id=v_client AND c.client_published AND c.business_context='marketing' AND (v_role='Client-Admin' OR public.client_can_access_campaign_v120(c.id)) AND public.dashboard_key(c.statut) IN ('actif','active','en_cours','planifie','planifiee');v_kpis:=v_kpis||jsonb_build_object('marketing_active',v_value);
END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['reports','rapports','rapports_finaux','rapports_edt']) THEN
 SELECT (SELECT (public.module15_client_edt_reports_v130(1,1)->>'total')::bigint) INTO v_value;
 v_sections:=v_sections||jsonb_build_object('reports',jsonb_build_object('total',v_value));
END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['communications','communications_operationnelles']) THEN
 SELECT (SELECT count(*) FROM (
      select c.id,c.nom_campagne,c.business_context,c.date_debut,c.date_fin,c.statut
      from public.campagnes_maitres c where c.client_id=v_client and c.client_published
       and c.business_context=case when 'communications'='campaigns' then 'marketing' else 'operational_communication' end
       and (v_role='Client-Admin' or public.client_can_access_campaign_v120(c.id))) dashboard_domain) INTO v_value;
 v_sections:=v_sections||jsonb_build_object('communications',jsonb_build_object('total',v_value));
SELECT count(*) INTO v_value FROM public.campagnes_maitres c WHERE c.client_id=v_client AND c.client_published AND c.business_context='operational_communication' AND (v_role='Client-Admin' OR public.client_can_access_campaign_v120(c.id)) AND public.dashboard_key(c.statut) IN ('actif','active','en_cours','planifie','planifiee');v_kpis:=v_kpis||jsonb_build_object('operational_active',v_value);
END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['photos']) THEN
 SELECT (SELECT count(*) FROM public.support_photos p WHERE p.client_id=v_client AND p.client_visible AND p.deleted_at IS NULL) INTO v_value;
 v_sections:=v_sections||jsonb_build_object('photos',jsonb_build_object('total',v_value));
END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['edt','edt_progression','suivi_des_edt']) THEN
 SELECT (SELECT count(*) FROM (
      select e.id,e.no_edt,e.statut,e.date_debut_prevue,e.date_fin_prevue,e.rapport_final_envoye,e.rapport_final_path,e.campagne_id
      from public.suivi_des_edt e join public.campagnes_maitres c on c.id=e.campagne_id
      where e.client_id=v_client and c.client_id=v_client and c.client_published and e.client_visible and public.client_can_access_campaign_v120(c.id)) dashboard_domain) INTO v_value;
 v_sections:=v_sections||jsonb_build_object('edt',jsonb_build_object('total',v_value));
SELECT count(*) INTO v_value FROM public.suivi_des_edt e JOIN public.campagnes_maitres c ON c.id=e.campagne_id WHERE e.client_id=v_client AND c.client_id=v_client AND c.client_published AND e.client_visible AND public.client_can_access_campaign_v120(c.id) AND e.archived_at IS NULL AND public.dashboard_key(e.statut) NOT IN ('ferme','fermee','resolu','resolue','termine','terminee','complete','completee','annule','annulee','archive','archivee');v_kpis:=v_kpis||jsonb_build_object('edt_active',v_value);
END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['issues','enjeux','enjeux_des_cadres_et_supports']) THEN
 SELECT (SELECT count(*) FROM (
      select e.id,e.reference,e.support_id,e.type_enjeu,e.description,e.statut,e.priorite,e.created_at
      from public.enjeux_terrain e where e.client_id=v_client and e.client_visible and exists(select 1 from public.campagnes_supports cs join public.campagnes_maitres c on c.id=cs.campagne_id where cs.support_id=e.support_id and c.client_id=v_client and c.client_published and public.client_can_access_campaign_v120(c.id))) dashboard_domain) INTO v_value;
 v_sections:=v_sections||jsonb_build_object('issues',jsonb_build_object('total',v_value));
END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['history','historique','historique_des_campagnes']) THEN
 SELECT (SELECT count(*) FROM (
      select a.id,a.occurred_at,a.action,a.module,a.entity_type,a.entity_id,a.campaign_id,a.edt_id,a.support_id,a.status
      from public.activity_events a where a.client_visible and a.client_id=v_client::text
       and a.action in ('campagne_publiee','photo_ajoutee','edt_termine','rapport_disponible','enjeu_ouvert','communication_publiee')) dashboard_domain) INTO v_value;
 v_sections:=v_sections||jsonb_build_object('history',jsonb_build_object('total',v_value));
END IF;
RETURN jsonb_build_object('version',1,'identity',v_identity,'permission',jsonb_build_object('role',v_role,'client_id',v_client,'visible_tables',(SELECT visible_tables FROM public.role_ui_permissions WHERE role=v_role),'visible_columns',coalesce(v_columns,'{}')),'sections',v_sections,'kpis',v_kpis);
end;
  end if;
  return jsonb_build_object('section',p_section,'page',greatest(1,coalesce(p_page,1)),'page_size',v_limit,'total',v_total,'rows',v_rows);
END;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.portal_dashboard_summary() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE a public.utilisateurs%rowtype;v_tables text[];v_permission jsonb;v_kpis jsonb:='{}';v_part jsonb;v_identity jsonb;v_started timestamptz:=clock_timestamp();
BEGIN
 SELECT * INTO a FROM public.utilisateurs WHERE auth_user_id=auth.uid() AND lower(coalesce(statut,''))='actif';
 IF (auth.uid() IS NOT NULL AND a.id IS NOT NULL AND a.role IN ('Administrateur','Coordonnateur','Installateur','Client','Client-Admin')) IS NOT TRUE THEN RAISE EXCEPTION 'dashboard_profile_denied' USING ERRCODE='42501';END IF;
 IF (a.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients WHERE id=a.client_id)) OR (a.role IN ('Client','Client-Admin') AND a.client_id IS NULL) THEN RAISE EXCEPTION 'dashboard_client_denied' USING ERRCODE='42501';END IF;
 IF a.role IN ('Client','Client-Admin') THEN RETURN public.client_portal_list_v120('dashboard',1,1,'{}'); END IF;
 SELECT jsonb_build_object('role',a.role,'client_id',a.client_id,'visible_tables',visible_tables,'visible_columns',visible_columns) INTO v_permission FROM public.role_ui_permissions WHERE role=a.role;
 IF v_permission IS NULL THEN RAISE EXCEPTION 'dashboard_permissions_missing' USING ERRCODE='42501';END IF;
 SELECT array_agg(CASE WHEN t='*' THEN '*' ELSE public.dashboard_key(t) END) INTO v_tables FROM public.role_ui_permissions p CROSS JOIN LATERAL unnest(p.visible_tables)t WHERE p.role=a.role;
 SELECT jsonb_build_object('user_id',a.auth_user_id,'profile_id',a.id,'name',a.nom,'role',a.role,'client_id',a.client_id,'organization_id',a.client_id,'client_name',(SELECT nom_client FROM public.clients WHERE id=a.client_id)) INTO v_identity;
IF ('*'=any(v_tables) OR v_tables && ARRAY['infrastructures']) THEN
SELECT jsonb_build_object('infrastructures_total',count(*),'infrastructures_active',count(*) FILTER(WHERE public.dashboard_key(i.actif) NOT IN ('non','false','0','inactif','inactive')),'missing_photos',count(*) FILTER(WHERE coalesce(i.photo_principale_url,'')='' AND coalesce(i.photo_miniature_url,'')='' AND coalesce(i.visuel_actuel_cadre,'')='')) FROM public.infrastructures i INTO v_part;
v_kpis:=v_kpis||v_part;END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['campagnes_maitres','campagnes_et_visuels','campagnes']) THEN
SELECT jsonb_build_object('marketing_total',count(*),'marketing_active',count(*) FILTER(WHERE public.dashboard_key(c.statut) IN ('actif','active','en_cours','planifie','planifiee')),'marketing_soon',count(*) FILTER(WHERE c.date_fin BETWEEN current_date AND current_date+7)) FROM public.campagnes_maitres c WHERE c.business_context='marketing' INTO v_part;
v_kpis:=v_kpis||v_part;END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['campagnes_maitres','campagnes_et_visuels','campagnes']) THEN
SELECT jsonb_build_object('marketing_visuals',count(*) ) FROM public.campagne_visuels_formats v JOIN public.campagnes_maitres c ON c.id=v.campagne_id WHERE c.business_context='marketing' INTO v_part;
v_kpis:=v_kpis||v_part;END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['campagnes_maitres','campagnes_et_visuels','campagnes']) THEN
WITH current_assignments AS (SELECT coalesce(i.site,'') site,coalesce(cs.support_id,'') support,cs.campagne_id::text campaign,coalesce((SELECT min(v.id)::text FROM public.campagne_visuels_formats v WHERE v.campagne_id=c.id AND lower(trim(v.nom_visuel))=lower(trim(cs.visuel_attendu))),'') visual FROM public.campagnes_supports cs JOIN public.campagnes_maitres c ON c.id=cs.campagne_id LEFT JOIN public.infrastructures i ON i.support_id=cs.support_id WHERE c.business_context='marketing'), historical AS (SELECT to_jsonb(h) r FROM public.campagnes_visuels_sites_supports h WHERE h.business_context='marketing'), logical AS (SELECT * FROM current_assignments UNION SELECT coalesce(r->>'site_id',r->>'site',''),coalesce(r->>'support_id',''),coalesce(r->>'campaign_id',r->>'communication_id',r->>'campagne_id',''),coalesce(r->>'visual_id',r->>'visuel_id',r->>'nom_visuel',r->>'visuel_attendu','') FROM historical) SELECT jsonb_build_object('marketing_places',count(*)) FROM logical INTO v_part;
v_kpis:=v_kpis||v_part;END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['communications_operationnelles']) THEN
SELECT jsonb_build_object('operational_total',count(*),'operational_active',count(*) FILTER(WHERE public.dashboard_key(c.statut) IN ('actif','active','en_cours','planifie','planifiee')),'operational_soon',count(*) FILTER(WHERE c.date_fin BETWEEN current_date AND current_date+7)) FROM public.campagnes_maitres c WHERE c.business_context='operational_communication' INTO v_part;
v_kpis:=v_kpis||v_part;END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['communications_operationnelles']) THEN
SELECT jsonb_build_object('operational_visuals',count(*) FILTER(WHERE v.actif IS DISTINCT FROM false)) FROM public.campagne_visuels_formats v JOIN public.campagnes_maitres c ON c.id=v.campagne_id WHERE c.business_context='operational_communication' INTO v_part;
v_kpis:=v_kpis||v_part;END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['communications_operationnelles']) THEN
WITH current_assignments AS (SELECT coalesce(i.site,'') site,coalesce(cs.support_id,'') support,cs.campagne_id::text campaign,coalesce((SELECT min(v.id)::text FROM public.campagne_visuels_formats v WHERE v.campagne_id=c.id AND lower(trim(v.nom_visuel))=lower(trim(cs.visuel_attendu))),'') visual FROM public.campagnes_supports cs JOIN public.campagnes_maitres c ON c.id=cs.campagne_id LEFT JOIN public.infrastructures i ON i.support_id=cs.support_id WHERE c.business_context='operational_communication'), historical AS (SELECT to_jsonb(h) r FROM public.communications_operationnelles_sites_supports h WHERE h.business_context='operational_communication'), logical AS (SELECT * FROM current_assignments UNION SELECT coalesce(r->>'site_id',r->>'site',''),coalesce(r->>'support_id',''),coalesce(r->>'campaign_id',r->>'communication_id',r->>'campagne_id',''),coalesce(r->>'visual_id',r->>'visuel_id',r->>'nom_visuel',r->>'visuel_attendu','') FROM historical) SELECT jsonb_build_object('operational_places',count(*)) FROM logical INTO v_part;
v_kpis:=v_kpis||v_part;END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['suivi_des_edt']) THEN
SELECT jsonb_build_object('edt_active',count(*) FILTER(WHERE e.archived_at IS NULL AND public.dashboard_key(e.statut) NOT IN ('ferme','fermee','resolu','resolue','termine','terminee','complete','completee','annule','annulee','archive','archivee')),'edt_late',count(*) FILTER(WHERE e.archived_at IS NULL AND public.dashboard_key(e.statut) NOT IN ('ferme','fermee','resolu','resolue','termine','terminee','complete','completee','annule','annulee','archive','archivee') AND e.date_fin_prevue ~ '^\d{4}-\d{2}-\d{2}' AND left(e.date_fin_prevue,10)<current_date::text)) FROM public.suivi_des_edt e INTO v_part;
v_kpis:=v_kpis||v_part;END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['photos','photos_et_inventaire']) THEN
SELECT jsonb_build_object('photos',count(*)) FROM public.support_photos WHERE deleted_at IS NULL INTO v_part;
v_kpis:=v_kpis||v_part;END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['clients']) THEN
SELECT jsonb_build_object('clients',count(*)) FROM public.clients INTO v_part;
v_kpis:=v_kpis||v_part;END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['bons_de_travail']) THEN
SELECT jsonb_build_object('work_orders',count(*),'urgent_work_orders',count(*) FILTER(WHERE public.dashboard_key(statut) NOT IN ('ferme','fermee','resolu','resolue','termine','terminee','complete','completee','annule','annulee','archive','archivee') AND public.dashboard_key(priorite) LIKE '%urgent%')) FROM public.bons_de_travail INTO v_part;
v_kpis:=v_kpis||v_part;END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['enjeux_des_cadres_et_supports']) THEN
WITH historical AS (SELECT to_jsonb(e) r FROM public.enjeux_des_cadres_et_supports e),terrain AS (SELECT to_jsonb(e) r FROM public.enjeux_terrain e), merged AS (SELECT lower(coalesce(nullif(trim(r->>'related_support'),''),nullif(trim(r->>'no_cadre'),''),nullif(trim(r->>'Related Support'),''),nullif(trim(r->>'#Du cadre'),''),'')) f0,lower(coalesce(nullif(trim(r->>'emplacement'),''),nullif(trim(r->>'Emplacement'),''),'')) f1,lower(coalesce(nullif(trim(r->>'type_enjeu'),''),nullif(trim(r->>'type_enjeux'),''),nullif(trim(r->>'Type d''enjeux'),''),'')) f2,lower(coalesce(nullif(trim(r->>'description'),''),nullif(trim(r->>'enjeux'),''),nullif(trim(r->>'Enjeux'),''),'')) f3,lower(coalesce(nullif(trim(r->>'statut'),''),nullif(trim(r->>'Statut'),''),'')) f4,lower(coalesce(nullif(trim(r->>'commentaire'),''),nullif(trim(r->>'Commentaire'),''),'')) f5,lower(coalesce(nullif(trim(r->>'photo'),''),nullif(trim(r->>'photo_url'),''),'')) f6,lower(coalesce(nullif(trim(r->>'date_inscription'),''),nullif(trim(r->>'Date d''inscription de l''enjeux'),''),nullif(trim(r->>'created_at'),''),nullif(trim(r->>'Date Created'),''),'')) f7,lower(coalesce(nullif(trim(r->>'client'),''),nullif(trim(r->>'client_id'),''),'')) f8 FROM historical UNION SELECT lower(coalesce(nullif(trim(r->>'support_id'),''),'')) f0,lower(coalesce(nullif(trim(r->>'emplacement'),''),'')) f1,lower(coalesce(nullif(trim(r->>'type_enjeu'),''),nullif(trim(r->>'type_enjeux'),''),'')) f2,lower(coalesce(nullif(trim(r->>'description'),''),nullif(trim(r->>'enjeux'),''),nullif(trim(r->>'type_enjeu'),''),'')) f3,lower(coalesce(nullif(trim(r->>'statut'),''),'')) f4,lower(coalesce(nullif(trim(r->>'commentaire'),''),nullif(trim(r->>'commentaires'),''),'')) f5,lower(coalesce(nullif(trim(r->>'photo_url'),''),nullif(trim(r->>'photo_id'),''),'')) f6,lower(coalesce(nullif(trim(r->>'created_at'),''),nullif(trim(r->>'date_inscription'),''),'')) f7,lower(coalesce(nullif(trim(r->>'client'),''),nullif(trim(r->>'client_id'),''),'')) f8 FROM terrain) SELECT jsonb_build_object('issues_open',count(*) FILTER(WHERE public.dashboard_key(f4) NOT IN ('ferme','fermee','resolu','resolue','termine','terminee','complete','completee','annule','annulee','archive','archivee'))) FROM merged INTO v_part;
v_kpis:=v_kpis||v_part;END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['diagnostic_terrain','application_terrain']) THEN
SELECT jsonb_build_object('terrain',count(*),'terrain_errors',count(*) FILTER(WHERE public.dashboard_key(statut) IN ('echec','echouee','error','erreur','failed') AND resolved_at IS NULL)) FROM public.terrain_sync_history_v113 INTO v_part;
v_kpis:=v_kpis||v_part;END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['rapports','rapports_edt','rapports_finaux']) THEN
WITH tracking AS (SELECT r.id,r.status report_status,o.status delivery_status FROM public.suivi_des_edt e LEFT JOIN LATERAL(SELECT r.id,r.status FROM public.edt_reports r WHERE r.edt_id=e.id AND r.status<>'deleted' ORDER BY r.report_version DESC LIMIT 1)r ON true LEFT JOIN LATERAL(SELECT o.status FROM public.email_outbox o WHERE o.edt_id=e.id AND r.id IS NOT NULL AND (o.report_id=r.id OR(o.report_id IS NULL AND o.report_version IS NULL)) ORDER BY o.created_at DESC LIMIT 1)o ON true WHERE e.statut='Complété') SELECT jsonb_build_object('reports',count(id),'reports_completed',count(*),'reports_sent',count(*) FILTER(WHERE delivery_status='sent'),'reports_to_send',count(*) FILTER(WHERE delivery_status IS NULL OR delivery_status IN ('pending','sending')),'reports_errors',count(*) FILTER(WHERE report_status='error' OR delivery_status='failed')) FROM tracking INTO v_part;
v_kpis:=v_kpis||v_part;END IF;
RETURN jsonb_build_object('version',1,'identity',v_identity,'permission',v_permission,'kpis',v_kpis,'sections','{}'::jsonb,'server_ms',extract(epoch FROM clock_timestamp()-v_started)*1000);
END $$;
REVOKE ALL ON FUNCTION public.portal_dashboard_summary() FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.portal_dashboard_summary() TO authenticated;
