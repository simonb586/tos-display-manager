-- Explicit historical ownership survives retired references. Contradictory existing
-- references still fail closed; canonical live assignments retain strict link checks.
CREATE OR REPLACE FUNCTION public.portal_assignment_scope(p_table text,p_row jsonb,p_update boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE view_name text; context text; owner_id bigint; BEGIN
 IF public.tos_current_role() NOT IN ('Client','Client-Admin') OR auth.uid() IS NULL THEN RETURN false;END IF;
 IF p_table NOT IN ('campagnes_supports','campagnes_visuels_sites_supports','communications_operationnelles_sites_supports') THEN RETURN false;END IF;
 IF p_table='campagnes_supports' THEN
  SELECT business_context INTO context FROM public.campagnes_maitres WHERE id=(p_row->>'campagne_id')::bigint;
 ELSE context:=p_row->>'business_context'; END IF;
 IF context NOT IN ('marketing','operational_communication') OR context IS NULL THEN RETURN false;END IF;
 view_name:=CASE WHEN context='marketing' THEN 'Campagnes et visuels par site et supports' ELSE 'Communications opérationnelles par site et supports' END;
 IF NOT public.portal_view_allowed(view_name,p_update) THEN RETURN false;END IF;
 IF p_table='campagnes_supports' THEN RETURN public.tos_remaining_tenant_scope(p_table,p_row,'read');END IF;
 owner_id:=nullif(p_row->>'client_id','')::bigint;
 RETURN public.portal_client_row_scope(p_row||jsonb_build_object('campagne_id',p_row->'campaign_id'))
  AND NOT EXISTS(SELECT 1 FROM public.infrastructures i WHERE i.id=nullif(p_row->>'infrastructure_id','')::bigint AND (i.client_id IS DISTINCT FROM owner_id OR (nullif(p_row->>'support_id','') IS NOT NULL AND i.support_id IS DISTINCT FROM p_row->>'support_id')))
  AND NOT EXISTS(SELECT 1 FROM public.campagne_visuels_formats v LEFT JOIN public.campagnes_maitres c ON c.id=v.campagne_id WHERE v.id=nullif(p_row->>'visual_id','')::bigint AND (coalesce(v.client_id,c.client_id) IS DISTINCT FROM owner_id OR (nullif(p_row->>'campaign_id','') IS NOT NULL AND v.campagne_id IS DISTINCT FROM (p_row->>'campaign_id')::bigint)));
END $$;
NOTIFY pgrst,'reload schema';
