-- Remove references from recognition without destroying originals or metadata.
CREATE FUNCTION public.remove_visual_reference(p_visual_id bigint,p_asset_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v public.campagne_visuels_formats%rowtype; assets jsonb;
BEGIN
 IF auth.uid() IS NULL OR public.tos_current_role() IS NULL
  OR public.tos_current_role() NOT IN ('Administrateur','Coordonnateur')
 THEN RAISE EXCEPTION 'reference_write_denied' USING ERRCODE='42501';END IF;
 SELECT * INTO v FROM public.campagne_visuels_formats WHERE id=p_visual_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'visual_not_accessible' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v.reference_assets) a WHERE a->>'id'=p_asset_id)
 THEN RAISE EXCEPTION 'reference_not_found' USING ERRCODE='22023';END IF;
 SELECT jsonb_agg(CASE WHEN a->>'id'=p_asset_id AND coalesce(a->>'archived','false')<>'true'
  THEN a||jsonb_build_object('archived',true,'archived_at',now(),'archived_by',auth.uid()) ELSE a END ORDER BY ordinal)
 INTO assets FROM jsonb_array_elements(v.reference_assets) WITH ORDINALITY t(a,ordinal);
 UPDATE public.campagne_visuels_formats SET reference_assets=assets,updated_at=now() WHERE id=v.id;
 RETURN assets;
END $$;
REVOKE ALL ON FUNCTION public.remove_visual_reference(bigint,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.remove_visual_reference(bigint,text) TO authenticated;
