-- Only the active Admin may read the one Auth flag needed for an exact preview.
CREATE OR REPLACE FUNCTION public.portal_preview_profile(p_user_id bigint)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR public.tos_current_role() IS DISTINCT FROM 'Administrateur' THEN RAISE EXCEPTION 'admin_preview_denied' USING ERRCODE='42501';END IF;
 RETURN (SELECT to_jsonb(u)||jsonb_build_object('_preview_account_activated',a.raw_user_meta_data->'account_activated')
 FROM public.utilisateurs u JOIN auth.users a ON a.id=u.auth_user_id WHERE u.id=p_user_id AND u.statut='Actif');
END $$;
REVOKE ALL ON FUNCTION public.portal_preview_profile(bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.portal_preview_profile(bigint) TO authenticated;
NOTIFY pgrst,'reload schema';
