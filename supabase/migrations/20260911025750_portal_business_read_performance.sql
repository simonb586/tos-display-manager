-- Same RLS predicates; evaluate row-independent view permissions once per statement.
DO $$ DECLARE t text;v text; BEGIN
 FOR t,v IN SELECT * FROM (VALUES
 ('infrastructures','Infrastructures'),('repertoire_des_affiches','Répertoire des affiches'),
 ('centres_dinformation','Centres d’information'),('ci_avec_enjeux','C.I. avec enjeux'),
 ('liste_des_arrets','Liste des arrêts'),('voitures_trains','Voitures / trains'),
 ('photos','Photos'),('historique_des_campagnes','Historique des campagnes'),
 ('suivi_des_edt','Suivi des EDT'),('bons_de_travail','Bons de travail')) views(t,v) LOOP
  EXECUTE format('ALTER POLICY portal_client_read ON public.%I USING ((SELECT public.portal_view_allowed(%L)) AND public.portal_client_row_scope(to_jsonb(%I.*)))',t,v,t);
 END LOOP;
END $$;
ALTER POLICY portal_client_read ON public.enjeux_des_cadres_et_supports
 USING ((SELECT public.portal_view_allowed('Enjeux des cadres et supports')) AND public.portal_client_row_scope(to_jsonb(enjeux_des_cadres_et_supports.*)));

-- Include active test profiles with negative IDs in the same read-only preview.
CREATE OR REPLACE FUNCTION public.portal_preview_guard()
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE target text:=nullif(current_setting('request.headers',true),'')::jsonb->>'x-tos-preview-user';
 target_uid uuid;claims jsonb;method text:=current_setting('request.method',true);path text:=current_setting('request.path',true);
 reads text[]:=ARRAY['portal_dashboard_summary','portal_business_rows','portal_business_context','portal_preview_storage_read',
 'client_portal_identity_v120','current_user_visible_views_v136','client_portal_list_v120','client_portal_list_v1362',
 'client_portal_support_context_v139','module15_client_edt_reports_v130','lister_contextes_terrain_v1342','lister_visuels_installation_terrain_v1331',
 'tableau_bord_edt_v0129','edt_deletion_impact_v133','diagnostiquer_integrite_edt_v013','list_public_schema_fields','list_public_schema_fields_v0131a',
 'admin_client_access_overview_v135','admin_client_access_detail_v135','admin_search_client_users_v136','client_ownership_summary_v1362'];
BEGIN
 IF target IS NULL THEN RETURN;END IF;
 IF public.tos_current_role() IS DISTINCT FROM 'Administrateur' OR target!~'^-?[0-9]+$' THEN RAISE EXCEPTION 'admin_preview_denied' USING ERRCODE='42501';END IF;
 IF path LIKE '/rpc/%' THEN
  IF NOT substr(path,6)=ANY(reads) THEN RAISE EXCEPTION 'preview_read_only' USING ERRCODE='42501';END IF;
 ELSIF method NOT IN ('GET','HEAD') OR method IS NULL THEN RAISE EXCEPTION 'preview_read_only' USING ERRCODE='42501';END IF;
 SELECT auth_user_id INTO target_uid FROM public.utilisateurs WHERE id=target::bigint AND statut='Actif';
 IF target_uid IS NULL THEN RAISE EXCEPTION 'preview_target_inactive' USING ERRCODE='42501';END IF;
 claims:=jsonb_build_object('sub',target_uid,'role','authenticated');
 PERFORM set_config('request.jwt.claim.sub',target_uid::text,true);
 PERFORM set_config('request.jwt.claims',claims::text,true);
 PERFORM set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
END $$;

NOTIFY pgrst,'reload schema';
