-- Additive ownership and explicit UPDATE capabilities. No creation/deletion grant.
ALTER TABLE public.role_ui_permissions ADD COLUMN IF NOT EXISTS capabilities jsonb NOT NULL DEFAULT '{}';
UPDATE public.role_ui_permissions SET capabilities=capabilities||'{"*":{"update":true}}'::jsonb WHERE role='Client-Admin';
-- Both client roles may submit requests (explicit exception to Client read-only).
UPDATE public.role_ui_permissions SET visible_tables=array_append(visible_tables,'Bons de travail')
 WHERE role='Client' AND NOT ('*'=ANY(visible_tables) OR 'Bons de travail'=ANY(visible_tables));

ALTER TABLE public.repertoire_des_affiches ADD COLUMN IF NOT EXISTS client_id bigint REFERENCES public.clients(id);
ALTER TABLE public.centres_dinformation ADD COLUMN IF NOT EXISTS client_id bigint REFERENCES public.clients(id);
ALTER TABLE public.ci_avec_enjeux ADD COLUMN IF NOT EXISTS client_id bigint REFERENCES public.clients(id);
ALTER TABLE public.liste_des_arrets ADD COLUMN IF NOT EXISTS client_id bigint REFERENCES public.clients(id);
ALTER TABLE public.voitures_trains ADD COLUMN IF NOT EXISTS client_id bigint REFERENCES public.clients(id);
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS client_id bigint REFERENCES public.clients(id);
ALTER TABLE public.historique_des_campagnes ADD COLUMN IF NOT EXISTS client_id bigint REFERENCES public.clients(id);
ALTER TABLE public.enjeux_des_cadres_et_supports ADD COLUMN IF NOT EXISTS client_id bigint REFERENCES public.clients(id);
-- Only deterministic links establish ownership; unmatched/ambiguous rows stay unassigned.
UPDATE public.repertoire_des_affiches r SET client_id=q.client_id FROM
 (SELECT lower(trim(nom_campagne)) name,min(client_id) client_id FROM public.campagnes_maitres WHERE client_id IS NOT NULL GROUP BY 1 HAVING count(DISTINCT client_id)=1) q
 WHERE r.client_id IS NULL AND lower(trim(r.nom_campagne))=q.name;
UPDATE public.centres_dinformation r SET client_id=q.client_id FROM
 (SELECT lower(trim(site)) name,min(client_id) client_id FROM public.infrastructures WHERE client_id IS NOT NULL GROUP BY 1 HAVING count(DISTINCT client_id)=1) q
 WHERE r.client_id IS NULL AND lower(trim(r.nom_ci))=q.name;
UPDATE public.ci_avec_enjeux r SET client_id=q.client_id FROM
 (SELECT lower(trim(site)) name,min(client_id) client_id FROM public.infrastructures WHERE client_id IS NOT NULL GROUP BY 1 HAVING count(DISTINCT client_id)=1) q
 WHERE r.client_id IS NULL AND lower(trim(r.nom_complet_ci))=q.name;
UPDATE public.liste_des_arrets r SET client_id=q.client_id FROM
 (SELECT support_id name,min(client_id) client_id FROM public.infrastructures WHERE client_id IS NOT NULL GROUP BY 1 HAVING count(DISTINCT client_id)=1) q
 WHERE r.client_id IS NULL AND r.no_arret=q.name;
UPDATE public.voitures_trains r SET client_id=i.client_id FROM public.infrastructures i WHERE r.client_id IS NULL AND r.support_id=i.support_id AND i.client_id IS NOT NULL;

-- Explicit user confirmation: current legacy business data belongs to EXO (2).
-- Never overwrite an existing owner (including Client B test fixtures).
DO $$ DECLARE t text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.clients WHERE id=2 AND lower(nom_client)='exo') THEN RAISE EXCEPTION 'canonical_exo_missing';END IF;
 FOREACH t IN ARRAY ARRAY['repertoire_des_affiches','centres_dinformation','ci_avec_enjeux','liste_des_arrets','voitures_trains','photos','historique_des_campagnes','enjeux_des_cadres_et_supports'] LOOP
  EXECUTE format('UPDATE public.%I SET client_id=2 WHERE client_id IS NULL',t);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.portal_business_view(p_view text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE public.dashboard_key(p_view)
 WHEN 'infrastructures' THEN 'infrastructures'
 WHEN 'repertoire_des_affiches' THEN 'repertoire_des_affiches'
 WHEN 'centres_d_information' THEN 'centres_dinformation'
 WHEN 'centres_dinformation' THEN 'centres_dinformation'
 WHEN 'c_i_avec_enjeux' THEN 'ci_avec_enjeux'
 WHEN 'liste_des_arrets' THEN 'liste_des_arrets'
 WHEN 'voitures_trains' THEN 'voitures_trains'
 WHEN 'photos' THEN 'photos'
 WHEN 'historique_des_campagnes' THEN 'historique_des_campagnes'
 WHEN 'suivi_des_edt' THEN 'suivi_des_edt'
 WHEN 'bons_de_travail' THEN 'bons_de_travail'
 WHEN 'campagnes_maitres' THEN 'campagnes_maitres'
 WHEN 'campagnes_et_visuels' THEN 'campagnes_maitres'
 WHEN 'campagnes' THEN 'campagnes_maitres'
 WHEN 'communications_operationnelles' THEN 'campagnes_maitres'
 WHEN 'enjeux_des_cadres_et_supports' THEN 'enjeux_des_cadres_et_supports'
 WHEN 'enjeux_terrain' THEN 'enjeux_terrain'
 END
$$;

CREATE OR REPLACE FUNCTION public.portal_view_allowed(p_view text,p_update boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(bool_or(
  u.statut='Actif' AND (NOT p_update OR u.role='Client-Admin') AND
  (v='*' OR public.dashboard_key(v)=public.dashboard_key(p_view) OR
   (public.dashboard_key(v)='enjeux_des_cadres_et_supports' AND public.dashboard_key(p_view)='enjeux_terrain') OR
   (public.portal_business_view(v)='campagnes_maitres' AND public.portal_business_view(p_view)='campagnes_maitres'
    AND (public.dashboard_key(v)='communications_operationnelles')=(public.dashboard_key(p_view)='communications_operationnelles'))) AND
  (NOT p_update OR p.capabilities->v->>'update'='true' OR p.capabilities->'*'->>'update'='true')
 ),false)
 FROM public.utilisateurs u JOIN public.role_ui_permissions p ON p.role=u.role
 CROSS JOIN LATERAL unnest(p.visible_tables) v WHERE u.auth_user_id=auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.portal_client_row_scope(p_row jsonb)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE a bigint; BEGIN
 IF public.tos_current_role() NOT IN ('Client','Client-Admin') OR auth.uid() IS NULL THEN RETURN false;END IF;
 SELECT client_id INTO a FROM public.utilisateurs WHERE auth_user_id=auth.uid() AND statut='Actif';
 IF a IS NULL OR NOT EXISTS(SELECT 1 FROM public.clients WHERE id=a) THEN RETURN false;END IF;
 IF nullif(p_row->>'client_id','')::bigint=a THEN
  -- Historical owned rows may refer to retired supports. Existing contradictory
  -- links are always refused; absence of a legacy link never changes ownership.
  RETURN NOT EXISTS(SELECT 1 FROM public.infrastructures WHERE support_id=p_row->>'support_id' AND client_id IS DISTINCT FROM a)
   AND NOT EXISTS(SELECT 1 FROM public.campagnes_maitres WHERE id=nullif(p_row->>'campagne_id','')::bigint AND client_id IS DISTINCT FROM a)
   AND NOT EXISTS(SELECT 1 FROM public.suivi_des_edt WHERE id=nullif(p_row->>'edt_id','')::bigint AND client_id IS DISTINCT FROM a);
 END IF;
 RETURN public.tos_table_resource_scope(nullif(p_row->>'client_id','')::bigint,
 nullif(p_row->>'support_id',''),nullif(p_row->>'campagne_id','')::bigint,nullif(p_row->>'edt_id','')::bigint,false);
END
$$;

DO $$ DECLARE t text;v text; BEGIN
 FOR t,v IN SELECT * FROM (VALUES
 ('infrastructures','Infrastructures'),('repertoire_des_affiches','Répertoire des affiches'),
 ('centres_dinformation','Centres d’information'),('ci_avec_enjeux','C.I. avec enjeux'),
 ('liste_des_arrets','Liste des arrêts'),('voitures_trains','Voitures / trains'),
 ('photos','Photos'),('historique_des_campagnes','Historique des campagnes'),
 ('suivi_des_edt','Suivi des EDT'),('bons_de_travail','Bons de travail')) views(t,v) LOOP
  EXECUTE format('CREATE POLICY portal_client_read ON public.%I FOR SELECT TO authenticated USING (public.portal_view_allowed(%L) AND public.portal_client_row_scope(to_jsonb(%I.*)))',t,v,t);
  EXECUTE format('CREATE POLICY portal_client_update ON public.%I FOR UPDATE TO authenticated USING (public.portal_view_allowed(%L,true) AND public.portal_client_row_scope(to_jsonb(%I.*))) WITH CHECK (public.portal_view_allowed(%L,true) AND public.portal_client_row_scope(to_jsonb(%I.*)))',t,v,t,v,t);
 END LOOP;
END $$;
CREATE POLICY portal_client_read ON public.enjeux_des_cadres_et_supports FOR SELECT TO authenticated
 USING (public.portal_view_allowed('Enjeux des cadres et supports') AND public.portal_client_row_scope(to_jsonb(enjeux_des_cadres_et_supports.*)));
CREATE POLICY portal_client_update ON public.campagnes_maitres FOR UPDATE TO authenticated
 USING (public.portal_view_allowed(CASE WHEN business_context='operational_communication' THEN 'Communications opérationnelles' ELSE 'Campagnes maîtres' END,true) AND public.portal_client_row_scope(to_jsonb(campagnes_maitres.*)))
 WITH CHECK (public.portal_view_allowed(CASE WHEN business_context='operational_communication' THEN 'Communications opérationnelles' ELSE 'Campagnes maîtres' END,true) AND public.portal_client_row_scope(to_jsonb(campagnes_maitres.*)));

-- Scope columns cannot be reassigned through the shared editor by Client-Admin.
CREATE OR REPLACE FUNCTION public.portal_client_update_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE k text;old_row jsonb:=to_jsonb(OLD);new_row jsonb:=to_jsonb(NEW);p jsonb;v text;allowed jsonb; BEGIN
 IF public.tos_current_role()='Client-Admin' THEN
  SELECT visible_columns INTO p FROM public.role_ui_permissions WHERE role='Client-Admin';
  FOR v,allowed IN SELECT key,value FROM jsonb_each(p) LOOP
   IF public.portal_business_view(v)=TG_TABLE_NAME AND jsonb_typeof(allowed)='array' AND jsonb_array_length(allowed)>0 THEN
    FOR k IN SELECT key FROM jsonb_each(new_row) LOOP
     IF k NOT IN ('updated_at') AND old_row->k IS DISTINCT FROM new_row->k AND NOT allowed ? k THEN RAISE EXCEPTION 'client_admin_column_denied' USING ERRCODE='42501';END IF;
    END LOOP;
   END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['id','client_id','support_id','campagne_id','edt_id','business_context','client_published','publiee_terrain'] LOOP
   IF old_row->k IS DISTINCT FROM new_row->k THEN RAISE EXCEPTION 'client_admin_protected_field: %',k USING ERRCODE='42501';END IF;
  END LOOP;
 END IF; RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['infrastructures','repertoire_des_affiches','centres_dinformation','ci_avec_enjeux','liste_des_arrets','voitures_trains','photos','historique_des_campagnes','suivi_des_edt','bons_de_travail','campagnes_maitres'] LOOP
  EXECUTE format('CREATE TRIGGER portal_client_update_guard BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.portal_client_update_guard()',t);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.portal_business_rows(p_view text,p_offset integer DEFAULT 0,p_limit integer DEFAULT 1000)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE t text:=public.portal_business_view(p_view);n bigint;rows jsonb;predicate text:='true'; BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR NOT public.portal_view_allowed(p_view) THEN RAISE EXCEPTION 'business_view_denied' USING ERRCODE='42501';END IF;
 IF t='campagnes_maitres' THEN predicate:=format('business_context=%L',CASE WHEN public.dashboard_key(p_view)='communications_operationnelles' THEN 'operational_communication' ELSE 'marketing' END);END IF;
 EXECUTE format('SELECT count(*) FROM public.%I WHERE %s',t,predicate) INTO n;
 EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) FROM (SELECT * FROM public.%I WHERE %s ORDER BY id LIMIT $1 OFFSET $2) r',t,predicate) INTO rows USING least(1000,greatest(1,p_limit)),greatest(0,p_offset);
 RETURN jsonb_build_object('rows',rows,'total',n);
END $$;

REVOKE ALL ON FUNCTION public.portal_business_view(text),public.portal_view_allowed(text,boolean),public.portal_client_row_scope(jsonb),public.portal_business_rows(text,integer,integer),public.portal_client_update_guard() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.portal_business_view(text),public.portal_view_allowed(text,boolean),public.portal_client_row_scope(jsonb),public.portal_business_rows(text,integer,integer),public.portal_client_update_guard() TO authenticated;

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
RETURN jsonb_build_object('version',1,'identity',v_identity,'permission',v_permission,'kpis',v_kpis,'sections',CASE WHEN a.role IN ('Client','Client-Admin') THEN public.client_portal_list_v120('dashboard',1,1,'{}')->'sections' ELSE '{}'::jsonb END,'server_ms',extract(epoch FROM clock_timestamp()-v_started)*1000);
END $function$


;
CREATE OR REPLACE FUNCTION public.portal_business_context(p_kind text,p_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE r jsonb; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'context_denied' USING ERRCODE='42501';END IF;
 IF p_kind='operations' THEN
  IF NOT public.portal_view_allowed('Suivi des EDT') THEN RAISE EXCEPTION 'context_denied' USING ERRCODE='42501';END IF;
  RETURN jsonb_build_object(
   'edts',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM public.suivi_des_edt WHERE archived_at IS NULL ORDER BY date_debut DESC NULLS LAST)x),
   'workOrders',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM public.bons_de_travail ORDER BY date_cible NULLS LAST)x),
   'requests',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM public.requetes_clients ORDER BY created_at DESC)x),
   'phases',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM public.edt_phases ORDER BY ordre)x),
   'assignments',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM public.edt_assignments ORDER BY created_at DESC)x),
   'history',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM public.operations_history ORDER BY created_at DESC LIMIT 500)x),
   'users',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT id,nom,courriel,role,statut FROM public.utilisateurs ORDER BY nom)x),
   'edtSupports',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM public.edt_supports ORDER BY updated_at DESC)x),
   'campaigns',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT id,code_campagne,nom_campagne,date_debut,date_fin,statut FROM public.campagnes_maitres ORDER BY date_fin DESC NULLS LAST)x),
   'phaseReports',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM public.edt_phase_reports ORDER BY version DESC)x),
   'dashboard',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT e.id edt_id,e.no_edt,e.nom,e.statut,public.tdm_try_date(e.date_fin_prevue::text) date_fin_prevue,coalesce(e.supports_prevus,0)::integer total,coalesce(e.supports_planifies,0)::integer planifies,coalesce(e.supports_en_cours,0)::integer en_cours,coalesce(e.supports_bloques,0)::integer bloques,coalesce(e.supports_termines,0)::integer termines,coalesce(e.progression,0)::integer progression,(public.tdm_try_date(e.date_fin_prevue::text)<current_date AND coalesce(e.progression,0)<100) en_retard FROM public.suivi_des_edt e ORDER BY public.tdm_try_date(e.date_fin_prevue::text) NULLS LAST,e.id DESC)x)
  );
 ELSIF p_kind='support' THEN
  IF NOT public.portal_view_allowed('Infrastructures') OR NOT EXISTS(SELECT 1 FROM public.infrastructures WHERE support_id=p_id) THEN RAISE EXCEPTION 'support_context_denied' USING ERRCODE='42501';END IF;
  RETURN jsonb_build_object(
   'photos',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM public.support_photos WHERE support_id=p_id AND deleted_at IS NULL LIMIT 500)x),
   'history',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM public.historique_des_campagnes WHERE support_id=p_id LIMIT 500)x),
   'issues',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM public.enjeux_terrain WHERE support_id=p_id LIMIT 500)x),
   'inspections',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM public.inspections WHERE support_id=p_id LIMIT 500)x),
   'workOrders',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM public.bons_de_travail WHERE support_id=p_id LIMIT 500)x),
   'edtLinks',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM public.edt_supports WHERE support_id=p_id LIMIT 500)x),
   'logs',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM public.photo_action_log WHERE support_id=p_id LIMIT 500)x)
  );
 END IF;
 RAISE EXCEPTION 'context_kind_denied' USING ERRCODE='42501';
END $$;
REVOKE ALL ON FUNCTION public.portal_business_context(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.portal_business_context(text,text) TO authenticated;

;
-- An admin-only, transaction-local read preview executes under authenticated RLS
-- with the target identity. It never grants a token or changes the login session.
CREATE OR REPLACE FUNCTION public.admin_preview_business_read(p_target_user_id bigint,p_view text DEFAULT NULL,p_offset integer DEFAULT 0,p_limit integer DEFAULT 1000)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE target_id uuid;old_sub text:=current_setting('request.jwt.claim.sub',true);old_claims text:=current_setting('request.jwt.claims',true);result jsonb; BEGIN
 IF public.tos_current_role() IS DISTINCT FROM 'Administrateur' THEN RAISE EXCEPTION 'admin_preview_denied' USING ERRCODE='42501';END IF;
 SELECT auth_user_id INTO target_id FROM public.utilisateurs WHERE id=p_target_user_id AND statut='Actif';
 IF target_id IS NULL THEN RAISE EXCEPTION 'preview_target_inactive' USING ERRCODE='42501';END IF;
 PERFORM set_config('request.jwt.claim.sub',target_id::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',target_id,'role','authenticated')::text,true);
 IF p_view IS NULL THEN result:=public.portal_dashboard_summary();
 ELSIF p_view='@operations' THEN result:=public.portal_business_context('operations');
 ELSIF left(p_view,9)='@support:' THEN result:=public.portal_business_context('support',substr(p_view,10));
 ELSE result:=public.portal_business_rows(p_view,p_offset,p_limit);END IF;
 PERFORM set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
 PERFORM set_config('request.jwt.claims',coalesce(old_claims,''),true);
 RETURN result;
EXCEPTION WHEN OTHERS THEN
 PERFORM set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
 PERFORM set_config('request.jwt.claims',coalesce(old_claims,''),true);
 RAISE;
END $$;
CREATE OR REPLACE FUNCTION public.admin_preview_business_rows(p_target_user_id bigint,p_view text,p_offset integer DEFAULT 0,p_limit integer DEFAULT 1000)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT public.admin_preview_business_read(p_target_user_id,p_view,p_offset,p_limit) $$;
CREATE OR REPLACE FUNCTION public.admin_preview_dashboard_summary(p_target_user_id bigint)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT public.admin_preview_business_read(p_target_user_id) $$;
CREATE OR REPLACE FUNCTION public.admin_preview_users()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$ BEGIN
 IF public.tos_current_role() IS DISTINCT FROM 'Administrateur' THEN RAISE EXCEPTION 'admin_preview_denied' USING ERRCODE='42501';END IF;
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',nom,'role',role,'client_id',client_id) ORDER BY nom),'[]') FROM public.utilisateurs WHERE statut='Actif' AND auth_user_id IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.admin_preview_business_read(bigint,text,integer,integer),public.admin_preview_business_rows(bigint,text,integer,integer),public.admin_preview_dashboard_summary(bigint),public.admin_preview_users() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_preview_business_read(bigint,text,integer,integer),public.admin_preview_business_rows(bigint,text,integer,integer),public.admin_preview_dashboard_summary(bigint),public.admin_preview_users() TO authenticated;

;
-- Read-only preview for the actual application, including internal user roles.
-- No preview header: no change to existing Data API requests.
CREATE OR REPLACE FUNCTION public.portal_preview_profile(p_user_id bigint)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$ BEGIN
 IF public.tos_current_role() IS DISTINCT FROM 'Administrateur' THEN RAISE EXCEPTION 'admin_preview_denied' USING ERRCODE='42501';END IF;
 RETURN (SELECT to_jsonb(u) FROM public.utilisateurs u WHERE id=p_user_id AND statut='Actif' AND auth_user_id IS NOT NULL);
END $$;

CREATE OR REPLACE FUNCTION public.portal_preview_storage_read(p_bucket text,p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id=p_bucket AND name=p_name)
$$;

CREATE OR REPLACE FUNCTION public.portal_preview_guard()
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE target text:=nullif(current_setting('request.headers',true),'')::jsonb->>'x-tos-preview-user';
 target_uid uuid;claims jsonb;method text:=current_setting('request.method',true);path text:=current_setting('request.path',true);
 reads text[]:=ARRAY['portal_dashboard_summary','portal_business_rows','portal_business_context','portal_preview_storage_read',
 'client_portal_identity_v120','current_user_visible_views_v136','client_portal_list_v120','client_portal_list_v1362',
 'client_portal_support_context_v139','module15_client_edt_reports_v130','lister_contextes_terrain_v1342','lister_visuels_installation_terrain_v1331',
 'tableau_bord_edt_v0129','edt_deletion_impact_v133','diagnostiquer_integrite_edt_v013','list_public_schema_fields','list_public_schema_fields_v0131a',
 'admin_client_access_overview_v135','admin_client_access_detail_v135','admin_search_client_users_v136','client_ownership_summary_v1362'];
BEGIN
 IF target IS NULL THEN RETURN;END IF;
 IF public.tos_current_role() IS DISTINCT FROM 'Administrateur' OR target!~'^[0-9]+$' THEN RAISE EXCEPTION 'admin_preview_denied' USING ERRCODE='42501';END IF;
 IF path LIKE '/rpc/%' THEN
  IF NOT substr(path,6)=ANY(reads) THEN RAISE EXCEPTION 'preview_read_only' USING ERRCODE='42501';END IF;
 ELSIF method NOT IN ('GET','HEAD') OR method IS NULL THEN RAISE EXCEPTION 'preview_read_only' USING ERRCODE='42501';END IF;
 SELECT auth_user_id INTO target_uid FROM public.utilisateurs WHERE id=target::bigint AND statut='Actif';
 IF target_uid IS NULL THEN RAISE EXCEPTION 'preview_target_inactive' USING ERRCODE='42501';END IF;
 claims:=jsonb_build_object('sub',target_uid,'role','authenticated');
 PERFORM set_config('request.jwt.claim.sub',target_uid::text,true);
 PERFORM set_config('request.jwt.claims',claims::text,true);
 PERFORM set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
END $$;
REVOKE ALL ON FUNCTION public.portal_preview_profile(bigint),public.portal_preview_storage_read(text,text),public.portal_preview_guard() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.portal_preview_profile(bigint),public.portal_preview_storage_read(text,text),public.portal_preview_guard() TO authenticated;
-- PostgREST also calls the hook for requests without a login/header.
GRANT EXECUTE ON FUNCTION public.portal_preview_guard() TO anon,service_role;
ALTER ROLE authenticator SET pgrst.db_pre_request='public.portal_preview_guard';
NOTIFY pgrst,'reload config';
NOTIFY pgrst,'reload schema';
