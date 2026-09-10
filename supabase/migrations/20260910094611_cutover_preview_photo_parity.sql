-- Additive preview photo parity only. No data, grants, Auth or bucket changes.
CREATE OR REPLACE FUNCTION public.admin_preview_client_portal_context_v1362(p_target_user_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$declare v_admin uuid:=auth.uid();v_target public.utilisateurs%rowtype;v_base jsonb;v_total bigint;v_rows jsonb;BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.utilisateurs sec_user WHERE sec_user.id=p_target_user_id AND public.tos_table_resource_scope(sec_user.client_id,NULL,NULL,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'target_user_scope_denied' USING ERRCODE='42501';END IF;

BEGIN
 if v_admin is null or not exists(select 1 from public.utilisateurs where auth_user_id=v_admin and statut='Actif'and role='Administrateur')then raise exception 'ADMIN_REQUIRED' using errcode='42501';end if;select*into v_target from public.utilisateurs where id=p_target_user_id and statut='Actif'and role in('Client','Client-Admin');if not found or v_target.client_id is null then raise exception 'TARGET_CLIENT_USER_NOT_FOUND';end if;v_base:=public.admin_preview_client_portal_context_v1361(p_target_user_id);select count(*)into v_total from public.infrastructures where client_id=v_target.client_id;select coalesce(jsonb_agg(to_jsonb(q)),'[]')into v_rows from(select support_id,site,type_site,type_support,emplacement_visibilite,client_id from public.infrastructures where client_id=v_target.client_id order by site nulls last,support_id limit 10)q;v_base:=jsonb_set(v_base,'{sections,supports}',jsonb_build_object('section','supports','page',1,'page_size',10,'total',v_total,'rows',v_rows),true);
-- Match the existing ownership-based client photo/360 projection for visible
-- infrastructure evidence without a campaign. Preserve campaign restrictions.
IF v_base#>'{sections,photos}' IS NOT NULL THEN
 SELECT count(*) INTO v_total FROM public.support_photos p WHERE p.client_id=v_target.client_id AND p.client_visible AND p.deleted_at IS NULL
AND EXISTS(SELECT 1 FROM public.infrastructures i WHERE i.support_id=p.support_id AND i.client_id=v_target.client_id)
AND (p.campagne_id IS NULL OR EXISTS(SELECT 1 FROM public.campagnes_maitres c
 WHERE c.id=p.campagne_id AND c.client_id=v_target.client_id AND c.client_published
 AND (v_target.role='Client-Admin' OR EXISTS(SELECT 1 FROM public.client_campaign_access a
 WHERE a.client_id=v_target.client_id AND a.campaign_id=c.id AND (a.user_id IS NULL OR a.user_id=v_target.auth_user_id)))));
 SELECT coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) INTO v_rows FROM (
  SELECT p.id,p.support_id,p.campagne_id,p.visuel_id,p.type_photo,p.nom_fichier,p.storage_bucket,p.storage_path,p.photo_url,p.thumbnail_url,p.prise_le,p.statut_validation
  FROM public.support_photos p WHERE p.client_id=v_target.client_id AND p.client_visible AND p.deleted_at IS NULL
AND EXISTS(SELECT 1 FROM public.infrastructures i WHERE i.support_id=p.support_id AND i.client_id=v_target.client_id)
AND (p.campagne_id IS NULL OR EXISTS(SELECT 1 FROM public.campagnes_maitres c
 WHERE c.id=p.campagne_id AND c.client_id=v_target.client_id AND c.client_published
 AND (v_target.role='Client-Admin' OR EXISTS(SELECT 1 FROM public.client_campaign_access a
 WHERE a.client_id=v_target.client_id AND a.campaign_id=c.id AND (a.user_id IS NULL OR a.user_id=v_target.auth_user_id)))))
  ORDER BY p.prise_le DESC NULLS LAST,p.id DESC LIMIT 10
 ) q;
 v_base:=jsonb_set(v_base,'{sections,photos}',jsonb_build_object('section','photos','page',1,'page_size',10,'total',v_total,'rows',v_rows),true);
END IF;
return v_base||jsonb_build_object('scope_version','v1362','diagnostic','OK','auth_uid_changed',false,'target_session_created',false);END;
END;
$function$
;
