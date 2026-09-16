-- Additive migration: originals and internal audit identities stay canonical.
CREATE SCHEMA IF NOT EXISTS tdm_private;
REVOKE ALL ON SCHEMA tdm_private FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.photo_client_redact(value jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE result jsonb;entry record;
BEGIN
 IF value IS NULL THEN RETURN NULL;END IF;
 IF jsonb_typeof(value)='object' THEN
  result:='{}';
  FOR entry IN SELECT * FROM jsonb_each(value) LOOP
   IF lower(entry.key) ~ '(email|courriel)' OR lower(entry.key) IN ('utilisateur','uploaded_by','author','auteur') THEN CONTINUE;END IF;
   result:=result||jsonb_build_object(entry.key,public.photo_client_redact(entry.value));
  END LOOP;RETURN result;
 ELSIF jsonb_typeof(value)='array' THEN
  SELECT coalesce(jsonb_agg(public.photo_client_redact(e)),'[]') INTO result FROM jsonb_array_elements(value)e;RETURN result;
 ELSIF jsonb_typeof(value)='string' THEN
  RETURN to_jsonb(regexp_replace(value#>>'{}','[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}','[courriel masqué]','g'));
 END IF;RETURN value;
END $$;
CREATE FUNCTION public.photo_visible_json(value jsonb) RETURNS jsonb
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT CASE WHEN public.tos_current_role() IN ('Client','Client-Admin') THEN public.photo_client_redact(value) ELSE value END
$$;
REVOKE ALL ON FUNCTION public.photo_client_redact(jsonb),public.photo_visible_json(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.photo_client_redact(jsonb),public.photo_visible_json(jsonb) TO authenticated;

-- Reuse the existing SELECT policy expressions, including all restrictive
-- scope policies. A definer projection is necessary to omit personal columns
-- while retaining the unchanged canonical rows for internal audit.
CREATE FUNCTION tdm_private.photo_read_predicate(p_table text) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE permissive text;restrictive text;relation regclass;
BEGIN
 relation:=to_regclass(format('public.%I',p_table));
 SELECT string_agg('('||coalesce(pg_get_expr(p.polqual,p.polrelid),'true')||')',' OR ') FILTER(WHERE p.polpermissive),
 string_agg('('||coalesce(pg_get_expr(p.polqual,p.polrelid),'true')||')',' AND ') FILTER(WHERE NOT p.polpermissive)
 INTO permissive,restrictive FROM pg_policy p
 WHERE p.polrelid=relation AND p.polcmd IN ('r','*') AND p.polname<>'photo_private_client_projection'
 AND (0::oid=ANY(p.polroles) OR 'authenticated'::regrole::oid=ANY(p.polroles));
 RETURN '('||coalesce(permissive,'false')||') AND ('||coalesce(restrictive,'true')||')';
END $$;
REVOKE ALL ON FUNCTION tdm_private.photo_read_predicate(text) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.photo_inventory_read(p_table text DEFAULT 'support_photos',p_filters jsonb DEFAULT '{}',p_offset integer DEFAULT 0,p_limit integer DEFAULT 500)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE predicate text;rows jsonb;total bigint;field text;filter record;ordering text:='id';
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.utilisateurs WHERE auth_user_id=auth.uid() AND statut='Actif' AND role IS NOT NULL) THEN RAISE EXCEPTION 'photo_read_denied' USING ERRCODE='42501';END IF;
 IF p_table<>ALL(ARRAY['support_photos','photos','historique_des_campagnes','inspections_terrain','inspections','enjeux_terrain','photo_action_log','activity_events','operations_history','terrain_operations','edt_reports','edt_phase_reports','communications_finales']) THEN RAISE EXCEPTION 'photo_read_table_denied' USING ERRCODE='42501';END IF;
 predicate:=tdm_private.photo_read_predicate(p_table);
 IF p_table='activity_events' AND coalesce(p_filters->>'recent','false')='true' THEN
  predicate:=predicate||' AND action NOT ILIKE ALL(ARRAY[''%initialisation%'',''%démarrage système%'',''%migration%'',''%chargement supabase%'',''%diagnostic technique%'',''%log développeur%''])';
 END IF;
 IF p_table='activity_events' THEN ordering:='occurred_at DESC,id DESC';END IF;
 FOR filter IN SELECT * FROM jsonb_each(p_filters) LOOP
  IF p_table='activity_events' AND filter.key='actor_email' AND public.tos_current_role() NOT IN ('Client','Client-Admin') THEN predicate:=predicate||format(' AND actor_email=%L',filter.value#>>'{}');CONTINUE;END IF;
  IF p_table='activity_events' AND filter.key='recent' THEN CONTINUE;END IF;
  IF p_table='activity_events' AND filter.key IN ('date_from','date_to') THEN
   predicate:=predicate||format(' AND occurred_at %s %L::timestamptz',CASE WHEN filter.key='date_from' THEN '>=' ELSE '<=' END,(filter.value#>>'{}')||CASE WHEN filter.key='date_from' THEN 'T00:00:00' ELSE 'T23:59:59.999' END);CONTINUE;
  END IF;
  IF p_table='activity_events' AND filter.key='query' THEN
   predicate:=predicate||format(' AND concat_ws('' '',action,entity_id,support_id,CASE WHEN public.tos_current_role() NOT IN (''Client'',''Client-Admin'') THEN actor_email END) ILIKE %L','%'||(filter.value#>>'{}')||'%');CONTINUE;
  END IF;
  IF filter.key<>ALL(ARRAY['id','support_id','edt_id','campagne_id','deleted_at','import_batch_id','review_status','entity_type','entity_id','module','action','actor_role','campaign_id','status','source_system','client_id']) THEN RAISE EXCEPTION 'photo_read_filter_denied';END IF;
  field:=format('to_jsonb(%I)->>%L',p_table,filter.key);
  IF filter.value='null'::jsonb THEN predicate:=predicate||' AND '||field||' IS NULL';
  ELSIF jsonb_typeof(filter.value)='array' THEN predicate:=predicate||format(' AND %s IN (SELECT jsonb_array_elements_text(%L::jsonb))',field,filter.value::text);
  ELSE predicate:=predicate||format(' AND %s=%L',field,filter.value#>>'{}');END IF;
 END LOOP;
 EXECUTE format('SELECT count(*) FROM public.%I WHERE %s',p_table,predicate) INTO total;
 EXECUTE format('SELECT coalesce(jsonb_agg(public.photo_visible_json(to_jsonb(r))),''[]'') FROM (SELECT * FROM public.%I WHERE %s ORDER BY %s LIMIT $1 OFFSET $2) r',p_table,predicate,ordering)
 INTO rows USING least(1000,greatest(1,coalesce(p_limit,500))),greatest(0,coalesce(p_offset,0));
 RETURN jsonb_build_object('rows',rows,'total',total);
END $$;
REVOKE ALL ON FUNCTION public.photo_inventory_read(text,jsonb,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.photo_inventory_read(text,jsonb,integer,integer) TO authenticated;

DO $$DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['support_photos','photos','historique_des_campagnes','inspections_terrain','inspections','enjeux_terrain','photo_action_log','activity_events','operations_history','terrain_operations','edt_reports','edt_phase_reports','communications_finales'] LOOP
  IF to_regclass(format('public.%I',t)) IS NOT NULL THEN
   EXECUTE format('CREATE POLICY photo_private_client_projection ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_current_role() NOT IN (''Client'',''Client-Admin''))',t);
  END IF;
 END LOOP;
END $$;




-- Generated compatibility projections from audited definitions.

CREATE OR REPLACE FUNCTION public.admin_preview_client_portal_section_v1361(p_target_user_id bigint, p_section text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 25)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_admin uuid:=auth.uid();v_target public.utilisateurs%rowtype;v_client bigint;v_role text;v_offset integer;v_limit integer;v_rows jsonb:='[]';v_total bigint:=0;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.utilisateurs sec_user WHERE sec_user.id=p_target_user_id AND public.tos_table_resource_scope(sec_user.client_id,NULL,NULL,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'target_user_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

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

  RETURN CASE WHEN p_section='members' THEN (jsonb_build_object('section',p_section,'page',greatest(1,coalesce(p_page,1)),'page_size',v_limit,'total',v_total,'rows',v_rows)) ELSE public.photo_client_redact(jsonb_build_object('section',p_section,'page',greatest(1,coalesce(p_page,1)),'page_size',v_limit,'total',v_total,'rows',v_rows)) END;
END;
END;
$function$
;

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
RETURN CASE WHEN p_section='members' THEN (jsonb_build_object('version',1,'identity',v_identity,'permission',jsonb_build_object('role',v_role,'client_id',v_client,'visible_tables',(SELECT visible_tables FROM public.role_ui_permissions WHERE role=v_role),'visible_columns',coalesce(v_columns,'{}')),'sections',v_sections,'kpis',v_kpis)) ELSE public.photo_visible_json(jsonb_build_object('version',1,'identity',v_identity,'permission',jsonb_build_object('role',v_role,'client_id',v_client,'visible_tables',(SELECT visible_tables FROM public.role_ui_permissions WHERE role=v_role),'visible_columns',coalesce(v_columns,'{}')),'sections',v_sections,'kpis',v_kpis)) END;
end;
  end if;
  RETURN CASE WHEN p_section='members' THEN (jsonb_build_object('section',p_section,'page',greatest(1,coalesce(p_page,1)),'page_size',v_limit,'total',v_total,'rows',v_rows)) ELSE public.photo_visible_json(jsonb_build_object('section',p_section,'page',greatest(1,coalesce(p_page,1)),'page_size',v_limit,'total',v_total,'rows',v_rows)) END;
END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.client_portal_list_v1361(p_section text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 25, p_filters jsonb DEFAULT '{}'::jsonb)
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

  RETURN CASE WHEN p_section='members' THEN (jsonb_build_object('section',p_section,'page',greatest(1,coalesce(p_page,1)),'page_size',v_limit,'total',v_total,'rows',v_rows)) ELSE public.photo_visible_json(jsonb_build_object('section',p_section,'page',greatest(1,coalesce(p_page,1)),'page_size',v_limit,'total',v_total,'rows',v_rows)) END;
END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.client_portal_list_v1362(p_section text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 25, p_filters jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=auth.uid();v_client bigint;v_role text;v_limit integer;v_offset integer;v_total bigint;v_rows jsonb;v_search text:=trim(coalesce(p_filters->>'search',''));
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Client','Client-Admin')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.utilisateurs sec_actor JOIN public.clients sec_client ON sec_client.id=sec_actor.client_id WHERE sec_actor.auth_user_id=auth.uid() AND lower(coalesce(sec_actor.statut,''))='actif')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_client_required' USING ERRCODE='42501';END IF;

BEGIN

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
 else RETURN CASE WHEN p_section='members' THEN (public.client_portal_list_v1361(p_section,p_page,p_page_size,p_filters)) ELSE public.photo_visible_json(public.client_portal_list_v1361(p_section,p_page,p_page_size,p_filters)) END;end if;
 RETURN CASE WHEN p_section='members' THEN (jsonb_build_object('section',p_section,'page',greatest(1,coalesce(p_page,1)),'page_size',v_limit,'total',v_total,'rows',v_rows,'client_id',v_client,'role',v_role)) ELSE public.photo_visible_json(jsonb_build_object('section',p_section,'page',greatest(1,coalesce(p_page,1)),'page_size',v_limit,'total',v_total,'rows',v_rows,'client_id',v_client,'role',v_role)) END;
END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.client_portal_support_context_v139(p_section text, p_support_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=auth.uid();v_client bigint;v_support text:=btrim(p_support_id);v_rows jsonb:='[]';
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Client','Client-Admin')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.utilisateurs sec_actor JOIN public.clients sec_client ON sec_client.id=sec_actor.client_id WHERE sec_actor.auth_user_id=auth.uid() AND lower(coalesce(sec_actor.statut,''))='actif')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_client_required' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,p_support_id,NULL,NULL,false)) IS NOT TRUE THEN RAISE EXCEPTION 'support_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

 if v_uid is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='42501';end if;
 select client_id into v_client from public.utilisateurs where auth_user_id=v_uid and statut='Actif' and role in('Client','Client-Admin');
 if v_client is null then raise exception 'CLIENT_SCOPE_MISSING' using errcode='42501';end if;
 if not exists(select 1 from public.infrastructures where support_id=v_support and client_id=v_client) then raise exception 'SUPPORT_SCOPE_DENIED' using errcode='42501';end if;
 if p_section='photos' then
  select coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_rows from(select p.id,p.support_id,p.type_photo,p.nom_fichier,p.storage_bucket,p.storage_path,p.thumbnail_url,p.prise_le,p.statut_validation from public.support_photos p where p.support_id=v_support and p.client_id=v_client and p.client_visible and p.deleted_at is null order by p.prise_le desc nulls last,p.id desc)q;
 elsif p_section='edt' then
  select coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_rows from(select distinct e.id,e.no_edt,e.statut,e.date_debut_prevue,e.date_fin_prevue,e.campagne_id from public.suivi_des_edt e join public.edt_supports es on es.edt_id=e.id join public.campagnes_maitres c on c.id=e.campagne_id where es.support_id=v_support and c.client_id=v_client and c.client_published and e.client_visible order by e.date_fin_prevue desc nulls last,e.id desc)q;
 elsif p_section='history' then
  select coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_rows from(select a.id,a.occurred_at,a.action,a.module,a.entity_type,a.entity_id,a.campaign_id,a.edt_id,a.support_id,a.status from public.activity_events a where a.client_id=v_client::text and a.client_visible and(a.support_id=v_support or exists(select 1 from public.edt_supports es where es.edt_id::text=a.edt_id and es.support_id=v_support))order by a.occurred_at desc,a.id desc)q;
 else raise exception 'INVALID_SUPPORT_SECTION';end if;
 RETURN CASE WHEN p_section='members' THEN (jsonb_build_object('section',p_section,'page',1,'page_size',jsonb_array_length(v_rows),'total',jsonb_array_length(v_rows),'rows',v_rows,'support_id',v_support)) ELSE public.photo_visible_json(jsonb_build_object('section',p_section,'page',1,'page_size',jsonb_array_length(v_rows),'total',jsonb_array_length(v_rows),'rows',v_rows,'support_id',v_support)) END;
END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.module15_client_edt_reports_v130(p_page integer DEFAULT 1, p_page_size integer DEFAULT 25)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_client bigint;v_limit integer:=least(greatest(coalesce(p_page_size,25),1),100);v_offset integer:=(greatest(coalesce(p_page,1),1)-1)*v_limit;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Client','Client-Admin')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.utilisateurs sec_actor JOIN public.clients sec_client ON sec_client.id=sec_actor.client_id WHERE sec_actor.auth_user_id=auth.uid() AND lower(coalesce(sec_actor.statut,''))='actif')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_client_required' USING ERRCODE='42501';END IF;

BEGIN

 select client_id into v_client from public.utilisateurs where auth_user_id=auth.uid() and statut='Actif' and role in ('Client','Client-Admin') limit 1;
 if v_client is null then raise exception 'client_scope_denied' using errcode='42501'; end if;
 RETURN public.photo_visible_json(jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(q)) from (
   select r.id,r.edt_id,e.no_edt,r.report_version,r.status,r.report_path,r.generated_at
   from public.edt_reports r join public.suivi_des_edt e on e.id=r.edt_id join public.campagnes_maitres c on c.id=e.campagne_id
   where e.client_id=v_client and c.client_id=v_client and c.client_published and e.client_visible and r.client_visible and r.status='ready'
     and public.client_can_access_campaign_v120(c.id)
   order by r.generated_at desc limit v_limit offset v_offset)q),'[]'::jsonb),
   'total',(select count(*) from public.edt_reports r join public.suivi_des_edt e on e.id=r.edt_id join public.campagnes_maitres c on c.id=e.campagne_id where e.client_id=v_client and c.client_id=v_client and c.client_published and e.client_visible and r.client_visible and r.status='ready' and public.client_can_access_campaign_v120(c.id)),
   'page',greatest(coalesce(p_page,1),1),'page_size',v_limit));
END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.module15_client_reports_v130(p_page integer DEFAULT 1, p_page_size integer DEFAULT 25)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_client bigint;v_role text;v_limit integer:=least(greatest(coalesce(p_page_size,25),1),100);v_offset integer:=(greatest(coalesce(p_page,1),1)-1)*v_limit;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Client','Client-Admin')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.utilisateurs sec_actor JOIN public.clients sec_client ON sec_client.id=sec_actor.client_id WHERE sec_actor.auth_user_id=auth.uid() AND lower(coalesce(sec_actor.statut,''))='actif')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_client_required' USING ERRCODE='42501';END IF;

BEGIN

 select client_id,role into v_client,v_role from public.utilisateurs where auth_user_id=auth.uid() and statut='Actif' and role in ('Client','Client-Admin') limit 1;
 if v_client is null then raise exception 'Accès refusé'; end if;
 RETURN public.photo_visible_json(jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(q)) from (select id,report_type,title,campaign_id,communication_id,site,support_id,no_edt,period_start,period_end,status,published_at,template_key,version,metadata from public.reports where client_id=v_client and status='published' and client_published and (campaign_id is null or public.client_can_access_campaign_v120(campaign_id)) and (communication_id is null or public.client_can_access_campaign_v120(communication_id)) order by published_at desc limit v_limit offset v_offset)q),'[]'::jsonb),'total',(select count(*) from public.reports where client_id=v_client and status='published' and client_published and (campaign_id is null or public.client_can_access_campaign_v120(campaign_id)) and (communication_id is null or public.client_can_access_campaign_v120(communication_id))),'page',greatest(coalesce(p_page,1),1),'page_size',v_limit));
END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.portal_business_context(p_kind text, p_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE r jsonb; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'context_denied' USING ERRCODE='42501';END IF;
 IF p_kind='operations' THEN
  IF NOT public.portal_view_allowed('Suivi des EDT') THEN RAISE EXCEPTION 'context_denied' USING ERRCODE='42501';END IF;
  RETURN public.photo_visible_json(jsonb_build_object(
   'edts',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM public.suivi_des_edt WHERE archived_at IS NULL ORDER BY date_debut DESC NULLS LAST)x),
   'workOrders',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM public.bons_de_travail ORDER BY date_cible NULLS LAST)x),
   'requests',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM public.requetes_clients ORDER BY created_at DESC)x),
   'phases',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM public.edt_phases ORDER BY ordre)x),
   'assignments',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM public.edt_assignments ORDER BY created_at DESC)x),
   'history',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM (SELECT (jsonb_populate_record(NULL::public.operations_history,item)).* FROM jsonb_array_elements(public.photo_inventory_read('operations_history',CASE WHEN p_kind='support' THEN jsonb_build_object('support_id',p_id) ELSE '{}'::jsonb END,0,1000)->'rows') item) operations_history ORDER BY created_at DESC LIMIT 500)x),
   'users',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT id,nom,courriel,role,statut FROM public.utilisateurs ORDER BY nom)x),
   'edtSupports',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM public.edt_supports ORDER BY updated_at DESC)x),
   'campaigns',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT id,code_campagne,nom_campagne,date_debut,date_fin,statut FROM public.campagnes_maitres ORDER BY date_fin DESC NULLS LAST)x),
   'phaseReports',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM (SELECT (jsonb_populate_record(NULL::public.edt_phase_reports,item)).* FROM jsonb_array_elements(public.photo_inventory_read('edt_phase_reports',CASE WHEN p_kind='support' THEN jsonb_build_object('support_id',p_id) ELSE '{}'::jsonb END,0,1000)->'rows') item) edt_phase_reports ORDER BY version DESC)x),
   'dashboard',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT e.id edt_id,e.no_edt,e.nom,e.statut,public.tdm_try_date(e.date_fin_prevue::text) date_fin_prevue,coalesce(e.supports_prevus,0)::integer total,coalesce(e.supports_planifies,0)::integer planifies,coalesce(e.supports_en_cours,0)::integer en_cours,coalesce(e.supports_bloques,0)::integer bloques,coalesce(e.supports_termines,0)::integer termines,coalesce(e.progression,0)::integer progression,(public.tdm_try_date(e.date_fin_prevue::text)<current_date AND coalesce(e.progression,0)<100) en_retard FROM public.suivi_des_edt e ORDER BY public.tdm_try_date(e.date_fin_prevue::text) NULLS LAST,e.id DESC)x)
  ));
 ELSIF p_kind='support' THEN
  IF NOT public.portal_view_allowed('Infrastructures') OR NOT EXISTS(SELECT 1 FROM public.infrastructures WHERE support_id=p_id) THEN RAISE EXCEPTION 'support_context_denied' USING ERRCODE='42501';END IF;
  RETURN public.photo_visible_json(jsonb_build_object(
   'photos',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM (SELECT (jsonb_populate_record(NULL::public.support_photos,item)).* FROM jsonb_array_elements(public.photo_inventory_read('support_photos',CASE WHEN p_kind='support' THEN jsonb_build_object('support_id',p_id) ELSE '{}'::jsonb END,0,1000)->'rows') item) support_photos WHERE support_id=p_id AND deleted_at IS NULL LIMIT 500)x),
   'history',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM (SELECT (jsonb_populate_record(NULL::public.historique_des_campagnes,item)).* FROM jsonb_array_elements(public.photo_inventory_read('historique_des_campagnes',CASE WHEN p_kind='support' THEN jsonb_build_object('support_id',p_id) ELSE '{}'::jsonb END,0,1000)->'rows') item) historique_des_campagnes WHERE support_id=p_id LIMIT 500)x),
   'issues',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM (SELECT (jsonb_populate_record(NULL::public.enjeux_terrain,item)).* FROM jsonb_array_elements(public.photo_inventory_read('enjeux_terrain',CASE WHEN p_kind='support' THEN jsonb_build_object('support_id',p_id) ELSE '{}'::jsonb END,0,1000)->'rows') item) enjeux_terrain WHERE support_id=p_id LIMIT 500)x),
   'inspections',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM (SELECT (jsonb_populate_record(NULL::public.inspections_terrain,item)).* FROM jsonb_array_elements(public.photo_inventory_read('inspections_terrain',CASE WHEN p_kind='support' THEN jsonb_build_object('support_id',p_id) ELSE '{}'::jsonb END,0,1000)->'rows') item) inspections_terrain WHERE support_id=p_id LIMIT 500)x),
   'workOrders',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM public.bons_de_travail WHERE support_id=p_id LIMIT 500)x),
   'edtLinks',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM public.edt_supports WHERE support_id=p_id LIMIT 500)x),
   'logs',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM (SELECT (jsonb_populate_record(NULL::public.photo_action_log,item)).* FROM jsonb_array_elements(public.photo_inventory_read('photo_action_log',CASE WHEN p_kind='support' THEN jsonb_build_object('support_id',p_id) ELSE '{}'::jsonb END,0,1000)->'rows') item) photo_action_log WHERE support_id=p_id LIMIT 500)x)
  ));
 END IF;
 RAISE EXCEPTION 'context_kind_denied' USING ERRCODE='42501';
END $function$
;

CREATE OR REPLACE FUNCTION public.portal_business_rows(p_view text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 1000)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE t text:=public.portal_business_view(p_view);n bigint;rows jsonb;predicate text:='true'; BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR NOT public.portal_view_allowed(p_view) THEN RAISE EXCEPTION 'business_view_denied' USING ERRCODE='42501';END IF;
 IF t=ANY(ARRAY['support_photos','photos','historique_des_campagnes','inspections_terrain','inspections','enjeux_terrain','photo_action_log','activity_events','operations_history','terrain_operations','edt_reports','edt_phase_reports','communications_finales']) THEN RETURN public.photo_visible_json(public.photo_inventory_read(t,'{}',p_offset,p_limit));END IF;
 IF t='campagnes_maitres' THEN predicate:=format('business_context=%L',CASE WHEN public.dashboard_key(p_view)='communications_operationnelles' THEN 'operational_communication' ELSE 'marketing' END);END IF;
 IF public.tos_current_role() IN ('Client','Client-Admin') THEN predicate:=predicate||format(' AND (client_id IS NULL OR client_id=%L)',(SELECT u.client_id FROM public.utilisateurs u WHERE u.auth_user_id=auth.uid() AND u.statut='Actif'));END IF;
 EXECUTE format('SELECT count(*) FROM public.%I WHERE %s',t,predicate) INTO n;
 EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) FROM (SELECT * FROM public.%I WHERE %s ORDER BY id LIMIT $1 OFFSET $2) r',t,predicate) INTO rows USING least(1000,greatest(1,p_limit)),greatest(0,p_offset);
 RETURN public.photo_visible_json(jsonb_build_object('rows',rows,'total',n));
END $function$
;

CREATE OR REPLACE FUNCTION public.source_rapport_phase_v133(p_phase_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.edt_phases%rowtype;e public.suivi_des_edt%rowtype;c public.campagnes_maitres%rowtype;
BEGIN

IF NOT EXISTS(SELECT 1 FROM public.utilisateurs a WHERE a.auth_user_id=auth.uid() AND lower(coalesce(a.statut,''))='actif' AND (a.client_id IS NOT NULL OR a.role='Administrateur')) THEN RAISE EXCEPTION 'report_client_required' USING ERRCODE='42501';END IF;
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur','Installateur','Client','Client-Admin')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.edt_phases sec_phase JOIN public.suivi_des_edt sec_edt ON sec_edt.id=sec_phase.edt_id WHERE sec_phase.id=p_phase_id AND (sec_phase.client_id IS NULL OR sec_phase.client_id=sec_edt.client_id) AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'phase_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

 select * into p from public.edt_phases where id=p_phase_id;if not found then raise exception 'phase_not_found';end if;
 select * into e from public.suivi_des_edt where id=p.edt_id;select * into c from public.campagnes_maitres where id=e.campagne_id;
 if public.current_app_role() in ('Client','Client-Admin') and not public.client_can_access_campaign_v120(c.id) then raise exception 'phase_client_scope_denied' using errcode='42501';end if;
 RETURN public.photo_visible_json(jsonb_build_object('phase_id',p.id,'edt_id',e.id,'no_edt',e.no_edt,'phase_type',p.phase_type,'intervention_type',case p.phase_type when 'installation' then 'Installation' else 'Retrait' end,'status',p.statut,'scheduled_date',p.date_debut_prevue,'supports',(select coalesce(jsonb_agg(jsonb_build_object('assignment_id',s.id,'support_id',s.support_id,'status',s.statut) order by s.support_id),'[]') from public.edt_supports s where s.phase_id=p.id AND public.tos_table_resource_scope(NULL,s.support_id,NULL,s.edt_id,false)),'reports',(select coalesce(jsonb_agg(to_jsonb(r) order by r.version desc),'[]') from public.edt_phase_reports r where r.phase_id=p.id AND (public.tos_current_role() IN ('Administrateur','Coordonnateur','Installateur') OR (r.client_visible AND NOT coalesce(r.archived,false))))));
END;
END;
$function$
;

CREATE FUNCTION public.photo_client_file_allowed(p_bucket text,p_path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Client','Client-Admin')
 AND public.portal_view_allowed('Photos et inventaire') AND EXISTS(
 SELECT 1 FROM public.support_photos p WHERE p.storage_bucket=p_bucket AND p.storage_path=p_path AND p.deleted_at IS NULL
 AND public.tos_table_resource_scope(p.client_id,p.support_id,p.campagne_id,CASE WHEN p.edt_id ~ '^[0-9]+$' THEN p.edt_id::bigint END,false))
$$;
REVOKE ALL ON FUNCTION public.photo_client_file_allowed(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.photo_client_file_allowed(text,text) TO authenticated;
ALTER POLICY support_photo_inventory_storage_read ON storage.objects USING(bucket_id='support-photos' AND public.photo_client_file_allowed(bucket_id,name));
