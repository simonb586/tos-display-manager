-- Bucket visibility is unchanged. Terrain public read remains the documented transition exception.
CREATE OR REPLACE FUNCTION public.tos_storage_tenant_scope(p_bucket text,p_path text,p_action text,p_owner text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
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
   IF r IN ('Client','Client-Admin') AND (p.client_visible IS NOT TRUE OR public.client_can_access_campaign_v120(p.campagne_id) IS NOT TRUE) THEN RETURN false;END IF;
  END LOOP;
  IF matched THEN RETURN true;END IF;
  IF r NOT IN ('Administrateur','Coordonnateur','Installateur') THEN RETURN false;END IF;
  s:=case when split_part(p_path,'/',1)='supports' then split_part(p_path,'/',2) else split_part(p_path,'/',1) end;
  IF public.tos_table_resource_scope(null,s,null,null,false) IS TRUE THEN RETURN true;END IF;
  RETURN a IS NULL AND (p_action='read' OR (r IN ('Administrateur','Coordonnateur') AND split_part(p_path,'/',1)='review'));
 ELSIF p_bucket='final-reports' THEN
  IF r NOT IN ('Administrateur','Coordonnateur','Client','Client-Admin') THEN RETURN false;END IF;
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
END $fn$;
REVOKE ALL ON FUNCTION public.tos_storage_tenant_scope(text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tos_storage_tenant_scope(text,text,text,text) TO authenticated;
CREATE POLICY final_storage_read_fence ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING (public.tos_storage_tenant_scope(bucket_id,name,'read',owner_id) IS TRUE);
CREATE POLICY final_storage_insert_fence ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_storage_tenant_scope(bucket_id,name,'insert',owner_id) IS TRUE);
CREATE POLICY final_storage_update_fence ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_storage_tenant_scope(bucket_id,name,'update',owner_id) IS TRUE) WITH CHECK (public.tos_storage_tenant_scope(bucket_id,name,'update',owner_id) IS TRUE);
CREATE POLICY final_storage_delete_fence ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_storage_tenant_scope(bucket_id,name,'delete',owner_id) IS TRUE);
-- Evaluate published report ownership in the definer helper: clients cannot SELECT the internal edt_reports table directly.
CREATE POLICY final_storage_client_report_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id='final-reports' AND public.tos_current_role() IN ('Client','Client-Admin') AND public.tos_storage_tenant_scope(bucket_id,name,'read',owner_id) IS TRUE);
