-- Keep dashboard aggregates consistent with the privacy projection.
CREATE OR REPLACE FUNCTION public.photo_inventory_read(p_table text DEFAULT 'support_photos'::text, p_filters jsonb DEFAULT '{}'::jsonb, p_offset integer DEFAULT 0, p_limit integer DEFAULT 500)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE predicate text;rows jsonb;total bigint;field text;filter record;ordering text:='id';
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.utilisateurs WHERE auth_user_id=auth.uid() AND statut='Actif' AND role IS NOT NULL) THEN RAISE EXCEPTION 'photo_read_denied' USING ERRCODE='42501';END IF;
 IF p_table<>ALL(ARRAY['support_photos','photos','historique_des_campagnes','inspections_terrain','inspections','enjeux_terrain','photo_action_log','activity_events','operations_history','terrain_operations','edt_reports','edt_phase_reports','communications_finales']) THEN RAISE EXCEPTION 'photo_read_table_denied' USING ERRCODE='42501';END IF;
 IF p_table='activity_events' AND public.tos_current_role() NOT IN ('Administrateur','Coordonnateur') THEN RETURN jsonb_build_object('rows','[]'::jsonb,'total',0);END IF;
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
 IF NOT (p_table='activity_events' AND coalesce(p_filters->>'recent','false')='true') THEN
 EXECUTE format('SELECT count(*) FROM public.%I WHERE %s',p_table,predicate) INTO total;END IF;
 EXECUTE format('SELECT coalesce(jsonb_agg(public.photo_visible_json(to_jsonb(r))),''[]'') FROM (SELECT * FROM public.%I WHERE %s ORDER BY %s LIMIT $1 OFFSET $2) r',p_table,predicate,ordering)
 INTO rows USING least(1000,greatest(1,coalesce(p_limit,500))),greatest(0,coalesce(p_offset,0));
 RETURN jsonb_build_object('rows',rows,'total',coalesce(total,jsonb_array_length(rows)));
END $function$
;
CREATE OR REPLACE FUNCTION public.portal_dashboard_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE a public.utilisateurs%rowtype;v_tables text[];v_permission jsonb;v_kpis jsonb:='{}';v_part jsonb;v_identity jsonb;v_started timestamptz:=clock_timestamp();
BEGIN
 SELECT * INTO a FROM public.utilisateurs WHERE auth_user_id=auth.uid() AND lower(coalesce(statut,''))='actif';
 IF (auth.uid() IS NOT NULL AND a.id IS NOT NULL AND a.role IN ('Administrateur','Coordonnateur','Installateur','Client','Client-Admin')) IS NOT TRUE THEN RAISE EXCEPTION 'dashboard_profile_denied' USING ERRCODE='42501';END IF;
 IF (a.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients WHERE id=a.client_id)) OR (a.role IN ('Client','Client-Admin') AND a.client_id IS NULL) THEN RAISE EXCEPTION 'dashboard_client_denied' USING ERRCODE='42501';END IF;

 SELECT jsonb_build_object('role',a.role,'client_id',a.client_id,'visible_tables',visible_tables,'visible_columns',visible_columns,'capabilities',capabilities) INTO v_permission FROM public.role_ui_permissions WHERE role=a.role;
 IF v_permission IS NULL THEN RAISE EXCEPTION 'dashboard_permissions_missing' USING ERRCODE='42501';END IF;
 SELECT array_agg(CASE WHEN t='*' THEN '*' ELSE public.dashboard_key(t) END) INTO v_tables FROM public.role_ui_permissions p CROSS JOIN LATERAL unnest(p.visible_tables)t WHERE p.role=a.role;
 SELECT jsonb_build_object('user_id',a.auth_user_id,'profile_id',a.id,'name',a.nom,'role',a.role,'client_id',a.client_id,'organization_id',a.client_id,'client_name',(SELECT nom_client FROM public.clients WHERE id=a.client_id)) INTO v_identity;
IF ('*'=any(v_tables) OR v_tables && ARRAY['infrastructures']) THEN
SELECT jsonb_build_object('infrastructures_total',count(*),'infrastructures_active',count(*) FILTER(WHERE public.dashboard_key(i.actif) NOT IN ('non','false','0','inactif','inactive')),'missing_photos',count(*) FILTER(WHERE coalesce(i.photo_principale_url,'')='' AND coalesce(i.photo_miniature_url,'')='' AND coalesce(i.visuel_actuel_cadre,'')='')) FROM public.infrastructures i INTO v_part;
v_kpis:=v_kpis||v_part;END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['campagnes_maitres','campagnes_et_visuels','campagnes']) THEN
SELECT jsonb_build_object('marketing_total',c->'total','marketing_active',c->'active','marketing_soon',c->'soon') INTO v_part FROM (SELECT public.canonical_campaign_counts('marketing') c) counts;
v_kpis:=v_kpis||v_part;END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['campagnes_maitres','campagnes_et_visuels','campagnes']) THEN
SELECT jsonb_build_object('marketing_visuals',count(*) ) FROM public.campagne_visuels_formats v JOIN public.campagnes_maitres c ON c.id=v.campagne_id WHERE c.business_context='marketing' INTO v_part;
v_kpis:=v_kpis||v_part;END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['campagnes_maitres','campagnes_et_visuels','campagnes']) THEN
WITH current_assignments AS (SELECT coalesce(i.site,'') site,coalesce(cs.support_id,'') support,cs.campagne_id::text campaign,coalesce((SELECT min(v.id)::text FROM public.campagne_visuels_formats v WHERE v.campagne_id=c.id AND lower(trim(v.nom_visuel))=lower(trim(cs.visuel_attendu))),'') visual FROM public.campagnes_supports cs JOIN public.campagnes_maitres c ON c.id=cs.campagne_id LEFT JOIN public.infrastructures i ON i.support_id=cs.support_id WHERE c.business_context='marketing'), historical AS (SELECT to_jsonb(h) r FROM public.campagnes_visuels_sites_supports h WHERE h.business_context='marketing'), logical AS (SELECT * FROM current_assignments UNION SELECT coalesce(r->>'site_id',r->>'site',''),coalesce(r->>'support_id',''),coalesce(r->>'campaign_id',r->>'communication_id',r->>'campagne_id',''),coalesce(r->>'visual_id',r->>'visuel_id',r->>'nom_visuel',r->>'visuel_attendu','') FROM historical) SELECT jsonb_build_object('marketing_places',count(*)) FROM logical INTO v_part;
v_kpis:=v_kpis||v_part;END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['communications_operationnelles']) THEN
SELECT jsonb_build_object('operational_total',c->'total','operational_active',c->'active','operational_soon',c->'soon') INTO v_part FROM (SELECT public.canonical_campaign_counts('operational_communication') c) counts;
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
SELECT jsonb_build_object('photos',(public.photo_inventory_read('support_photos',jsonb_build_object('deleted_at',NULL),0,1)->>'total')::bigint) INTO v_part;
v_kpis:=v_kpis||v_part;END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['clients']) THEN
SELECT jsonb_build_object('clients',count(*)) FROM public.clients INTO v_part;
v_kpis:=v_kpis||v_part;END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['bons_de_travail']) THEN
SELECT jsonb_build_object('work_orders',count(*),'urgent_work_orders',count(*) FILTER(WHERE public.dashboard_key(statut) NOT IN ('ferme','fermee','resolu','resolue','termine','terminee','complete','completee','annule','annulee','archive','archivee') AND public.dashboard_key(priorite) LIKE '%urgent%')) FROM public.bons_de_travail INTO v_part;
v_kpis:=v_kpis||v_part;END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['enjeux_des_cadres_et_supports']) THEN
WITH historical AS (SELECT to_jsonb(e) r FROM public.enjeux_des_cadres_et_supports e),terrain AS (SELECT to_jsonb(e) r FROM (SELECT (jsonb_populate_record(NULL::public.enjeux_terrain,item)).* FROM generate_series(0,greatest(0,((public.photo_inventory_read('enjeux_terrain','{}'::jsonb,0,1)->>'total')::integer-1)/500))page CROSS JOIN LATERAL jsonb_array_elements(public.photo_inventory_read('enjeux_terrain','{}'::jsonb,page*500,500)->'rows')item) e), merged AS (SELECT lower(coalesce(nullif(trim(r->>'related_support'),''),nullif(trim(r->>'no_cadre'),''),nullif(trim(r->>'Related Support'),''),nullif(trim(r->>'#Du cadre'),''),'')) f0,lower(coalesce(nullif(trim(r->>'emplacement'),''),nullif(trim(r->>'Emplacement'),''),'')) f1,lower(coalesce(nullif(trim(r->>'type_enjeu'),''),nullif(trim(r->>'type_enjeux'),''),nullif(trim(r->>'Type d''enjeux'),''),'')) f2,lower(coalesce(nullif(trim(r->>'description'),''),nullif(trim(r->>'enjeux'),''),nullif(trim(r->>'Enjeux'),''),'')) f3,lower(coalesce(nullif(trim(r->>'statut'),''),nullif(trim(r->>'Statut'),''),'')) f4,lower(coalesce(nullif(trim(r->>'commentaire'),''),nullif(trim(r->>'Commentaire'),''),'')) f5,lower(coalesce(nullif(trim(r->>'photo'),''),nullif(trim(r->>'photo_url'),''),'')) f6,lower(coalesce(nullif(trim(r->>'date_inscription'),''),nullif(trim(r->>'Date d''inscription de l''enjeux'),''),nullif(trim(r->>'created_at'),''),nullif(trim(r->>'Date Created'),''),'')) f7,lower(coalesce(nullif(trim(r->>'client'),''),nullif(trim(r->>'client_id'),''),'')) f8 FROM historical UNION SELECT lower(coalesce(nullif(trim(r->>'support_id'),''),'')) f0,lower(coalesce(nullif(trim(r->>'emplacement'),''),'')) f1,lower(coalesce(nullif(trim(r->>'type_enjeu'),''),nullif(trim(r->>'type_enjeux'),''),'')) f2,lower(coalesce(nullif(trim(r->>'description'),''),nullif(trim(r->>'enjeux'),''),nullif(trim(r->>'type_enjeu'),''),'')) f3,lower(coalesce(nullif(trim(r->>'statut'),''),'')) f4,lower(coalesce(nullif(trim(r->>'commentaire'),''),nullif(trim(r->>'commentaires'),''),'')) f5,lower(coalesce(nullif(trim(r->>'photo_url'),''),nullif(trim(r->>'photo_id'),''),'')) f6,lower(coalesce(nullif(trim(r->>'created_at'),''),nullif(trim(r->>'date_inscription'),''),'')) f7,lower(coalesce(nullif(trim(r->>'client'),''),nullif(trim(r->>'client_id'),''),'')) f8 FROM terrain) SELECT jsonb_build_object('issues_open',count(*) FILTER(WHERE public.dashboard_key(f4) NOT IN ('ferme','fermee','resolu','resolue','termine','terminee','complete','completee','annule','annulee','archive','archivee'))) FROM merged INTO v_part;
v_kpis:=v_kpis||v_part;END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['diagnostic_terrain','application_terrain']) THEN
SELECT jsonb_build_object('terrain',count(*),'terrain_errors',count(*) FILTER(WHERE public.dashboard_key(statut) IN ('echec','echouee','error','erreur','failed') AND resolved_at IS NULL)) FROM public.terrain_sync_history_v113 INTO v_part;
v_kpis:=v_kpis||v_part;END IF;
IF ('*'=any(v_tables) OR v_tables && ARRAY['rapports','rapports_edt','rapports_finaux']) THEN
WITH tracking AS (SELECT r.id,r.status report_status,o.status delivery_status FROM public.suivi_des_edt e LEFT JOIN LATERAL(SELECT r.id,r.status FROM (SELECT (jsonb_populate_record(NULL::public.edt_reports,item)).* FROM generate_series(0,greatest(0,((public.photo_inventory_read('edt_reports',jsonb_build_object('edt_id',e.id),0,1)->>'total')::integer-1)/500))page CROSS JOIN LATERAL jsonb_array_elements(public.photo_inventory_read('edt_reports',jsonb_build_object('edt_id',e.id),page*500,500)->'rows')item) r WHERE r.edt_id=e.id AND r.status<>'deleted' ORDER BY r.report_version DESC LIMIT 1)r ON true LEFT JOIN LATERAL(SELECT o.status FROM public.email_outbox o WHERE o.edt_id=e.id AND r.id IS NOT NULL AND (o.report_id=r.id OR(o.report_id IS NULL AND o.report_version IS NULL)) ORDER BY o.created_at DESC LIMIT 1)o ON true WHERE e.statut='Complété') SELECT jsonb_build_object('reports',count(id),'reports_completed',count(*),'reports_sent',count(*) FILTER(WHERE delivery_status='sent'),'reports_to_send',count(*) FILTER(WHERE delivery_status IS NULL OR delivery_status IN ('pending','sending')),'reports_errors',count(*) FILTER(WHERE report_status='error' OR delivery_status='failed')) FROM tracking INTO v_part;
v_kpis:=v_kpis||v_part;END IF;
RETURN jsonb_build_object('version',1,'identity',v_identity,'permission',v_permission,'kpis',v_kpis,'sections',CASE WHEN a.role IN ('Client','Client-Admin') THEN public.client_portal_list_v120('dashboard',1,1,'{}')->'sections' ELSE '{}'::jsonb END,'server_ms',extract(epoch FROM clock_timestamp()-v_started)*1000);
END $function$
;
DO $$DECLARE t text;BEGIN
 FOR t IN SELECT tablename FROM pg_policies WHERE schemaname='public' AND policyname='photo_private_client_projection' LOOP
  EXECUTE format('ALTER POLICY photo_private_client_projection ON public.%I USING ((SELECT public.tos_current_role()) NOT IN (''Client'',''Client-Admin''))',t);
 END LOOP;
END $$;
