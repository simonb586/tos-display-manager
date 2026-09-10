-- Restrictive fences preserve existing permissive permissions and narrow identity/ownership.
CREATE OR REPLACE FUNCTION public.tos_private_seven_scope(p_table text,p_row jsonb,p_action text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $function$
DECLARE r text:=public.tos_current_role();actor_client bigint;owner_client bigint;edt bigint;campaign bigint;support text;phase bigint;phase_edt bigint;phase_client bigint;
BEGIN
 IF auth.uid() IS NULL OR r IS NULL OR p_action IS NULL OR p_action NOT IN ('read','write') OR p_row IS NULL THEN RETURN false;END IF;
 SELECT u.client_id INTO actor_client FROM public.utilisateurs u WHERE u.auth_user_id=auth.uid() AND lower(coalesce(u.statut,''))='actif';
 IF actor_client IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients c WHERE c.id=actor_client) THEN RETURN false;END IF;
 IF r IN ('Client','Client-Admin') AND actor_client IS NULL THEN RETURN false;END IF;
 IF p_table IN ('relation_fields','relation_rules') THEN
  -- Shared rendering/Studio metadata have no tenant owner. Write is global-admin only.
  RETURN p_action='read' OR (r='Administrateur' AND actor_client IS NULL);
 END IF;
 IF p_action='write' AND r NOT IN ('Administrateur','Coordonnateur','Installateur') THEN RETURN false;END IF;
 owner_client:=nullif(p_row->>'client_id','')::bigint;
 support:=nullif(p_row->>'support_id','');
 IF p_table='edt_phases' THEN edt:=(p_row->>'edt_id')::bigint;IF edt IS NULL THEN RETURN false;END IF;
 ELSIF p_table='edt_supports' THEN edt:=(p_row->>'edt_id')::bigint;phase:=(p_row->>'phase_id')::bigint;IF edt IS NULL OR support IS NULL THEN RETURN false;END IF;
 ELSIF p_table='enjeux_terrain' THEN phase:=(p_row->>'edt_phase_id')::bigint;IF support IS NULL THEN RETURN false;END IF;IF r IN ('Client','Client-Admin') AND (p_row->>'client_visible')::boolean IS NOT TRUE THEN RETURN false;END IF;
 ELSIF p_table='inspections_terrain' THEN campaign:=(p_row->>'campagne_id')::bigint;IF support IS NULL THEN RETURN false;END IF;
 ELSIF p_table='photo_action_log' THEN NULL;
 ELSE RETURN false;END IF;
 IF phase IS NOT NULL THEN
  SELECT p.edt_id,p.client_id INTO phase_edt,phase_client FROM public.edt_phases p WHERE p.id=phase;
  IF NOT FOUND OR phase_edt IS NULL OR (edt IS NOT NULL AND edt<>phase_edt) OR (owner_client IS NOT NULL AND phase_client IS NOT NULL AND owner_client<>phase_client) THEN RETURN false;END IF;
  edt:=phase_edt;owner_client:=coalesce(owner_client,phase_client);
 END IF;
 IF public.tos_table_resource_scope(owner_client,support,campaign,edt,p_table='photo_action_log') IS NOT TRUE THEN RETURN false;END IF;
 IF r IN ('Client','Client-Admin') THEN
  IF edt IS NOT NULL THEN SELECT e.campagne_id INTO campaign FROM public.suivi_des_edt e WHERE e.id=edt;END IF;
  IF campaign IS NOT NULL AND public.client_can_access_campaign_v120(campaign) IS NOT TRUE THEN RETURN false;END IF;
 END IF;
 RETURN true;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END $function$;
REVOKE ALL ON FUNCTION public.tos_private_seven_scope(text,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tos_private_seven_scope(text,jsonb,text) TO authenticated;

ALTER TABLE public.edt_phases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.edt_phases FROM PUBLIC,anon;
CREATE POLICY final_seven_read_fence ON public.edt_phases AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_private_seven_scope('edt_phases',to_jsonb(edt_phases),'read') IS TRUE);
CREATE POLICY final_seven_insert_fence ON public.edt_phases AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_private_seven_scope('edt_phases',to_jsonb(edt_phases),'write') IS TRUE);
CREATE POLICY final_seven_update_fence ON public.edt_phases AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_private_seven_scope('edt_phases',to_jsonb(edt_phases),'write') IS TRUE) WITH CHECK (public.tos_private_seven_scope('edt_phases',to_jsonb(edt_phases),'write') IS TRUE);
CREATE POLICY final_seven_delete_fence ON public.edt_phases AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_private_seven_scope('edt_phases',to_jsonb(edt_phases),'write') IS TRUE);

ALTER TABLE public.edt_supports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.edt_supports FROM PUBLIC,anon;
CREATE POLICY final_seven_read_fence ON public.edt_supports AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_private_seven_scope('edt_supports',to_jsonb(edt_supports),'read') IS TRUE);
CREATE POLICY final_seven_insert_fence ON public.edt_supports AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_private_seven_scope('edt_supports',to_jsonb(edt_supports),'write') IS TRUE);
CREATE POLICY final_seven_update_fence ON public.edt_supports AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_private_seven_scope('edt_supports',to_jsonb(edt_supports),'write') IS TRUE) WITH CHECK (public.tos_private_seven_scope('edt_supports',to_jsonb(edt_supports),'write') IS TRUE);
CREATE POLICY final_seven_delete_fence ON public.edt_supports AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_private_seven_scope('edt_supports',to_jsonb(edt_supports),'write') IS TRUE);

ALTER TABLE public.enjeux_terrain ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.enjeux_terrain FROM PUBLIC,anon;
CREATE POLICY final_seven_read_fence ON public.enjeux_terrain AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_private_seven_scope('enjeux_terrain',to_jsonb(enjeux_terrain),'read') IS TRUE);
CREATE POLICY final_seven_insert_fence ON public.enjeux_terrain AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_private_seven_scope('enjeux_terrain',to_jsonb(enjeux_terrain),'write') IS TRUE);
CREATE POLICY final_seven_update_fence ON public.enjeux_terrain AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_private_seven_scope('enjeux_terrain',to_jsonb(enjeux_terrain),'write') IS TRUE) WITH CHECK (public.tos_private_seven_scope('enjeux_terrain',to_jsonb(enjeux_terrain),'write') IS TRUE);
CREATE POLICY final_seven_delete_fence ON public.enjeux_terrain AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_private_seven_scope('enjeux_terrain',to_jsonb(enjeux_terrain),'write') IS TRUE);

ALTER TABLE public.inspections_terrain ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inspections_terrain FROM PUBLIC,anon;
CREATE POLICY final_seven_read_fence ON public.inspections_terrain AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_private_seven_scope('inspections_terrain',to_jsonb(inspections_terrain),'read') IS TRUE);
CREATE POLICY final_seven_insert_fence ON public.inspections_terrain AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_private_seven_scope('inspections_terrain',to_jsonb(inspections_terrain),'write') IS TRUE);
CREATE POLICY final_seven_update_fence ON public.inspections_terrain AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_private_seven_scope('inspections_terrain',to_jsonb(inspections_terrain),'write') IS TRUE) WITH CHECK (public.tos_private_seven_scope('inspections_terrain',to_jsonb(inspections_terrain),'write') IS TRUE);
CREATE POLICY final_seven_delete_fence ON public.inspections_terrain AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_private_seven_scope('inspections_terrain',to_jsonb(inspections_terrain),'write') IS TRUE);

ALTER TABLE public.photo_action_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.photo_action_log FROM PUBLIC,anon;
CREATE POLICY final_seven_read_fence ON public.photo_action_log AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_private_seven_scope('photo_action_log',to_jsonb(photo_action_log),'read') IS TRUE);
CREATE POLICY final_seven_insert_fence ON public.photo_action_log AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_private_seven_scope('photo_action_log',to_jsonb(photo_action_log),'write') IS TRUE);
CREATE POLICY final_seven_update_fence ON public.photo_action_log AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_private_seven_scope('photo_action_log',to_jsonb(photo_action_log),'write') IS TRUE) WITH CHECK (public.tos_private_seven_scope('photo_action_log',to_jsonb(photo_action_log),'write') IS TRUE);
CREATE POLICY final_seven_delete_fence ON public.photo_action_log AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_private_seven_scope('photo_action_log',to_jsonb(photo_action_log),'write') IS TRUE);

ALTER TABLE public.relation_fields ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.relation_fields FROM PUBLIC,anon;
CREATE POLICY final_seven_read_fence ON public.relation_fields AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_private_seven_scope('relation_fields',to_jsonb(relation_fields),'read') IS TRUE);
CREATE POLICY final_seven_insert_fence ON public.relation_fields AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_private_seven_scope('relation_fields',to_jsonb(relation_fields),'write') IS TRUE);
CREATE POLICY final_seven_update_fence ON public.relation_fields AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_private_seven_scope('relation_fields',to_jsonb(relation_fields),'write') IS TRUE) WITH CHECK (public.tos_private_seven_scope('relation_fields',to_jsonb(relation_fields),'write') IS TRUE);
CREATE POLICY final_seven_delete_fence ON public.relation_fields AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_private_seven_scope('relation_fields',to_jsonb(relation_fields),'write') IS TRUE);

ALTER TABLE public.relation_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.relation_rules FROM PUBLIC,anon;
CREATE POLICY final_seven_read_fence ON public.relation_rules AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_private_seven_scope('relation_rules',to_jsonb(relation_rules),'read') IS TRUE);
CREATE POLICY final_seven_insert_fence ON public.relation_rules AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_private_seven_scope('relation_rules',to_jsonb(relation_rules),'write') IS TRUE);
CREATE POLICY final_seven_update_fence ON public.relation_rules AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_private_seven_scope('relation_rules',to_jsonb(relation_rules),'write') IS TRUE) WITH CHECK (public.tos_private_seven_scope('relation_rules',to_jsonb(relation_rules),'write') IS TRUE);
CREATE POLICY final_seven_delete_fence ON public.relation_rules AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_private_seven_scope('relation_rules',to_jsonb(relation_rules),'write') IS TRUE);
