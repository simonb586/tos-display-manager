-- Preserve an already-stored historical BT with a valid canonical client and
-- unresolved legacy support text. Only global internal actors may maintain it.
-- Matching the stored identity prevents INSERT or ownership/reference forgery.
CREATE OR REPLACE FUNCTION public.tos_legacy_work_order_scope(
  p_id bigint,p_client bigint,p_support text,p_edt bigint
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
 SELECT auth.uid() IS NOT NULL
 AND public.tos_current_role() IN ('Administrateur','Coordonnateur','Installateur')
 AND public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)
 AND p_client IS NOT NULL AND p_edt IS NULL
 AND nullif(btrim(p_support),'') IS NOT NULL
 AND EXISTS(SELECT 1 FROM public.clients c WHERE c.id=p_client)
 AND NOT EXISTS(SELECT 1 FROM public.infrastructures i WHERE i.support_id=p_support)
 AND EXISTS(SELECT 1 FROM public.bons_de_travail b
   WHERE b.id=p_id AND b.client_id=p_client AND b.support_id=p_support AND b.edt_id IS NULL);
$function$;
REVOKE ALL ON FUNCTION public.tos_legacy_work_order_scope(bigint,bigint,text,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tos_legacy_work_order_scope(bigint,bigint,text,bigint) TO authenticated,service_role;
ALTER POLICY private_bons_de_travail_select ON public.bons_de_travail
USING ((SELECT auth.uid()) IS NOT NULL
 AND (SELECT public.tos_current_role()) IN ('Administrateur','Coordonnateur','Installateur')
 AND (public.tos_table_resource_scope(client_id,support_id,NULL,edt_id,true)
   OR public.tos_legacy_work_order_scope(id,client_id,support_id,edt_id)));
ALTER POLICY private_bons_de_travail_update ON public.bons_de_travail
USING ((SELECT auth.uid()) IS NOT NULL
 AND (SELECT public.tos_current_role()) IN ('Administrateur','Coordonnateur')
 AND (public.tos_table_resource_scope(client_id,support_id,NULL,edt_id,true)
   OR public.tos_legacy_work_order_scope(id,client_id,support_id,edt_id)))
WITH CHECK ((SELECT auth.uid()) IS NOT NULL
 AND (SELECT public.tos_current_role()) IN ('Administrateur','Coordonnateur')
 AND (public.tos_table_resource_scope(client_id,support_id,NULL,edt_id,true)
   OR public.tos_legacy_work_order_scope(id,client_id,support_id,edt_id)));
ALTER POLICY private_bons_de_travail_delete ON public.bons_de_travail
USING ((SELECT auth.uid()) IS NOT NULL
 AND (SELECT public.tos_current_role())='Administrateur'
 AND (public.tos_table_resource_scope(client_id,support_id,NULL,edt_id,true)
   OR public.tos_legacy_work_order_scope(id,client_id,support_id,edt_id)));
