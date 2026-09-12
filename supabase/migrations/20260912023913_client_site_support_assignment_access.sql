-- Required client navigation and shared assignment editing. Existing data is preserved.
UPDATE public.role_ui_permissions p SET visible_tables=p.visible_tables||ARRAY(
 SELECT name FROM unnest(ARRAY['Infrastructures','Campagnes et visuels par site et supports','Communications opérationnelles par site et supports','Communications opérationnelles']) name
 WHERE NOT name=ANY(p.visible_tables)
) WHERE p.role IN ('Client','Client-Admin');

ALTER TABLE public.campagnes_visuels_sites_supports ADD COLUMN IF NOT EXISTS client_id bigint REFERENCES public.clients(id);
ALTER TABLE public.communications_operationnelles_sites_supports ADD COLUMN IF NOT EXISTS client_id bigint REFERENCES public.clients(id);
DO $$ DECLARE t text; exo bigint; BEGIN
 SELECT id INTO STRICT exo FROM public.clients WHERE id=2 AND lower(nom_client)='exo';
 FOREACH t IN ARRAY ARRAY['campagnes_visuels_sites_supports','communications_operationnelles_sites_supports'] LOOP
  -- Prefer existing linked ownership; unlinked historical records belong to EXO.
  EXECUTE format('UPDATE public.%I h SET client_id=coalesce((SELECT c.client_id FROM public.campagnes_maitres c WHERE c.id=h.campaign_id),(SELECT i.client_id FROM public.infrastructures i WHERE i.support_id=h.support_id LIMIT 1),$1) WHERE h.client_id IS NULL',t) USING exo;
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(client_id)',t||'_client_idx',t);
 END LOOP;
END $$;

CREATE FUNCTION public.portal_assignment_scope(p_table text,p_row jsonb,p_update boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE view_name text; context text; BEGIN
 IF public.tos_current_role() NOT IN ('Client','Client-Admin') OR auth.uid() IS NULL THEN RETURN false;END IF;
 IF p_table NOT IN ('campagnes_supports','campagnes_visuels_sites_supports','communications_operationnelles_sites_supports') THEN RETURN false;END IF;
 IF p_table='campagnes_supports' THEN
  SELECT business_context INTO context FROM public.campagnes_maitres WHERE id=(p_row->>'campagne_id')::bigint;
 ELSE context:=p_row->>'business_context'; END IF;
 IF context NOT IN ('marketing','operational_communication') OR context IS NULL THEN RETURN false;END IF;
 view_name:=CASE WHEN context='marketing' THEN 'Campagnes et visuels par site et supports' ELSE 'Communications opérationnelles par site et supports' END;
 RETURN public.portal_view_allowed(view_name,p_update)
  AND public.tos_remaining_tenant_scope(p_table,p_row,'read');
END $$;
REVOKE ALL ON FUNCTION public.portal_assignment_scope(text,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.portal_assignment_scope(text,jsonb,boolean) TO authenticated;

-- Restrictive policies close older permissive write policies for Client, including
-- direct REST calls. Client-Admin may UPDATE, never insert/delete or change ownership.
GRANT SELECT,UPDATE ON public.campagnes_supports,public.campagnes_visuels_sites_supports,public.communications_operationnelles_sites_supports TO authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['campagnes_supports','campagnes_visuels_sites_supports','communications_operationnelles_sites_supports'] LOOP
  EXECUTE format('CREATE POLICY portal_assignment_read ON public.%I FOR SELECT TO authenticated USING (public.portal_assignment_scope(%L,to_jsonb(%I.*)))',t,t,t);
  EXECUTE format('CREATE POLICY portal_assignment_update ON public.%I FOR UPDATE TO authenticated USING (public.portal_assignment_scope(%L,to_jsonb(%I.*),true)) WITH CHECK (public.portal_assignment_scope(%L,to_jsonb(%I.*),true))',t,t,t,t,t);
  EXECUTE format('CREATE POLICY portal_assignment_update_guard ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_current_role() NOT IN (''Client'',''Client-Admin'') OR public.portal_assignment_scope(%L,to_jsonb(%I.*),true)) WITH CHECK (public.tos_current_role() NOT IN (''Client'',''Client-Admin'') OR public.portal_assignment_scope(%L,to_jsonb(%I.*),true))',t,t,t,t,t);
  EXECUTE format('CREATE POLICY portal_assignment_insert_guard ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_current_role() NOT IN (''Client'',''Client-Admin''))',t);
  EXECUTE format('CREATE POLICY portal_assignment_delete_guard ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_current_role() NOT IN (''Client'',''Client-Admin''))',t);
 END LOOP;
END $$;

CREATE FUNCTION public.portal_assignment_update_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE k text; fields text[]; view_name text; context text; old_row jsonb:=to_jsonb(OLD); new_row jsonb:=to_jsonb(NEW); restrictions jsonb; allowed jsonb; v text; column_key text; BEGIN
 IF public.tos_current_role() NOT IN ('Client','Client-Admin') THEN RETURN NEW;END IF;
 IF public.tos_current_role()<>'Client-Admin' THEN RAISE EXCEPTION 'assignment_read_only' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME='campagnes_supports' THEN
  fields:=ARRAY['visuel_attendu','statut','no_edt','updated_at'];
  SELECT business_context INTO context FROM public.campagnes_maitres WHERE id=OLD.campagne_id;
 ELSIF TG_TABLE_NAME='campagnes_visuels_sites_supports' THEN
  fields:=ARRAY['nom_campagne','visuel_terrain','date_debut','date_fin','statut_campagne','emplacement','updated_at'];context:='marketing';
 ELSE
  fields:=ARRAY['message','visuel_message','visuel_terrain','date_debut','date_fin','statut','emplacement','no_arret','site_ou_arret','no_edt','related_voiture','updated_at'];context:='operational_communication';
 END IF;
 view_name:=CASE WHEN context='marketing' THEN 'Campagnes et visuels par site et supports' ELSE 'Communications opérationnelles par site et supports' END;
 SELECT visible_columns INTO restrictions FROM public.role_ui_permissions WHERE role='Client-Admin';
 FOR k IN SELECT key FROM jsonb_each(new_row) LOOP
  IF old_row->k IS NOT DISTINCT FROM new_row->k THEN CONTINUE;END IF;
  IF NOT k=ANY(fields) THEN RAISE EXCEPTION 'assignment_protected_field: %',k USING ERRCODE='42501';END IF;
  column_key:=CASE WHEN k='visuel_attendu' THEN 'visuel_terrain' WHEN TG_TABLE_NAME='campagnes_supports' AND context='marketing' AND k='statut' THEN 'statut_campagne' ELSE k END;
  FOR v,allowed IN SELECT key,value FROM jsonb_each(coalesce(restrictions,'{}')) LOOP
   IF public.dashboard_key(v)=public.dashboard_key(view_name) AND jsonb_typeof(allowed)='array' AND jsonb_array_length(allowed)>0 AND k<>'updated_at' AND NOT allowed ? column_key THEN
    RAISE EXCEPTION 'assignment_column_denied: %',k USING ERRCODE='42501';
   END IF;
  END LOOP;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.portal_assignment_update_guard() FROM PUBLIC,anon;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['campagnes_supports','campagnes_visuels_sites_supports','communications_operationnelles_sites_supports'] LOOP
  EXECUTE format('CREATE TRIGGER portal_assignment_update_guard BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.portal_assignment_update_guard()',t);
 END LOOP;
END $$;

-- Legacy administrator preview uses the same paginated sources under target RLS.
CREATE FUNCTION public.admin_preview_assignment_source(p_target_user_id bigint,p_table text,p_offset integer DEFAULT 0,p_limit integer DEFAULT 1000)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE target_id uuid;old_sub text:=current_setting('request.jwt.claim.sub',true);old_claims text:=current_setting('request.jwt.claims',true);result jsonb; BEGIN
 IF public.tos_current_role() IS DISTINCT FROM 'Administrateur' THEN RAISE EXCEPTION 'admin_preview_denied' USING ERRCODE='42501';END IF;
 IF p_table NOT IN ('campagnes_supports','campagnes_visuels_sites_supports','communications_operationnelles_sites_supports','campagnes_maitres','campagne_visuels_formats','infrastructures') THEN RAISE EXCEPTION 'assignment_source_denied' USING ERRCODE='42501';END IF;
 SELECT auth_user_id INTO target_id FROM public.utilisateurs WHERE id=p_target_user_id AND statut='Actif' AND role IN ('Client','Client-Admin');
 IF target_id IS NULL THEN RAISE EXCEPTION 'preview_target_inactive' USING ERRCODE='42501';END IF;
 PERFORM set_config('request.jwt.claim.sub',target_id::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',target_id,'role','authenticated')::text,true);
 EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) FROM (SELECT * FROM public.%I ORDER BY id OFFSET $1 LIMIT $2) r',p_table) INTO result USING greatest(0,p_offset),least(1000,greatest(1,p_limit));
 PERFORM set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
 PERFORM set_config('request.jwt.claims',coalesce(old_claims,''),true);
 RETURN result;
EXCEPTION WHEN OTHERS THEN
 PERFORM set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
 PERFORM set_config('request.jwt.claims',coalesce(old_claims,''),true);RAISE;
END $$;
REVOKE ALL ON FUNCTION public.admin_preview_assignment_source(bigint,text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_preview_assignment_source(bigint,text,integer,integer) TO authenticated;
NOTIFY pgrst,'reload schema';
