-- Same RLS predicates; evaluate row-independent view permissions once per statement.
DO $$ DECLARE t text;v text; BEGIN
 FOR t,v IN SELECT * FROM (VALUES
 ('infrastructures','Infrastructures'),('repertoire_des_affiches','Répertoire des affiches'),
 ('centres_dinformation','Centres d’information'),('ci_avec_enjeux','C.I. avec enjeux'),
 ('liste_des_arrets','Liste des arrêts'),('voitures_trains','Voitures / trains'),
 ('photos','Photos'),('historique_des_campagnes','Historique des campagnes'),
 ('suivi_des_edt','Suivi des EDT'),('bons_de_travail','Bons de travail')) views(t,v) LOOP
  EXECUTE format('ALTER POLICY portal_client_read ON public.%I USING ((SELECT public.portal_view_allowed(%L)) AND (client_id IS NULL OR client_id=(SELECT u.client_id FROM public.utilisateurs u WHERE u.auth_user_id=(SELECT auth.uid()) AND u.statut=''Actif'')) AND public.portal_client_row_scope(to_jsonb(%I.*)))',t,v,t);
 END LOOP;
END $$;
ALTER POLICY portal_client_read ON public.enjeux_des_cadres_et_supports
 USING ((SELECT public.portal_view_allowed('Enjeux des cadres et supports')) AND (client_id IS NULL OR client_id=(SELECT u.client_id FROM public.utilisateurs u WHERE u.auth_user_id=(SELECT auth.uid()) AND u.statut='Actif')) AND public.portal_client_row_scope(to_jsonb(enjeux_des_cadres_et_supports.*)));


CREATE OR REPLACE FUNCTION public.portal_business_rows(p_view text,p_offset integer DEFAULT 0,p_limit integer DEFAULT 1000)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE t text:=public.portal_business_view(p_view);n bigint;rows jsonb;predicate text:='true'; BEGIN
 IF auth.uid() IS NULL OR t IS NULL OR NOT public.portal_view_allowed(p_view) THEN RAISE EXCEPTION 'business_view_denied' USING ERRCODE='42501';END IF;
 IF t='campagnes_maitres' THEN predicate:=format('business_context=%L',CASE WHEN public.dashboard_key(p_view)='communications_operationnelles' THEN 'operational_communication' ELSE 'marketing' END);END IF;
 IF public.tos_current_role() IN ('Client','Client-Admin') THEN predicate:=predicate||format(' AND (client_id IS NULL OR client_id=%L)',(SELECT u.client_id FROM public.utilisateurs u WHERE u.auth_user_id=auth.uid() AND u.statut='Actif'));END IF;
 EXECUTE format('SELECT count(*) FROM public.%I WHERE %s',t,predicate) INTO n;
 EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) FROM (SELECT * FROM public.%I WHERE %s ORDER BY id LIMIT $1 OFFSET $2) r',t,predicate) INTO rows USING least(1000,greatest(1,p_limit)),greatest(0,p_offset);
 RETURN jsonb_build_object('rows',rows,'total',n);
END $$;


NOTIFY pgrst,'reload schema';
