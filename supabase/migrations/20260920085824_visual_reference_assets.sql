-- Generic artwork belongs to the existing canonical visual, not to an installation.
ALTER TABLE public.campagne_visuels_formats
 ADD COLUMN reference_assets jsonb NOT NULL DEFAULT '[]'::jsonb,
 ADD CONSTRAINT visual_reference_assets_shape CHECK (
  jsonb_typeof(reference_assets)='array' AND jsonb_array_length(reference_assets)<=10
  AND octet_length(reference_assets::text)<=4194304);

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('visual-references','visual-references',false,26214400,ARRAY['image/jpeg','image/png','image/webp','application/pdf']);

CREATE FUNCTION public.visual_reference_storage_access(p_name text,p_action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL
 AND public.tos_current_role() IS NOT NULL
 AND (p_action='read' OR public.tos_current_role() IN ('Administrateur','Coordonnateur'))
 AND p_action IN ('read','insert','delete')
 AND EXISTS (SELECT 1 FROM public.campagne_visuels_formats v
  WHERE v.client_id::text=split_part(p_name,'/',1) AND v.id::text=split_part(p_name,'/',2)
   AND p_name ~ '^[0-9]+/[0-9]+/[a-f0-9-]+\.(jpg|png|webp|pdf)$')
$$;
REVOKE ALL ON FUNCTION public.visual_reference_storage_access(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.visual_reference_storage_access(text,text) TO authenticated;

CREATE POLICY visual_reference_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='visual-references' AND public.visual_reference_storage_access(name,'read'));
CREATE POLICY visual_reference_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='visual-references' AND public.visual_reference_storage_access(name,'insert'));
CREATE POLICY visual_reference_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='visual-references' AND public.visual_reference_storage_access(name,'delete'));
-- Extend the existing restrictive fences solely for the new private bucket.
ALTER POLICY final_storage_read_fence ON storage.objects USING (
 CASE WHEN bucket_id='visual-references' THEN public.visual_reference_storage_access(name,'read')
 ELSE public.tos_storage_tenant_scope(bucket_id,name,'read',owner_id) IS TRUE END);
ALTER POLICY final_storage_insert_fence ON storage.objects WITH CHECK (
 CASE WHEN bucket_id='visual-references' THEN public.visual_reference_storage_access(name,'insert')
 ELSE public.tos_storage_tenant_scope(bucket_id,name,'insert',owner_id) IS TRUE END);
ALTER POLICY final_storage_delete_fence ON storage.objects USING (
 CASE WHEN bucket_id='visual-references' THEN public.visual_reference_storage_access(name,'delete')
 ELSE public.tos_storage_tenant_scope(bucket_id,name,'delete',owner_id) IS TRUE END);
-- No UPDATE/overwrite permission is added. Each uploaded original gets a fresh UUID.

CREATE FUNCTION public.add_visual_reference(p_visual_id bigint,p_asset jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v public.campagne_visuels_formats%rowtype;BEGIN
 IF auth.uid() IS NULL OR public.tos_current_role() NOT IN ('Administrateur','Coordonnateur')
  OR public.tos_current_role() IS NULL THEN RAISE EXCEPTION 'reference_write_denied' USING ERRCODE='42501';END IF;
 SELECT * INTO v FROM public.campagne_visuels_formats WHERE id=p_visual_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'visual_not_accessible' USING ERRCODE='42501';END IF;
 IF jsonb_typeof(p_asset) IS DISTINCT FROM 'object' OR nullif(p_asset->>'id','') IS NULL
  OR p_asset->>'mime_type' NOT IN ('image/jpeg','image/png','image/webp','application/pdf')
  OR jsonb_typeof(p_asset->'pages') IS DISTINCT FROM 'array'
  OR jsonb_array_length(p_asset->'pages') NOT BETWEEN 1 AND 20
  OR split_part(p_asset->>'storage_path','/',1) IS DISTINCT FROM v.client_id::text
  OR split_part(p_asset->>'storage_path','/',2) IS DISTINCT FROM v.id::text
  OR NOT public.visual_reference_storage_access(p_asset->>'storage_path','insert')
 THEN RAISE EXCEPTION 'invalid_visual_reference' USING ERRCODE='23514';END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='visual-references' AND name=p_asset->>'storage_path')
 THEN RAISE EXCEPTION 'reference_original_missing' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(v.reference_assets) a WHERE a->>'id'=p_asset->>'id') THEN RETURN v.reference_assets;END IF;
 UPDATE public.campagne_visuels_formats SET reference_assets=reference_assets||jsonb_build_array(p_asset),updated_at=now() WHERE id=v.id RETURNING reference_assets INTO p_asset;
 RETURN p_asset;
END $$;
REVOKE ALL ON FUNCTION public.add_visual_reference(bigint,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.add_visual_reference(bigint,jsonb) TO authenticated;

-- Keep uploaded originals reachable even if deletion races a reference upload.
CREATE FUNCTION public.preserve_visual_reference_originals()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF jsonb_array_length(OLD.reference_assets)>0 THEN
  RAISE EXCEPTION 'Ce visuel possède des références. Archivez-le pour conserver les originaux.' USING ERRCODE='23514';
 END IF;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.preserve_visual_reference_originals() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER preserve_visual_reference_originals BEFORE DELETE ON public.campagne_visuels_formats
 FOR EACH ROW EXECUTE FUNCTION public.preserve_visual_reference_originals();
