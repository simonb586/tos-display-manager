-- Canonical structured visual/EDT links; legacy scalar references remain readable.
CREATE TABLE public.visual_edt_associations (
 visual_id bigint NOT NULL REFERENCES public.campagne_visuels_formats(id) ON DELETE CASCADE,
 edt_id bigint NOT NULL REFERENCES public.suivi_des_edt(id) ON DELETE CASCADE,
 phase_id bigint NOT NULL REFERENCES public.edt_phases(id) ON DELETE CASCADE,
 date_debut date,
 date_fin date,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(visual_id,edt_id),
 CHECK(date_debut IS NULL OR date_fin IS NULL OR date_fin>=date_debut)
);
CREATE INDEX visual_edt_associations_edt ON public.visual_edt_associations(edt_id);
CREATE INDEX visual_edt_associations_phase ON public.visual_edt_associations(phase_id);
ALTER TABLE public.visual_edt_associations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.visual_edt_associations FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.visual_edt_associations TO authenticated;
INSERT INTO public.visual_edt_associations(visual_id,edt_id,phase_id)
 SELECT v.id,p.edt_id,p.id FROM public.campagne_visuels_formats v JOIN public.edt_phases p ON p.id=v.edt_phase_id;
CREATE POLICY visual_edt_read ON public.visual_edt_associations FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.campagne_visuels_formats v WHERE v.id=visual_id) AND EXISTS(SELECT 1 FROM public.suivi_des_edt e WHERE e.id=edt_id));
CREATE POLICY visual_edt_write ON public.visual_edt_associations FOR ALL TO authenticated
 USING(public.tos_current_role()='Administrateur' AND EXISTS(SELECT 1 FROM public.campagne_visuels_formats v WHERE v.id=visual_id AND public.tos_table_resource_scope(v.client_id,NULL,v.campagne_id,edt_id,false)))
 WITH CHECK(public.tos_current_role()='Administrateur' AND EXISTS(SELECT 1 FROM public.campagne_visuels_formats v JOIN public.suivi_des_edt e ON e.id=edt_id JOIN public.edt_phases p ON p.id=phase_id AND p.edt_id=e.id WHERE v.id=visual_id AND e.campagne_id=v.campagne_id AND e.client_id=v.client_id AND (p.client_id IS NULL OR p.client_id=e.client_id) AND p.phase_type='installation' AND public.tos_table_resource_scope(v.client_id,NULL,v.campagne_id,e.id,false)));

-- Historical scalar writers add/remove only their own link; other EDTs survive.
CREATE FUNCTION public.sync_legacy_visual_edt() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.edt_phase_id IS NOT DISTINCT FROM OLD.edt_phase_id THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' AND OLD.edt_phase_id IS NOT NULL AND NEW.edt_phase_id IS NULL THEN
  DELETE FROM public.visual_edt_associations WHERE visual_id=NEW.id AND phase_id=OLD.edt_phase_id;
 END IF;
 IF NEW.edt_phase_id IS NOT NULL THEN
  INSERT INTO public.visual_edt_associations(visual_id,edt_id,phase_id) SELECT NEW.id,p.edt_id,p.id FROM public.edt_phases p WHERE p.id=NEW.edt_phase_id ON CONFLICT(visual_id,edt_id) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_legacy_visual_edt() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER sync_legacy_visual_edt AFTER INSERT OR UPDATE OF edt_phase_id ON public.campagne_visuels_formats FOR EACH ROW EXECUTE FUNCTION public.sync_legacy_visual_edt();

CREATE FUNCTION public.guard_visual_edt_owner_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.visual_edt_associations a JOIN public.suivi_des_edt e ON e.id=a.edt_id WHERE a.visual_id=NEW.id AND (e.campagne_id IS DISTINCT FROM NEW.campagne_id OR e.client_id IS DISTINCT FROM NEW.client_id)) THEN RAISE EXCEPTION 'remove_edt_links_before_owner_change' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_visual_edt_owner_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_visual_edt_owner_change AFTER UPDATE OF campagne_id,client_id ON public.campagne_visuels_formats FOR EACH ROW EXECUTE FUNCTION public.guard_visual_edt_owner_change();

CREATE FUNCTION public.save_visual_edt_associations(p_visual_id bigint,p_links jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v public.campagne_visuels_formats%rowtype;l jsonb;
BEGIN
 IF auth.uid() IS NULL OR public.tos_current_role() IS DISTINCT FROM 'Administrateur' THEN RAISE EXCEPTION 'admin_visual_edt_assignment_required' USING ERRCODE='42501';END IF;
 SELECT * INTO v FROM public.campagne_visuels_formats WHERE id=p_visual_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'visual_scope_denied' USING ERRCODE='42501';END IF;
 IF jsonb_typeof(p_links) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_edt_links';END IF;
 DELETE FROM public.visual_edt_associations WHERE visual_id=p_visual_id;
 FOR l IN SELECT value FROM jsonb_array_elements(p_links) LOOP
  INSERT INTO public.visual_edt_associations(visual_id,edt_id,phase_id,date_debut,date_fin)
  SELECT p_visual_id,p.edt_id,p.id,nullif(l->>'date_debut','')::date,nullif(l->>'date_fin','')::date FROM public.edt_phases p WHERE p.id=(l->>'phase_id')::bigint;
  IF NOT FOUND THEN RAISE EXCEPTION 'edt_phase_not_found';END IF;
 END LOOP;
 -- Keep the historic scalar as a compatibility projection; consumers use the relation.
 UPDATE public.campagne_visuels_formats SET edt_phase_id=(SELECT min(phase_id) FROM public.visual_edt_associations WHERE visual_id=p_visual_id),updated_at=now() WHERE id=p_visual_id;
 RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.save_visual_edt_associations(bigint,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_visual_edt_associations(bigint,jsonb) TO authenticated;

CREATE FUNCTION public.update_visual_edt_association(p_visual_id bigint,p_phase_id bigint,p_remove_edt_id bigint DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE links jsonb;
BEGIN
 IF auth.uid() IS NULL OR public.tos_current_role() IS DISTINCT FROM 'Administrateur' THEN RAISE EXCEPTION 'admin_visual_edt_assignment_required' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.campagne_visuels_formats WHERE id=p_visual_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'visual_scope_denied' USING ERRCODE='42501';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]') INTO links FROM public.visual_edt_associations a WHERE visual_id=p_visual_id AND (p_remove_edt_id IS NULL OR a.edt_id<>p_remove_edt_id) AND (p_phase_id IS NULL OR a.edt_id<>(SELECT edt_id FROM public.edt_phases WHERE id=p_phase_id));
 IF p_phase_id IS NOT NULL THEN links:=links||jsonb_build_array(jsonb_build_object('phase_id',p_phase_id));END IF;
 RETURN public.save_visual_edt_associations(p_visual_id,links);
END $$;
REVOKE ALL ON FUNCTION public.update_visual_edt_association(bigint,bigint,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_visual_edt_association(bigint,bigint,bigint) TO authenticated;

CREATE FUNCTION public.save_campaign_visual_with_edts(p_visual jsonb,p_links jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v public.campagne_visuels_formats%rowtype;
BEGIN
 IF auth.uid() IS NULL OR public.tos_current_role() NOT IN ('Administrateur','Coordonnateur') THEN RAISE EXCEPTION 'visual_write_denied' USING ERRCODE='42501';END IF;
 IF nullif(p_visual->>'id','') IS NULL THEN
  INSERT INTO public.campagne_visuels_formats(campagne_id,nom_visuel,format_support) VALUES((p_visual->>'campagne_id')::bigint,p_visual->>'nom_visuel',p_visual->>'format_support') RETURNING * INTO v;
 ELSE
  SELECT * INTO v FROM public.campagne_visuels_formats WHERE id=(p_visual->>'id')::bigint FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'visual_scope_denied' USING ERRCODE='42501';END IF;
 END IF;
 UPDATE public.campagne_visuels_formats SET campagne_id=(p_visual->>'campagne_id')::bigint,nom_visuel=p_visual->>'nom_visuel',format_support=p_visual->>'format_support',phase=p_visual->>'phase',code_visuel=p_visual->>'code_visuel',quantite_prevue=coalesce((p_visual->>'quantite_prevue')::integer,0),actif=coalesce((p_visual->>'actif')::boolean,true),is_out_of_frame=coalesce((p_visual->>'is_out_of_frame')::boolean,false),instructions_terrain=p_visual->>'instructions_terrain',updated_at=now() WHERE id=v.id RETURNING * INTO v;
 IF NOT FOUND THEN RAISE EXCEPTION 'visual_scope_denied' USING ERRCODE='42501';END IF;
 IF p_links IS NOT NULL THEN PERFORM public.save_visual_edt_associations(v.id,p_links);END IF;
 RETURN to_jsonb(v);
END $$;
REVOKE ALL ON FUNCTION public.save_campaign_visual_with_edts(jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_campaign_visual_with_edts(jsonb,jsonb) TO authenticated;

-- A narrow aggregate exposes canonical counts without broadening campaign row access.
CREATE FUNCTION public.canonical_campaign_counts(p_context text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.utilisateurs%rowtype;result jsonb;
BEGIN
 SELECT * INTO a FROM public.utilisateurs WHERE auth_user_id=auth.uid() AND statut='Actif';
 IF auth.uid() IS NULL OR a.id IS NULL OR p_context NOT IN ('marketing','operational_communication') OR a.role NOT IN ('Administrateur','Coordonnateur','Installateur','Client','Client-Admin') THEN RAISE EXCEPTION 'dashboard_profile_denied' USING ERRCODE='42501';END IF;
 IF (a.role IN ('Client','Client-Admin') AND a.client_id IS NULL) OR (a.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients WHERE id=a.client_id)) THEN RAISE EXCEPTION 'dashboard_client_denied' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.role_ui_permissions p CROSS JOIN LATERAL unnest(p.visible_tables)t WHERE p.role=a.role AND (t='*' OR (p_context='marketing' AND public.dashboard_key(t) IN ('campagnes','campagnes_maitres','campagnes_et_visuels')) OR (p_context='operational_communication' AND public.dashboard_key(t)='communications_operationnelles'))) THEN RAISE EXCEPTION 'dashboard_view_denied' USING ERRCODE='42501';END IF;
 SELECT jsonb_build_object('total',count(*),'active',count(*) FILTER(WHERE public.dashboard_key(c.statut) IN ('actif','active','en_cours','planifie','planifiee')),'soon',count(*) FILTER(WHERE c.date_fin BETWEEN current_date AND current_date+7)) INTO result FROM public.campagnes_maitres c WHERE c.business_context=p_context AND (a.client_id IS NULL OR c.client_id=a.client_id);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.canonical_campaign_counts(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.canonical_campaign_counts(text) TO authenticated;

UPDATE public.role_ui_permissions SET visible_tables=array_append(array_remove(visible_tables,'Photos'),'Photos et inventaire'),capabilities=capabilities||'{"Photos":{"update":false},"Photos et inventaire":{"update":false}}'::jsonb WHERE role IN ('Client','Client-Admin');
CREATE POLICY photo_client_inventory_read ON public.support_photos FOR SELECT TO authenticated
 USING(public.tos_current_role() IN ('Client','Client-Admin') AND client_visible AND deleted_at IS NULL AND public.portal_view_allowed('Photos et inventaire') AND public.tos_table_resource_scope(client_id,support_id,campagne_id,CASE WHEN edt_id ~ '^[0-9]+$' THEN edt_id::bigint END,false));
-- Restrictive fences also cover direct API mutations against historical Photos.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['photos','support_photos','inventory_movements'] LOOP
 EXECUTE format('CREATE POLICY client_photo_no_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(public.tos_current_role() NOT IN (''Client'',''Client-Admin''))',t);
 EXECUTE format('CREATE POLICY client_photo_no_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING(public.tos_current_role() NOT IN (''Client'',''Client-Admin'')) WITH CHECK(public.tos_current_role() NOT IN (''Client'',''Client-Admin''))',t);
 EXECUTE format('CREATE POLICY client_photo_no_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING(public.tos_current_role() NOT IN (''Client'',''Client-Admin''))',t);
 END LOOP;
END $$;

CREATE POLICY support_photo_inventory_storage_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='support-photos' AND public.tos_current_role() IN ('Client','Client-Admin') AND public.portal_view_allowed('Photos et inventaire') AND EXISTS(SELECT 1 FROM public.support_photos p WHERE p.storage_bucket=objects.bucket_id AND p.storage_path=objects.name AND p.deleted_at IS NULL AND p.client_visible));

-- Recover only deterministic historical photo -> EDT evidence, never today's visual link.
WITH evidence AS (
 SELECT p.id,min(e.id) edt_id,min(e.no_edt) edt_number
 FROM public.support_photos p JOIN public.historique_des_campagnes h ON h.raw_data->>'photo_id'=p.id::text AND h.support_id=p.support_id
 JOIN public.suivi_des_edt e ON h.raw_data->>'edt_id'=e.id::text AND e.client_id=p.client_id
 WHERE p.edt_id IS NULL AND p.type_photo='Installation'
 GROUP BY p.id HAVING count(DISTINCT e.id)=1
)
UPDATE public.support_photos p SET edt_id=e.edt_id::text,metadata=coalesce(p.metadata,'{}')||jsonb_build_object('edt_number',e.edt_number)
FROM evidence e WHERE p.id=e.id;

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

CREATE OR REPLACE FUNCTION public.tos_storage_tenant_scope(p_bucket text, p_path text, p_action text, p_owner text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r text:=public.tos_current_role();a bigint;s text;owner_client bigint;e bigint;p record;matched boolean:=false;
BEGIN
 IF p_bucket='terrain-photos' AND p_action='read' THEN RETURN true;END IF;
 IF auth.uid() IS NULL OR r IS NULL OR p_action IS NULL OR p_action NOT IN ('read','insert','update','delete') OR p_path IS NULL OR p_path='' OR p_path ~ '(^|/)[.][.]?(/|$)|//|[?#%]' THEN RETURN false;END IF;
 SELECT u.client_id INTO a FROM public.utilisateurs u WHERE u.auth_user_id=auth.uid() AND lower(coalesce(u.statut,''))='actif';
 IF a IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients c WHERE c.id=a) THEN RETURN false;END IF;
 IF r IN ('Client','Client-Admin') AND a IS NULL THEN RETURN false;END IF;
 IF p_action<>'read' AND r NOT IN ('Administrateur','Coordonnateur','Installateur') THEN RETURN false;END IF;
 IF p_action='insert' AND p_owner IS DISTINCT FROM auth.uid()::text THEN RETURN false;END IF;
 IF p_bucket='terrain-photos' THEN
  IF p_action='update' THEN RETURN false;END IF;
  s:=case when split_part(p_path,'/',1)='supports' then split_part(p_path,'/',2) else split_part(p_path,'/',1) end;
  RETURN public.tos_table_resource_scope(null,s,null,null,false) IS TRUE;
 ELSIF p_bucket='support-photos' THEN
  FOR p IN SELECT x.* FROM public.support_photos x WHERE coalesce(x.storage_bucket,'support-photos')='support-photos' AND (x.storage_path=p_path OR (x.assignment_pending AND x.target_storage_path=p_path)) LOOP
   matched:=true;
   IF public.tos_table_resource_scope(p.client_id,p.support_id,p.campagne_id,nullif(p.edt_id,'')::bigint,p.source='mass_import') IS NOT TRUE THEN RETURN false;END IF;
   IF p.assignment_pending AND public.tos_table_resource_scope(p.target_client_id,p.target_support_id,null,null,false) IS NOT TRUE THEN RETURN false;END IF;
   IF r IN ('Client','Client-Admin') AND (p.client_visible IS NOT TRUE OR (public.client_can_access_campaign_v120(p.campagne_id) OR (p.deleted_at IS NULL AND public.portal_view_allowed('Photos et inventaire'))) IS NOT TRUE) THEN RETURN false;END IF;
  END LOOP;
  IF matched THEN RETURN true;END IF;
  IF r NOT IN ('Administrateur','Coordonnateur','Installateur') THEN RETURN false;END IF;
  s:=case when split_part(p_path,'/',1)='supports' then split_part(p_path,'/',2) else split_part(p_path,'/',1) end;
  IF public.tos_table_resource_scope(null,s,null,null,false) IS TRUE THEN RETURN true;END IF;
  RETURN a IS NULL AND (p_action='read' OR (r IN ('Administrateur','Coordonnateur') AND split_part(p_path,'/',1)='review'));
 ELSIF p_bucket='final-reports' THEN
  IF a IS NULL AND r IS DISTINCT FROM 'Administrateur' THEN RETURN false;END IF;
  IF r NOT IN ('Administrateur','Coordonnateur','Client','Client-Admin') THEN RETURN false;END IF;
  IF p_path !~* '[.]pdf$' OR (SELECT count(*) FROM public.suivi_des_edt x WHERE regexp_replace(coalesce(x.no_edt,x.id::text),'[^a-zA-Z0-9_-]','_','g')=split_part(p_path,'/',1))<>1 THEN RETURN false;END IF;
  SELECT x.id INTO e FROM public.suivi_des_edt x WHERE regexp_replace(coalesce(x.no_edt,x.id::text),'[^a-zA-Z0-9_-]','_','g')=split_part(p_path,'/',1);
  IF public.tos_table_resource_scope(null,null,null,e,false) IS NOT TRUE THEN RETURN false;END IF;
  IF EXISTS(SELECT 1 FROM public.edt_reports x WHERE x.report_path=p_path AND (x.edt_id IS DISTINCT FROM e OR x.storage_bucket IS DISTINCT FROM 'final-reports')) OR EXISTS(SELECT 1 FROM public.communications_finales x WHERE x.report_path=p_path AND x.edt_id IS DISTINCT FROM e::text) THEN RETURN false;END IF;
  FOR p IN SELECT x.edt_id,x.status,x.client_visible FROM public.edt_reports x WHERE x.report_path=p_path LOOP
   matched:=true;IF public.tos_table_resource_scope(null,null,null,p.edt_id,false) IS NOT TRUE THEN RETURN false;END IF;
   IF r IN ('Client','Client-Admin') AND (p.status IS DISTINCT FROM 'ready' OR p.client_visible IS NOT TRUE OR NOT EXISTS(SELECT 1 FROM public.suivi_des_edt x WHERE x.id=p.edt_id AND x.client_visible AND public.client_can_access_campaign_v120(x.campagne_id) IS TRUE)) THEN RETURN false;END IF;
  END LOOP;
  FOR p IN SELECT x.client_id,x.edt_id,x.client_published FROM public.communications_finales x WHERE x.report_path=p_path LOOP
   matched:=true;IF public.tos_table_resource_scope(p.client_id,null,null,nullif(p.edt_id,'')::bigint,false) IS NOT TRUE THEN RETURN false;END IF;
   IF r IN ('Client','Client-Admin') AND p.client_published IS NOT TRUE THEN RETURN false;END IF;
  END LOOP;
  IF matched THEN RETURN true;END IF;
  IF r NOT IN ('Administrateur','Coordonnateur') THEN RETURN false;END IF;
  IF (SELECT count(*) FROM public.suivi_des_edt x WHERE regexp_replace(coalesce(x.no_edt,x.id::text),'[^a-zA-Z0-9_-]','_','g')=split_part(p_path,'/',1))<>1 THEN RETURN false;END IF;
  SELECT x.id INTO e FROM public.suivi_des_edt x WHERE regexp_replace(coalesce(x.no_edt,x.id::text),'[^a-zA-Z0-9_-]','_','g')=split_part(p_path,'/',1);
  RETURN public.tos_table_resource_scope(null,null,null,e,false) IS TRUE;
 END IF;
 RETURN false;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END $function$
;

CREATE OR REPLACE FUNCTION public.terrain_photo_access_prepared(p_path text, p_action text, p_owner text DEFAULT NULL::text, p_created timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=auth.uid(); v_role text; v_client bigint; v_support text; v_owner bigint;
begin
  if v_uid is null or p_action is null or p_action not in ('read','insert','delete')
     or p_path is null or p_path !~ '^[A-Za-z0-9_-]+/'
     or p_path ~ '(^|/)[.][.]?(/|$)|//|[?#%]' then return false; end if;
  v_role:=public.tos_current_role();
  if v_role is null then return false; end if;
  select u.client_id into v_client from public.utilisateurs u where u.auth_user_id=v_uid and lower(u.statut)='actif';
  v_support:=case when split_part(p_path,'/',1)='supports' then split_part(p_path,'/',2) else split_part(p_path,'/',1) end;
  select i.client_id into v_owner from public.infrastructures i join public.clients c on c.id=i.client_id where i.support_id=v_support;
  if v_owner is null then return false; end if;
  if exists(select 1 from public.support_photos p
    where ((p.storage_bucket='terrain-photos' and p.storage_path=p_path)
      or p.photo_url='terrain-photos/'||p_path
      or split_part(p.photo_url,'/storage/v1/object/public/terrain-photos/',2)=p_path)
    and (p.client_id is distinct from v_owner or p.support_id is distinct from v_support
      or (p.campagne_id is not null and not exists(select 1 from public.campagnes_maitres c where c.id=p.campagne_id and c.client_id=v_owner)))) then return false; end if;
  if v_role in ('Administrateur','Coordonnateur','Installateur') then
    if v_client is not null and v_client<>v_owner then return false; end if;
    if p_action in ('read','insert') then return true; end if;
    if v_role='Administrateur' then return true; end if;
    -- Upload rollback only: internal uploader, no registered photo left.
    return p_owner=v_uid::text and p_created>now()-interval '10 minutes'
      and not exists(select 1 from public.inspections_terrain x where x.photo_path=p_path or x.photo_url='terrain-photos/'||p_path or split_part(x.photo_url,'/storage/v1/object/public/terrain-photos/',2)=p_path)
      and not exists(select 1 from public.infrastructures i where i.photo_principale_url='terrain-photos/'||p_path or i.photo_miniature_url='terrain-photos/'||p_path or split_part(i.photo_principale_url,'/storage/v1/object/public/terrain-photos/',2)=p_path or split_part(i.photo_miniature_url,'/storage/v1/object/public/terrain-photos/',2)=p_path)
      and not exists(select 1 from public.support_photos p
      where (p.storage_bucket='terrain-photos' and p.storage_path=p_path)
         or p.photo_url='terrain-photos/'||p_path
         or split_part(p.photo_url,'/storage/v1/object/public/terrain-photos/',2)=p_path);
  end if;
  if p_action<>'read' or v_role not in ('Client','Client-Admin') or v_client is null or v_client<>v_owner then return false; end if;
  return exists(select 1 from public.support_photos p
    left join public.campagnes_maitres c on c.id=p.campagne_id and c.client_id=p.client_id
    where p.support_id=v_support and p.client_id=v_owner and p.client_visible and p.deleted_at is null
      and ((p.storage_bucket='terrain-photos' and p.storage_path=p_path)
        or p.photo_url='terrain-photos/'||p_path
        or split_part(p.photo_url,'/storage/v1/object/public/terrain-photos/',2)=p_path)
      and (public.portal_view_allowed('Photos et inventaire') or p.campagne_id is null or (c.client_published and (v_role='Client-Admin' or exists(select 1 from public.client_campaign_access a where a.client_id=v_client and a.campaign_id=c.id
        and (a.user_id is null or a.user_id=v_uid))))));
end $function$
;

CREATE OR REPLACE FUNCTION public.finaliser_intervention_terrain_v1342(p_support_id text, p_edt_phase_id bigint, p_action text, p_type_enjeu text, p_commentaires text, p_nom_fichier text, p_storage_path text, p_photo_url text, p_utilisateur text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user public.utilisateurs%rowtype;v_context record;v_email text;v_result jsonb;v_issue_id bigint;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur','Installateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF p_edt_phase_id IS NOT NULL THEN IF (EXISTS(SELECT 1 FROM public.edt_phases sec_phase JOIN public.suivi_des_edt sec_edt ON sec_edt.id=sec_phase.edt_id WHERE sec_phase.id=p_edt_phase_id AND (sec_phase.client_id IS NULL OR sec_phase.client_id=sec_edt.client_id) AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'phase_scope_denied' USING ERRCODE='42501';END IF;
END IF;
IF (public.tos_table_resource_scope(NULL,p_support_id,NULL,(SELECT sec_phase.edt_id FROM public.edt_phases sec_phase WHERE sec_phase.id=p_edt_phase_id),false)) IS NOT TRUE THEN RAISE EXCEPTION 'support_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501';end if;
 select * into v_user from public.utilisateurs where auth_user_id=auth.uid() and statut='Actif' limit 1;
 if not found or v_user.role not in ('Administrateur','Coordonnateur','Installateur') then raise exception 'terrain_role_denied' using errcode='42501';end if;
 -- An issue belongs directly to its support; historical context remains valid.
 if p_edt_phase_id is not null then
   select ep.id phase_id,ep.edt_id,ep.phase_type,e.campagne_id into v_context
   from public.edt_phases ep join public.edt_supports es on es.phase_id=ep.id and es.edt_id=ep.edt_id join public.suivi_des_edt e on e.id=ep.edt_id
   where ep.id=p_edt_phase_id and es.support_id=p_support_id and e.archived_at is null;
   if not found then raise exception 'cross_context_support_denied' using errcode='42501';end if;
 end if;
 if p_edt_phase_id is null then
 select null::bigint as edt_id, null::text as phase_type into v_context;
 end if;
 v_email:=coalesce(nullif(v_user.courriel,''),(select email from auth.users where id=auth.uid()));
 v_result:=public.finaliser_intervention_terrain_v01273(p_support_id,p_action,p_type_enjeu,p_commentaires,p_nom_fichier,p_storage_path,p_photo_url,v_email,p_idempotency_key);
 if coalesce((v_result->>'ok')::boolean,false) is not true then return v_result;end if;
 if lower(trim(p_action))='enjeu' and p_edt_phase_id is not null then
   v_issue_id:=nullif(v_result->>'enjeu_id','')::bigint;
   if not exists(select 1 from public.enjeux_terrain where id=v_issue_id and support_id=p_support_id and edt_phase_id=p_edt_phase_id) then
     update public.enjeux_terrain set edt_phase_id=p_edt_phase_id where id=v_issue_id and support_id=p_support_id and edt_phase_id is null;
     if not found then raise exception 'issue_context_not_persisted';end if;
   end if;
 end if;
 return v_result||jsonb_build_object('edt_phase_id',p_edt_phase_id,'edt_id',case when p_edt_phase_id is null then null else v_context.edt_id end,'phase_type',case when p_edt_phase_id is null then null else v_context.phase_type end);
END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.finaliser_installation_terrain_v1344(p_support_id text, p_visuel_id bigint, p_nom_fichier text, p_storage_path text, p_photo_url text, p_utilisateur text DEFAULT NULL::text, p_commentaires text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text, p_edt_phase_id bigint DEFAULT NULL, p_sans_edt boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare

  v_user public.utilisateurs%rowtype;v_prior public.terrain_operations%rowtype;
  v_ref text:=coalesce(nullif(trim(p_idempotency_key),''),'INSTALL-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||regexp_replace(p_support_id,'[^A-Za-z0-9]','','g'));
  v_op uuid;v_visual public.campagne_visuels_formats%rowtype;v_campaign public.campagnes_maitres%rowtype;
  v_infra public.infrastructures%rowtype;v_photo public.support_photos%rowtype;v_edt public.suivi_des_edt%rowtype;v_email text;
BEGIN
IF p_sans_edt IS NULL OR (p_sans_edt AND p_edt_phase_id IS NOT NULL) OR (NOT p_sans_edt AND p_edt_phase_id IS NULL) THEN RAISE EXCEPTION 'installation_context_required' USING ERRCODE='23502';END IF;
PERFORM 1 FROM public.campagne_visuels_formats WHERE id=p_visuel_id FOR SHARE;
IF NOT p_sans_edt AND NOT EXISTS(SELECT 1 FROM public.visual_edt_associations a WHERE a.visual_id=p_visuel_id AND a.phase_id=p_edt_phase_id) THEN RAISE EXCEPTION 'visual_edt_association_required' USING ERRCODE='42501';END IF;
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur','Installateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF p_edt_phase_id IS NOT NULL THEN
IF (EXISTS(SELECT 1 FROM public.edt_phases sec_phase JOIN public.suivi_des_edt sec_edt ON sec_edt.id=sec_phase.edt_id WHERE sec_phase.id=p_edt_phase_id AND (sec_phase.client_id IS NULL OR sec_phase.client_id=sec_edt.client_id) AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'phase_scope_denied' USING ERRCODE='42501';END IF;
END IF;
IF (public.tos_table_resource_scope(NULL,p_support_id,NULL,(SELECT sec_phase.edt_id FROM public.edt_phases sec_phase WHERE sec_phase.id=p_edt_phase_id),false)) IS NOT TRUE THEN RAISE EXCEPTION 'support_scope_denied' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.campagne_visuels_formats sec_visual WHERE sec_visual.id=p_visuel_id AND public.tos_table_resource_scope(sec_visual.client_id,p_support_id,sec_visual.campagne_id,(SELECT sec_phase.edt_id FROM public.edt_phases sec_phase WHERE sec_phase.id=p_edt_phase_id),false))) IS NOT TRUE THEN RAISE EXCEPTION 'visual_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into v_user from public.utilisateurs where auth_user_id=auth.uid() and statut='Actif' limit 1;
  if not found or v_user.role not in ('Administrateur','Coordonnateur','Installateur') then raise exception 'terrain_role_denied' using errcode='42501'; end if;

  select * into v_infra from public.infrastructures where support_id=p_support_id for update;
  if not found then raise exception 'support_not_found'; end if;
  if p_edt_phase_id is not null then
  select e.* into v_edt from public.edt_phases ep
  join public.suivi_des_edt e on e.id=ep.edt_id
  where ep.id=p_edt_phase_id and ep.phase_type='installation' and e.archived_at is null;
  if not found then raise exception 'cross_context_support_denied' using errcode='42501'; end if;
  if v_infra.client_id is null or v_edt.client_id is null or v_infra.client_id<>v_edt.client_id then raise exception 'cross_client_denied' using errcode='42501'; end if;
  end if;
  if v_user.client_id is not null and v_user.client_id<>v_infra.client_id then raise exception 'cross_client_denied' using errcode='42501'; end if;

  select * into v_visual from public.campagne_visuels_formats where id=p_visuel_id and actif;
  if not found then raise exception 'visual_campaign_denied' using errcode='42501'; end if;
  select * into v_campaign from public.campagnes_maitres where id=v_visual.campagne_id and publiee_terrain and lower(coalesce(statut,''))='active';
  if not found or v_campaign.business_context not in ('marketing','operational_communication') then raise exception 'visual_campaign_denied' using errcode='42501'; end if;
  if v_campaign.id<>v_edt.campagne_id then raise exception 'visual_campaign_context_denied' using errcode='42501'; end if;
  if v_campaign.client_id is distinct from v_infra.client_id or v_visual.client_id is distinct from v_infra.client_id then raise exception 'cross_client_denied' using errcode='42501'; end if;
  if not public.terrain_visual_is_eligible_v1331(p_support_id,p_visuel_id) then raise exception 'visual_support_denied' using errcode='42501'; end if;
  v_email:=coalesce(nullif(v_user.courriel,''),(select email from auth.users where id=auth.uid()));

  if p_storage_path is null or left(p_storage_path,length('supports/'||p_support_id||'/')) is distinct from 'supports/'||p_support_id||'/'
     or p_storage_path ~ '(^|/)[.][.]?(/|$)|//|[?#%]'
     or not exists(select 1 from storage.objects o where o.bucket_id='terrain-photos' and o.name=p_storage_path and o.owner_id=auth.uid()::text)
  then raise exception 'photo_scope_denied' using errcode='42501';end if;
  p_photo_url:='terrain-photos/'||p_storage_path;
  select * into v_prior from public.terrain_operations where reference=v_ref for update;
  if found then
    if v_prior.support_id is distinct from p_support_id or v_prior.type_operation is distinct from 'installation' then raise exception 'terrain_idempotency_conflict' using errcode='40001';end if;
    if v_prior.statut='Réussie' then
      if (v_prior.details->>'edt_phase_id')::bigint is distinct from p_edt_phase_id or not exists(select 1 from public.support_photos p where p.id=(v_prior.details->>'photo_id')::bigint and p.support_id=p_support_id and p.storage_path=p_storage_path and p.visuel_id=p_visuel_id) then raise exception 'terrain_idempotency_conflict' using errcode='40001';end if;
      return jsonb_build_object('ok',true,'reference',v_ref,'support_id',p_support_id,'campagne',v_prior.details->>'campagne','visuel',v_prior.details->>'visuel','edt',v_prior.details->>'edt','edt_id',v_edt.id,'edt_phase_id',p_edt_phase_id,'photo_id',v_prior.details->'photo_id');
    end if;
  end if;
  insert into public.terrain_operations(reference,type_operation,support_id,utilisateur)
  values(v_ref,'installation',p_support_id,v_email)
  on conflict(reference) do update set reference=excluded.reference returning id into v_op;
  update public.support_photos set est_principale=false where support_id=p_support_id and est_principale;
  insert into public.support_photos(storage_bucket,client_id,support_id,campagne_id,visuel_id,type_photo,nom_fichier,storage_path,photo_url,thumbnail_url,prise_le,utilisateur,statut_validation,est_principale,validee_le)
  values('terrain-photos',v_infra.client_id,p_support_id,v_campaign.id,v_visual.id,'Installation',p_nom_fichier,p_storage_path,p_photo_url,p_photo_url,now(),v_email,'Validée',true,now()) on conflict do nothing;
  select * into v_photo from public.support_photos where support_id=p_support_id and storage_path=p_storage_path order by id desc limit 1;
  if not found then raise exception 'photo_not_persisted'; end if;

  update public.support_photos set edt_id=v_edt.id::text, metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('installation_sans_edt',p_sans_edt,'edt_number',v_edt.no_edt,'edt_phase_id',p_edt_phase_id,'operation_label',case when p_sans_edt then 'Installation sans EDT' else 'Installation' end) where id=v_photo.id;
  update public.infrastructures set
    campagne_precedente=case when campagne_actuelle is distinct from v_campaign.nom_campagne then campagne_actuelle else campagne_precedente end,
    visuel_precedent=case when visuel_campagne is distinct from v_visual.nom_visuel then visuel_campagne else visuel_precedent end,
    edt_precedent_associe=case when edt_associe is distinct from v_edt.no_edt then edt_associe else edt_precedent_associe end,
    campagne_actuelle=v_campaign.nom_campagne,campagne_selon_visuel=v_campaign.nom_campagne,
    visuel_campagne=v_visual.nom_visuel,visuel_en_expo=v_visual.nom_visuel,visuel_actuel_cadre=p_photo_url,
    visuel_id=v_visual.id,phase_campagne=v_visual.phase,format_visuel=v_visual.format_support,edt_associe=v_edt.no_edt,
    photo_principale_url=p_photo_url,photo_miniature_url=p_photo_url,date_derniere_manipulation=now()::text,
    commentaires=coalesce(nullif(p_commentaires,''),commentaires),updated_at=now()
  where support_id=p_support_id returning * into v_infra;

  insert into public.historique_des_campagnes(support_id,campagne,visuel,no_edt,date_installation,photo_installation,utilisateur,raw_data)
  values(p_support_id,v_campaign.nom_campagne,v_visual.nom_visuel,v_edt.no_edt,now()::text,p_photo_url,v_email,
    jsonb_build_object('reference',v_ref,'photo_id',v_photo.id,'source','v1.3.3.1','edt_id',v_edt.id,'edt_phase_id',p_edt_phase_id,'business_context',v_campaign.business_context,'installation_sans_edt',p_sans_edt,'operation_label',case when p_sans_edt then 'Installation sans EDT' else 'Installation' end));
  update public.edt_supports set statut='Terminé',progression=100,completed_at=coalesce(completed_at,now()),updated_at=now()
  where edt_id=v_edt.id and phase_id=p_edt_phase_id and support_id=p_support_id;
  if v_edt.id is not null then perform public.refresh_edt_enterprise(v_edt.id);end if;
  update public.terrain_operations set statut='Réussie',etape='Terminée',details=jsonb_build_object('campagne',v_campaign.nom_campagne,'visuel',v_visual.nom_visuel,'edt',v_edt.no_edt,'edt_phase_id',p_edt_phase_id,'photo_id',v_photo.id,'installation_sans_edt',p_sans_edt,'operation_label',case when p_sans_edt then 'Installation sans EDT' else 'Installation' end),completed_at=now() where id=v_op;
  return jsonb_build_object('ok',true,'reference',v_ref,'support_id',p_support_id,'campagne',v_campaign.nom_campagne,'visuel',v_visual.nom_visuel,'edt',v_edt.no_edt,'edt_id',v_edt.id,'edt_phase_id',p_edt_phase_id,'photo_id',v_photo.id,'installation_sans_edt',p_sans_edt,'operation_label',case when p_sans_edt then 'Installation sans EDT' else 'Installation' end);
exception when others then
  update public.terrain_operations set statut='Échouée',erreur=sqlerrm,etape='Annulée',completed_at=now() where reference=v_ref AND statut IS DISTINCT FROM 'Réussie';
  return jsonb_build_object('ok',false,'reference',v_ref,'message',sqlerrm,'code',sqlstate);
END;
END;
$function$
;
REVOKE ALL ON FUNCTION public.finaliser_installation_terrain_v1344(text,bigint,text,text,text,text,text,text,bigint,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finaliser_installation_terrain_v1344(text,bigint,text,text,text,text,text,text,bigint,boolean) TO authenticated;
