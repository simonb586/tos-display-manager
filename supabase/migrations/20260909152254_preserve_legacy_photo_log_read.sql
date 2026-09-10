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
 ELSIF p_table='photo_action_log' THEN
  IF p_action='read' AND actor_client IS NULL AND r IN ('Administrateur','Coordonnateur','Installateur') AND support IS NOT NULL
   AND NOT EXISTS(SELECT 1 FROM public.infrastructures i WHERE i.support_id=support)
   AND EXISTS(SELECT 1 FROM public.photo_action_log h WHERE h.id=(p_row->>'id')::bigint AND h.support_id=support)
  THEN RETURN true;END IF;
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
