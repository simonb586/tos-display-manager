-- The newly authorized inventory view reads all canonical photos of its own
-- client. Preserve old publication flags and keep deleted/foreign photos denied.
ALTER POLICY photo_client_inventory_read ON public.support_photos USING (
 public.tos_current_role() IN ('Client','Client-Admin') AND deleted_at IS NULL
 AND public.portal_view_allowed('Photos et inventaire')
 AND public.tos_table_resource_scope(client_id,support_id,campagne_id,CASE WHEN edt_id ~ '^[0-9]+$' THEN edt_id::bigint END,false)
);
ALTER POLICY support_photo_inventory_storage_read ON storage.objects USING (
 bucket_id='support-photos' AND public.tos_current_role() IN ('Client','Client-Admin')
 AND public.portal_view_allowed('Photos et inventaire')
 AND EXISTS(SELECT 1 FROM public.support_photos p WHERE p.storage_bucket=objects.bucket_id AND p.storage_path=objects.name AND p.deleted_at IS NULL)
);
DO $$DECLARE definition text;needle text;BEGIN
 SELECT pg_get_functiondef('public.terrain_photo_access_prepared(text,text,text,timestamptz)'::regprocedure) INTO definition;
 needle:='and p.client_visible and p.deleted_at is null';
 IF position(needle IN definition)=0 THEN RAISE EXCEPTION 'unexpected_terrain_photo_guard';END IF;
 EXECUTE replace(definition,needle,'and (p.client_visible OR public.portal_view_allowed(''Photos et inventaire'')) and p.deleted_at is null');
 SELECT pg_get_functiondef('public.tos_storage_tenant_scope(text,text,text,text)'::regprocedure) INTO definition;
 needle:='p.client_visible IS NOT TRUE OR (public.client_can_access_campaign_v120(p.campagne_id)';
 IF position(needle IN definition)=0 THEN RAISE EXCEPTION 'unexpected_support_photo_guard';END IF;
 EXECUTE replace(definition,needle,'(p.client_visible IS NOT TRUE AND public.portal_view_allowed(''Photos et inventaire'') IS NOT TRUE) OR (public.client_can_access_campaign_v120(p.campagne_id)');
END $$;
