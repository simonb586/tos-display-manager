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
  FOR payload IN SELECT value FROM jsonb_array_elements(jsonb_build_array(p_row->'old_data',p_row->'new_data')) LOOP
   IF jsonb_typeof(payload)='object' AND coalesce(nullif(payload->>'client_id',''),nullif(payload->>'support_id',''),nullif(payload->>'campagne_id',''),nullif(payload->>'campaign_id',''),nullif(payload->>'edt_id','')) IS NOT NULL
    AND public.tos_table_resource_scope(nullif(payload->>'client_id','')::bigint,nullif(payload->>'support_id',''),nullif(coalesce(payload->>'campagne_id',payload->>'campaign_id'),'')::bigint,nullif(payload->>'edt_id','')::bigint,false) IS NOT TRUE THEN RETURN false;END IF;
  END LOOP;
  payload:=(CASE WHEN jsonb_typeof(p_row->'old_data')='object' THEN p_row->'old_data' ELSE '{}'::jsonb END)||(CASE WHEN jsonb_typeof(p_row->'new_data')='object' THEN p_row->'new_data' ELSE '{}'::jsonb END);
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
