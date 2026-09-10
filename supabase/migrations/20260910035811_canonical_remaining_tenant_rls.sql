-- Canonical identity and tenant intersection; existing permissive operation rules remain authoritative.
CREATE OR REPLACE FUNCTION public.tos_remaining_tenant_scope(p_table text,p_row jsonb,p_action text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE r text:=public.tos_current_role();a bigint;c bigint;camp bigint;edt bigint;s text;linked_support text;v bigint;vc bigint;vca bigint;phase bigint;pe bigint;pc bigint;payload jsonb;
BEGIN
 IF auth.uid() IS NULL OR r IS NULL OR p_row IS NULL OR p_action IS NULL OR p_action NOT IN ('read','write') THEN RETURN false;END IF;
 SELECT u.client_id INTO a FROM public.utilisateurs u WHERE u.auth_user_id=auth.uid() AND lower(coalesce(u.statut,''))='actif';
 IF a IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients x WHERE x.id=a) THEN RETURN false;END IF;
 IF r IN ('Client','Client-Admin') AND a IS NULL THEN RETURN false;END IF;
 IF p_table='role_ui_permissions' THEN RETURN p_action='read' OR (r='Administrateur' AND a IS NULL);END IF;
 IF p_table IN ('automation_bindings','automation_definitions','admin_change_log','relation_execution_logs','relation_test_logs','c_i_avec_enjeux') THEN
  RETURN a IS NULL AND r IN ('Administrateur','Coordonnateur','Installateur');
 END IF;
 IF p_table='operations_history' THEN
  IF a IS NULL AND r IN ('Administrateur','Coordonnateur','Installateur') THEN RETURN true;END IF;
  IF jsonb_typeof(p_row->'new_data')='object' AND jsonb_typeof(p_row->'old_data')='object' AND nullif(p_row->'new_data'->>'client_id','') IS NOT NULL AND nullif(p_row->'old_data'->>'client_id','') IS NOT NULL AND p_row->'new_data'->>'client_id'<>p_row->'old_data'->>'client_id' THEN RETURN false;END IF;
  payload:=coalesce(p_row->'old_data','{}')||coalesce(p_row->'new_data','{}');
  RETURN public.tos_table_resource_scope(nullif(payload->>'client_id','')::bigint,nullif(payload->>'support_id',''),nullif(coalesce(payload->>'campagne_id',payload->>'campaign_id'),'')::bigint,nullif(payload->>'edt_id','')::bigint,false) IS TRUE;
 END IF;
 IF p_table NOT IN ('campagnes_maitres','campagnes_supports','edt_phase_reports','communications_finales','automation_resource_states','campagne_visuels_formats','reports','activity_events','edt_reports','requetes_clients','support_photos','photo_review_audit','email_outbox','email_delivery_log','terrain_sync_diagnostics','terrain_operations','client_campaign_access','client_member_invitations','campagnes_visuels_sites_supports','communications_operationnelles_sites_supports','client_request_supports') THEN RETURN false;END IF;
 -- Existing global internal reads include historical rows with legacy/unresolved references.
 IF p_action='read' AND a IS NULL AND r IN ('Administrateur','Coordonnateur','Installateur') THEN RETURN true;END IF;
 c:=nullif(p_row->>'client_id','')::bigint;s:=nullif(p_row->>'support_id','');
 camp:=nullif(coalesce(p_row->>'campagne_id',p_row->>'campaign_id'),'')::bigint;
 edt:=nullif(p_row->>'edt_id','')::bigint;
 IF nullif(p_row->>'target_client_id','') IS NOT NULL THEN
  IF c IS NOT NULL AND c<>(p_row->>'target_client_id')::bigint THEN RETURN false;END IF;
  IF public.tos_table_resource_scope((p_row->>'target_client_id')::bigint,nullif(p_row->>'target_support_id',''),null,null,false) IS NOT TRUE THEN RETURN false;END IF;
 END IF;
 IF nullif(p_row->>'infrastructure_id','') IS NOT NULL THEN
  SELECT i.client_id,i.support_id INTO vc,linked_support FROM public.infrastructures i WHERE i.id=(p_row->>'infrastructure_id')::bigint;
  IF NOT FOUND OR (c IS NOT NULL AND vc IS NOT NULL AND c<>vc) OR (s IS NOT NULL AND s<>linked_support) THEN RETURN false;END IF;
  c:=coalesce(c,vc);s:=coalesce(s,linked_support);
 END IF;
 IF p_table='client_campaign_access' THEN
  IF c IS NULL OR NOT EXISTS(SELECT 1 FROM public.utilisateurs u WHERE u.auth_user_id=(p_row->>'user_id')::uuid AND u.client_id=c AND lower(coalesce(u.statut,''))='actif' AND u.role IN ('Client','Client-Admin')) THEN RETURN false;END IF;
 END IF;
 IF p_table='campagnes_maitres' THEN camp:=NULL;IF c IS NULL THEN RETURN false;END IF;END IF;
 IF p_table='client_request_supports' THEN
  SELECT q.client_id INTO c FROM public.requetes_clients q WHERE q.id=(p_row->>'request_id')::bigint;
  IF NOT FOUND OR c IS NULL THEN RETURN false;END IF;
 END IF;
 IF p_table='photo_review_audit' THEN
  SELECT p.client_id,p.support_id,p.campagne_id INTO vc,s,camp FROM public.support_photos p WHERE p.id=(p_row->>'photo_id')::bigint;
  IF NOT FOUND OR (c IS NOT NULL AND vc IS NOT NULL AND c<>vc) THEN RETURN false;END IF;c:=coalesce(c,vc);
 END IF;
 v:=nullif(coalesce(p_row->>'visual_id',p_row->>'visuel_id'),'')::bigint;
 IF v IS NOT NULL THEN
  SELECT f.client_id,f.campagne_id INTO vc,vca FROM public.campagne_visuels_formats f WHERE f.id=v;
  IF NOT FOUND OR (c IS NOT NULL AND vc IS NOT NULL AND c<>vc) OR (camp IS NOT NULL AND vca IS NOT NULL AND camp<>vca) THEN RETURN false;END IF;
  c:=coalesce(c,vc);camp:=coalesce(camp,vca);
 END IF;
 phase:=nullif(coalesce(p_row->>'phase_id',p_row->>'edt_phase_id'),'')::bigint;
 IF phase IS NOT NULL THEN
  SELECT p.edt_id,p.client_id INTO pe,pc FROM public.edt_phases p WHERE p.id=phase;
  IF NOT FOUND OR pe IS NULL OR (edt IS NOT NULL AND edt<>pe) OR (c IS NOT NULL AND pc IS NOT NULL AND c<>pc) THEN RETURN false;END IF;
  edt:=pe;c:=coalesce(c,pc);
 END IF;
 RETURN public.tos_table_resource_scope(c,s,camp,edt,p_table IN ('automation_resource_states','activity_events','support_photos','photo_review_audit','terrain_operations')) IS TRUE;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END $fn$;
REVOKE ALL ON FUNCTION public.tos_remaining_tenant_scope(text,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tos_remaining_tenant_scope(text,jsonb,text) TO authenticated;

ALTER TABLE public.role_ui_permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.role_ui_permissions FROM PUBLIC,anon;
CREATE POLICY final_tenant_read ON public.role_ui_permissions AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_remaining_tenant_scope('role_ui_permissions',to_jsonb(role_ui_permissions),'read') IS TRUE);
CREATE POLICY final_tenant_insert ON public.role_ui_permissions AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_remaining_tenant_scope('role_ui_permissions',to_jsonb(role_ui_permissions),'write') IS TRUE);
CREATE POLICY final_tenant_update ON public.role_ui_permissions AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_remaining_tenant_scope('role_ui_permissions',to_jsonb(role_ui_permissions),'write') IS TRUE) WITH CHECK (public.tos_remaining_tenant_scope('role_ui_permissions',to_jsonb(role_ui_permissions),'write') IS TRUE);
CREATE POLICY final_tenant_delete ON public.role_ui_permissions AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_remaining_tenant_scope('role_ui_permissions',to_jsonb(role_ui_permissions),'write') IS TRUE);

ALTER TABLE public.automation_bindings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.automation_bindings FROM PUBLIC,anon;
CREATE POLICY final_tenant_read ON public.automation_bindings AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_remaining_tenant_scope('automation_bindings',to_jsonb(automation_bindings),'read') IS TRUE);
CREATE POLICY final_tenant_insert ON public.automation_bindings AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_remaining_tenant_scope('automation_bindings',to_jsonb(automation_bindings),'write') IS TRUE);
CREATE POLICY final_tenant_update ON public.automation_bindings AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_remaining_tenant_scope('automation_bindings',to_jsonb(automation_bindings),'write') IS TRUE) WITH CHECK (public.tos_remaining_tenant_scope('automation_bindings',to_jsonb(automation_bindings),'write') IS TRUE);
CREATE POLICY final_tenant_delete ON public.automation_bindings AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_remaining_tenant_scope('automation_bindings',to_jsonb(automation_bindings),'write') IS TRUE);

ALTER TABLE public.automation_definitions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.automation_definitions FROM PUBLIC,anon;
CREATE POLICY final_tenant_read ON public.automation_definitions AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_remaining_tenant_scope('automation_definitions',to_jsonb(automation_definitions),'read') IS TRUE);
CREATE POLICY final_tenant_insert ON public.automation_definitions AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_remaining_tenant_scope('automation_definitions',to_jsonb(automation_definitions),'write') IS TRUE);
CREATE POLICY final_tenant_update ON public.automation_definitions AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_remaining_tenant_scope('automation_definitions',to_jsonb(automation_definitions),'write') IS TRUE) WITH CHECK (public.tos_remaining_tenant_scope('automation_definitions',to_jsonb(automation_definitions),'write') IS TRUE);
CREATE POLICY final_tenant_delete ON public.automation_definitions AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_remaining_tenant_scope('automation_definitions',to_jsonb(automation_definitions),'write') IS TRUE);

ALTER TABLE public.admin_change_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_change_log FROM PUBLIC,anon;
CREATE POLICY final_tenant_read ON public.admin_change_log AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_remaining_tenant_scope('admin_change_log',to_jsonb(admin_change_log),'read') IS TRUE);
CREATE POLICY final_tenant_insert ON public.admin_change_log AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_remaining_tenant_scope('admin_change_log',to_jsonb(admin_change_log),'write') IS TRUE);
CREATE POLICY final_tenant_update ON public.admin_change_log AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_remaining_tenant_scope('admin_change_log',to_jsonb(admin_change_log),'write') IS TRUE) WITH CHECK (public.tos_remaining_tenant_scope('admin_change_log',to_jsonb(admin_change_log),'write') IS TRUE);
CREATE POLICY final_tenant_delete ON public.admin_change_log AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_remaining_tenant_scope('admin_change_log',to_jsonb(admin_change_log),'write') IS TRUE);

ALTER TABLE public.relation_execution_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.relation_execution_logs FROM PUBLIC,anon;
CREATE POLICY final_tenant_read ON public.relation_execution_logs AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_remaining_tenant_scope('relation_execution_logs',to_jsonb(relation_execution_logs),'read') IS TRUE);
CREATE POLICY final_tenant_insert ON public.relation_execution_logs AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_remaining_tenant_scope('relation_execution_logs',to_jsonb(relation_execution_logs),'write') IS TRUE);
CREATE POLICY final_tenant_update ON public.relation_execution_logs AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_remaining_tenant_scope('relation_execution_logs',to_jsonb(relation_execution_logs),'write') IS TRUE) WITH CHECK (public.tos_remaining_tenant_scope('relation_execution_logs',to_jsonb(relation_execution_logs),'write') IS TRUE);
CREATE POLICY final_tenant_delete ON public.relation_execution_logs AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_remaining_tenant_scope('relation_execution_logs',to_jsonb(relation_execution_logs),'write') IS TRUE);

ALTER TABLE public.relation_test_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.relation_test_logs FROM PUBLIC,anon;
CREATE POLICY final_tenant_read ON public.relation_test_logs AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_remaining_tenant_scope('relation_test_logs',to_jsonb(relation_test_logs),'read') IS TRUE);
CREATE POLICY final_tenant_insert ON public.relation_test_logs AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_remaining_tenant_scope('relation_test_logs',to_jsonb(relation_test_logs),'write') IS TRUE);
CREATE POLICY final_tenant_update ON public.relation_test_logs AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_remaining_tenant_scope('relation_test_logs',to_jsonb(relation_test_logs),'write') IS TRUE) WITH CHECK (public.tos_remaining_tenant_scope('relation_test_logs',to_jsonb(relation_test_logs),'write') IS TRUE);
CREATE POLICY final_tenant_delete ON public.relation_test_logs AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_remaining_tenant_scope('relation_test_logs',to_jsonb(relation_test_logs),'write') IS TRUE);

ALTER TABLE public.c_i_avec_enjeux ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.c_i_avec_enjeux FROM PUBLIC,anon;
CREATE POLICY final_tenant_read ON public.c_i_avec_enjeux AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_remaining_tenant_scope('c_i_avec_enjeux',to_jsonb(c_i_avec_enjeux),'read') IS TRUE);
CREATE POLICY final_tenant_insert ON public.c_i_avec_enjeux AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_remaining_tenant_scope('c_i_avec_enjeux',to_jsonb(c_i_avec_enjeux),'write') IS TRUE);
CREATE POLICY final_tenant_update ON public.c_i_avec_enjeux AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_remaining_tenant_scope('c_i_avec_enjeux',to_jsonb(c_i_avec_enjeux),'write') IS TRUE) WITH CHECK (public.tos_remaining_tenant_scope('c_i_avec_enjeux',to_jsonb(c_i_avec_enjeux),'write') IS TRUE);
CREATE POLICY final_tenant_delete ON public.c_i_avec_enjeux AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_remaining_tenant_scope('c_i_avec_enjeux',to_jsonb(c_i_avec_enjeux),'write') IS TRUE);

ALTER TABLE public.operations_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.operations_history FROM PUBLIC,anon;
CREATE POLICY final_tenant_read ON public.operations_history AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_remaining_tenant_scope('operations_history',to_jsonb(operations_history),'read') IS TRUE);
CREATE POLICY final_tenant_insert ON public.operations_history AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_remaining_tenant_scope('operations_history',to_jsonb(operations_history),'write') IS TRUE);
CREATE POLICY final_tenant_update ON public.operations_history AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_remaining_tenant_scope('operations_history',to_jsonb(operations_history),'write') IS TRUE) WITH CHECK (public.tos_remaining_tenant_scope('operations_history',to_jsonb(operations_history),'write') IS TRUE);
CREATE POLICY final_tenant_delete ON public.operations_history AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_remaining_tenant_scope('operations_history',to_jsonb(operations_history),'write') IS TRUE);

ALTER TABLE public.campagnes_maitres ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.campagnes_maitres FROM PUBLIC,anon;
CREATE POLICY final_tenant_read ON public.campagnes_maitres AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_remaining_tenant_scope('campagnes_maitres',to_jsonb(campagnes_maitres),'read') IS TRUE);
CREATE POLICY final_tenant_insert ON public.campagnes_maitres AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_remaining_tenant_scope('campagnes_maitres',to_jsonb(campagnes_maitres),'write') IS TRUE);
CREATE POLICY final_tenant_update ON public.campagnes_maitres AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_remaining_tenant_scope('campagnes_maitres',to_jsonb(campagnes_maitres),'write') IS TRUE) WITH CHECK (public.tos_remaining_tenant_scope('campagnes_maitres',to_jsonb(campagnes_maitres),'write') IS TRUE);
CREATE POLICY final_tenant_delete ON public.campagnes_maitres AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_remaining_tenant_scope('campagnes_maitres',to_jsonb(campagnes_maitres),'write') IS TRUE);

ALTER TABLE public.campagnes_supports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.campagnes_supports FROM PUBLIC,anon;
CREATE POLICY final_tenant_read ON public.campagnes_supports AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_remaining_tenant_scope('campagnes_supports',to_jsonb(campagnes_supports),'read') IS TRUE);
CREATE POLICY final_tenant_insert ON public.campagnes_supports AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_remaining_tenant_scope('campagnes_supports',to_jsonb(campagnes_supports),'write') IS TRUE);
CREATE POLICY final_tenant_update ON public.campagnes_supports AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_remaining_tenant_scope('campagnes_supports',to_jsonb(campagnes_supports),'write') IS TRUE) WITH CHECK (public.tos_remaining_tenant_scope('campagnes_supports',to_jsonb(campagnes_supports),'write') IS TRUE);
CREATE POLICY final_tenant_delete ON public.campagnes_supports AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_remaining_tenant_scope('campagnes_supports',to_jsonb(campagnes_supports),'write') IS TRUE);

ALTER TABLE public.edt_phase_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.edt_phase_reports FROM PUBLIC,anon;
CREATE POLICY final_tenant_read ON public.edt_phase_reports AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_remaining_tenant_scope('edt_phase_reports',to_jsonb(edt_phase_reports),'read') IS TRUE);
CREATE POLICY final_tenant_insert ON public.edt_phase_reports AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_remaining_tenant_scope('edt_phase_reports',to_jsonb(edt_phase_reports),'write') IS TRUE);
CREATE POLICY final_tenant_update ON public.edt_phase_reports AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_remaining_tenant_scope('edt_phase_reports',to_jsonb(edt_phase_reports),'write') IS TRUE) WITH CHECK (public.tos_remaining_tenant_scope('edt_phase_reports',to_jsonb(edt_phase_reports),'write') IS TRUE);
CREATE POLICY final_tenant_delete ON public.edt_phase_reports AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_remaining_tenant_scope('edt_phase_reports',to_jsonb(edt_phase_reports),'write') IS TRUE);

ALTER TABLE public.communications_finales ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.communications_finales FROM PUBLIC,anon;
CREATE POLICY final_tenant_read ON public.communications_finales AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_remaining_tenant_scope('communications_finales',to_jsonb(communications_finales),'read') IS TRUE);
CREATE POLICY final_tenant_insert ON public.communications_finales AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_remaining_tenant_scope('communications_finales',to_jsonb(communications_finales),'write') IS TRUE);
CREATE POLICY final_tenant_update ON public.communications_finales AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_remaining_tenant_scope('communications_finales',to_jsonb(communications_finales),'write') IS TRUE) WITH CHECK (public.tos_remaining_tenant_scope('communications_finales',to_jsonb(communications_finales),'write') IS TRUE);
CREATE POLICY final_tenant_delete ON public.communications_finales AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_remaining_tenant_scope('communications_finales',to_jsonb(communications_finales),'write') IS TRUE);

ALTER TABLE public.automation_resource_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.automation_resource_states FROM PUBLIC,anon;
CREATE POLICY final_tenant_read ON public.automation_resource_states AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_remaining_tenant_scope('automation_resource_states',to_jsonb(automation_resource_states),'read') IS TRUE);
CREATE POLICY final_tenant_insert ON public.automation_resource_states AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_remaining_tenant_scope('automation_resource_states',to_jsonb(automation_resource_states),'write') IS TRUE);
CREATE POLICY final_tenant_update ON public.automation_resource_states AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_remaining_tenant_scope('automation_resource_states',to_jsonb(automation_resource_states),'write') IS TRUE) WITH CHECK (public.tos_remaining_tenant_scope('automation_resource_states',to_jsonb(automation_resource_states),'write') IS TRUE);
CREATE POLICY final_tenant_delete ON public.automation_resource_states AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_remaining_tenant_scope('automation_resource_states',to_jsonb(automation_resource_states),'write') IS TRUE);

ALTER TABLE public.campagne_visuels_formats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.campagne_visuels_formats FROM PUBLIC,anon;
CREATE POLICY final_tenant_read ON public.campagne_visuels_formats AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_remaining_tenant_scope('campagne_visuels_formats',to_jsonb(campagne_visuels_formats),'read') IS TRUE);
CREATE POLICY final_tenant_insert ON public.campagne_visuels_formats AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_remaining_tenant_scope('campagne_visuels_formats',to_jsonb(campagne_visuels_formats),'write') IS TRUE);
CREATE POLICY final_tenant_update ON public.campagne_visuels_formats AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_remaining_tenant_scope('campagne_visuels_formats',to_jsonb(campagne_visuels_formats),'write') IS TRUE) WITH CHECK (public.tos_remaining_tenant_scope('campagne_visuels_formats',to_jsonb(campagne_visuels_formats),'write') IS TRUE);
CREATE POLICY final_tenant_delete ON public.campagne_visuels_formats AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_remaining_tenant_scope('campagne_visuels_formats',to_jsonb(campagne_visuels_formats),'write') IS TRUE);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reports FROM PUBLIC,anon;
CREATE POLICY final_tenant_read ON public.reports AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_remaining_tenant_scope('reports',to_jsonb(reports),'read') IS TRUE);
CREATE POLICY final_tenant_insert ON public.reports AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_remaining_tenant_scope('reports',to_jsonb(reports),'write') IS TRUE);
CREATE POLICY final_tenant_update ON public.reports AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_remaining_tenant_scope('reports',to_jsonb(reports),'write') IS TRUE) WITH CHECK (public.tos_remaining_tenant_scope('reports',to_jsonb(reports),'write') IS TRUE);
CREATE POLICY final_tenant_delete ON public.reports AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_remaining_tenant_scope('reports',to_jsonb(reports),'write') IS TRUE);

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.activity_events FROM PUBLIC,anon;
CREATE POLICY final_tenant_read ON public.activity_events AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_remaining_tenant_scope('activity_events',to_jsonb(activity_events),'read') IS TRUE);
CREATE POLICY final_tenant_insert ON public.activity_events AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_remaining_tenant_scope('activity_events',to_jsonb(activity_events),'write') IS TRUE);
CREATE POLICY final_tenant_update ON public.activity_events AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_remaining_tenant_scope('activity_events',to_jsonb(activity_events),'write') IS TRUE) WITH CHECK (public.tos_remaining_tenant_scope('activity_events',to_jsonb(activity_events),'write') IS TRUE);
CREATE POLICY final_tenant_delete ON public.activity_events AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_remaining_tenant_scope('activity_events',to_jsonb(activity_events),'write') IS TRUE);

ALTER TABLE public.edt_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.edt_reports FROM PUBLIC,anon;
CREATE POLICY final_tenant_read ON public.edt_reports AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_remaining_tenant_scope('edt_reports',to_jsonb(edt_reports),'read') IS TRUE);
CREATE POLICY final_tenant_insert ON public.edt_reports AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_remaining_tenant_scope('edt_reports',to_jsonb(edt_reports),'write') IS TRUE);
CREATE POLICY final_tenant_update ON public.edt_reports AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_remaining_tenant_scope('edt_reports',to_jsonb(edt_reports),'write') IS TRUE) WITH CHECK (public.tos_remaining_tenant_scope('edt_reports',to_jsonb(edt_reports),'write') IS TRUE);
CREATE POLICY final_tenant_delete ON public.edt_reports AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_remaining_tenant_scope('edt_reports',to_jsonb(edt_reports),'write') IS TRUE);

ALTER TABLE public.requetes_clients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.requetes_clients FROM PUBLIC,anon;
CREATE POLICY final_tenant_read ON public.requetes_clients AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_remaining_tenant_scope('requetes_clients',to_jsonb(requetes_clients),'read') IS TRUE);
CREATE POLICY final_tenant_insert ON public.requetes_clients AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_remaining_tenant_scope('requetes_clients',to_jsonb(requetes_clients),'write') IS TRUE);
CREATE POLICY final_tenant_update ON public.requetes_clients AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_remaining_tenant_scope('requetes_clients',to_jsonb(requetes_clients),'write') IS TRUE) WITH CHECK (public.tos_remaining_tenant_scope('requetes_clients',to_jsonb(requetes_clients),'write') IS TRUE);
CREATE POLICY final_tenant_delete ON public.requetes_clients AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_remaining_tenant_scope('requetes_clients',to_jsonb(requetes_clients),'write') IS TRUE);

ALTER TABLE public.support_photos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_photos FROM PUBLIC,anon;
CREATE POLICY final_tenant_read ON public.support_photos AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_remaining_tenant_scope('support_photos',to_jsonb(support_photos),'read') IS TRUE);
CREATE POLICY final_tenant_insert ON public.support_photos AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_remaining_tenant_scope('support_photos',to_jsonb(support_photos),'write') IS TRUE);
CREATE POLICY final_tenant_update ON public.support_photos AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_remaining_tenant_scope('support_photos',to_jsonb(support_photos),'write') IS TRUE) WITH CHECK (public.tos_remaining_tenant_scope('support_photos',to_jsonb(support_photos),'write') IS TRUE);
CREATE POLICY final_tenant_delete ON public.support_photos AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_remaining_tenant_scope('support_photos',to_jsonb(support_photos),'write') IS TRUE);

ALTER TABLE public.photo_review_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.photo_review_audit FROM PUBLIC,anon;
CREATE POLICY final_tenant_read ON public.photo_review_audit AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_remaining_tenant_scope('photo_review_audit',to_jsonb(photo_review_audit),'read') IS TRUE);
CREATE POLICY final_tenant_insert ON public.photo_review_audit AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_remaining_tenant_scope('photo_review_audit',to_jsonb(photo_review_audit),'write') IS TRUE);
CREATE POLICY final_tenant_update ON public.photo_review_audit AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_remaining_tenant_scope('photo_review_audit',to_jsonb(photo_review_audit),'write') IS TRUE) WITH CHECK (public.tos_remaining_tenant_scope('photo_review_audit',to_jsonb(photo_review_audit),'write') IS TRUE);
CREATE POLICY final_tenant_delete ON public.photo_review_audit AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_remaining_tenant_scope('photo_review_audit',to_jsonb(photo_review_audit),'write') IS TRUE);

ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_outbox FROM PUBLIC,anon;
CREATE POLICY final_tenant_read ON public.email_outbox AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_remaining_tenant_scope('email_outbox',to_jsonb(email_outbox),'read') IS TRUE);
CREATE POLICY final_tenant_insert ON public.email_outbox AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_remaining_tenant_scope('email_outbox',to_jsonb(email_outbox),'write') IS TRUE);
CREATE POLICY final_tenant_update ON public.email_outbox AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_remaining_tenant_scope('email_outbox',to_jsonb(email_outbox),'write') IS TRUE) WITH CHECK (public.tos_remaining_tenant_scope('email_outbox',to_jsonb(email_outbox),'write') IS TRUE);
CREATE POLICY final_tenant_delete ON public.email_outbox AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_remaining_tenant_scope('email_outbox',to_jsonb(email_outbox),'write') IS TRUE);

ALTER TABLE public.email_delivery_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_delivery_log FROM PUBLIC,anon;
CREATE POLICY final_tenant_read ON public.email_delivery_log AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_remaining_tenant_scope('email_delivery_log',to_jsonb(email_delivery_log),'read') IS TRUE);
CREATE POLICY final_tenant_insert ON public.email_delivery_log AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_remaining_tenant_scope('email_delivery_log',to_jsonb(email_delivery_log),'write') IS TRUE);
CREATE POLICY final_tenant_update ON public.email_delivery_log AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_remaining_tenant_scope('email_delivery_log',to_jsonb(email_delivery_log),'write') IS TRUE) WITH CHECK (public.tos_remaining_tenant_scope('email_delivery_log',to_jsonb(email_delivery_log),'write') IS TRUE);
CREATE POLICY final_tenant_delete ON public.email_delivery_log AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_remaining_tenant_scope('email_delivery_log',to_jsonb(email_delivery_log),'write') IS TRUE);

ALTER TABLE public.terrain_sync_diagnostics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.terrain_sync_diagnostics FROM PUBLIC,anon;
CREATE POLICY final_tenant_read ON public.terrain_sync_diagnostics AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_remaining_tenant_scope('terrain_sync_diagnostics',to_jsonb(terrain_sync_diagnostics),'read') IS TRUE);
CREATE POLICY final_tenant_insert ON public.terrain_sync_diagnostics AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_remaining_tenant_scope('terrain_sync_diagnostics',to_jsonb(terrain_sync_diagnostics),'write') IS TRUE);
CREATE POLICY final_tenant_update ON public.terrain_sync_diagnostics AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_remaining_tenant_scope('terrain_sync_diagnostics',to_jsonb(terrain_sync_diagnostics),'write') IS TRUE) WITH CHECK (public.tos_remaining_tenant_scope('terrain_sync_diagnostics',to_jsonb(terrain_sync_diagnostics),'write') IS TRUE);
CREATE POLICY final_tenant_delete ON public.terrain_sync_diagnostics AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_remaining_tenant_scope('terrain_sync_diagnostics',to_jsonb(terrain_sync_diagnostics),'write') IS TRUE);

ALTER TABLE public.terrain_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.terrain_operations FROM PUBLIC,anon;
CREATE POLICY final_tenant_read ON public.terrain_operations AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_remaining_tenant_scope('terrain_operations',to_jsonb(terrain_operations),'read') IS TRUE);
CREATE POLICY final_tenant_insert ON public.terrain_operations AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_remaining_tenant_scope('terrain_operations',to_jsonb(terrain_operations),'write') IS TRUE);
CREATE POLICY final_tenant_update ON public.terrain_operations AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_remaining_tenant_scope('terrain_operations',to_jsonb(terrain_operations),'write') IS TRUE) WITH CHECK (public.tos_remaining_tenant_scope('terrain_operations',to_jsonb(terrain_operations),'write') IS TRUE);
CREATE POLICY final_tenant_delete ON public.terrain_operations AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_remaining_tenant_scope('terrain_operations',to_jsonb(terrain_operations),'write') IS TRUE);

ALTER TABLE public.client_campaign_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_campaign_access FROM PUBLIC,anon;
CREATE POLICY final_tenant_read ON public.client_campaign_access AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_remaining_tenant_scope('client_campaign_access',to_jsonb(client_campaign_access),'read') IS TRUE);
CREATE POLICY final_tenant_insert ON public.client_campaign_access AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_remaining_tenant_scope('client_campaign_access',to_jsonb(client_campaign_access),'write') IS TRUE);
CREATE POLICY final_tenant_update ON public.client_campaign_access AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_remaining_tenant_scope('client_campaign_access',to_jsonb(client_campaign_access),'write') IS TRUE) WITH CHECK (public.tos_remaining_tenant_scope('client_campaign_access',to_jsonb(client_campaign_access),'write') IS TRUE);
CREATE POLICY final_tenant_delete ON public.client_campaign_access AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_remaining_tenant_scope('client_campaign_access',to_jsonb(client_campaign_access),'write') IS TRUE);

ALTER TABLE public.client_member_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_member_invitations FROM PUBLIC,anon;
CREATE POLICY final_tenant_read ON public.client_member_invitations AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_remaining_tenant_scope('client_member_invitations',to_jsonb(client_member_invitations),'read') IS TRUE);
CREATE POLICY final_tenant_insert ON public.client_member_invitations AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_remaining_tenant_scope('client_member_invitations',to_jsonb(client_member_invitations),'write') IS TRUE);
CREATE POLICY final_tenant_update ON public.client_member_invitations AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_remaining_tenant_scope('client_member_invitations',to_jsonb(client_member_invitations),'write') IS TRUE) WITH CHECK (public.tos_remaining_tenant_scope('client_member_invitations',to_jsonb(client_member_invitations),'write') IS TRUE);
CREATE POLICY final_tenant_delete ON public.client_member_invitations AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_remaining_tenant_scope('client_member_invitations',to_jsonb(client_member_invitations),'write') IS TRUE);

ALTER TABLE public.campagnes_visuels_sites_supports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.campagnes_visuels_sites_supports FROM PUBLIC,anon;
CREATE POLICY final_tenant_read ON public.campagnes_visuels_sites_supports AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_remaining_tenant_scope('campagnes_visuels_sites_supports',to_jsonb(campagnes_visuels_sites_supports),'read') IS TRUE);
CREATE POLICY final_tenant_insert ON public.campagnes_visuels_sites_supports AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_remaining_tenant_scope('campagnes_visuels_sites_supports',to_jsonb(campagnes_visuels_sites_supports),'write') IS TRUE);
CREATE POLICY final_tenant_update ON public.campagnes_visuels_sites_supports AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_remaining_tenant_scope('campagnes_visuels_sites_supports',to_jsonb(campagnes_visuels_sites_supports),'write') IS TRUE) WITH CHECK (public.tos_remaining_tenant_scope('campagnes_visuels_sites_supports',to_jsonb(campagnes_visuels_sites_supports),'write') IS TRUE);
CREATE POLICY final_tenant_delete ON public.campagnes_visuels_sites_supports AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_remaining_tenant_scope('campagnes_visuels_sites_supports',to_jsonb(campagnes_visuels_sites_supports),'write') IS TRUE);

ALTER TABLE public.communications_operationnelles_sites_supports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.communications_operationnelles_sites_supports FROM PUBLIC,anon;
CREATE POLICY final_tenant_read ON public.communications_operationnelles_sites_supports AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_remaining_tenant_scope('communications_operationnelles_sites_supports',to_jsonb(communications_operationnelles_sites_supports),'read') IS TRUE);
CREATE POLICY final_tenant_insert ON public.communications_operationnelles_sites_supports AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_remaining_tenant_scope('communications_operationnelles_sites_supports',to_jsonb(communications_operationnelles_sites_supports),'write') IS TRUE);
CREATE POLICY final_tenant_update ON public.communications_operationnelles_sites_supports AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_remaining_tenant_scope('communications_operationnelles_sites_supports',to_jsonb(communications_operationnelles_sites_supports),'write') IS TRUE) WITH CHECK (public.tos_remaining_tenant_scope('communications_operationnelles_sites_supports',to_jsonb(communications_operationnelles_sites_supports),'write') IS TRUE);
CREATE POLICY final_tenant_delete ON public.communications_operationnelles_sites_supports AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_remaining_tenant_scope('communications_operationnelles_sites_supports',to_jsonb(communications_operationnelles_sites_supports),'write') IS TRUE);

ALTER TABLE public.client_request_supports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_request_supports FROM PUBLIC,anon;
CREATE POLICY final_tenant_read ON public.client_request_supports AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_remaining_tenant_scope('client_request_supports',to_jsonb(client_request_supports),'read') IS TRUE);
CREATE POLICY final_tenant_insert ON public.client_request_supports AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_remaining_tenant_scope('client_request_supports',to_jsonb(client_request_supports),'write') IS TRUE);
CREATE POLICY final_tenant_update ON public.client_request_supports AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_remaining_tenant_scope('client_request_supports',to_jsonb(client_request_supports),'write') IS TRUE) WITH CHECK (public.tos_remaining_tenant_scope('client_request_supports',to_jsonb(client_request_supports),'write') IS TRUE);
CREATE POLICY final_tenant_delete ON public.client_request_supports AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_remaining_tenant_scope('client_request_supports',to_jsonb(client_request_supports),'write') IS TRUE);
