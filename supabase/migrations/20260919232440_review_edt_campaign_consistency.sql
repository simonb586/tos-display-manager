-- Historical associations are valid independently of the campaign's current lifecycle.
-- Tenant and business-context checks remain mandatory on every write.
CREATE FUNCTION public.visual_edt_phase_eligible(p_campaign_id bigint,p_phase_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(
  SELECT 1 FROM public.campagnes_maitres c
  JOIN public.edt_phases p ON p.id=p_phase_id
  JOIN public.suivi_des_edt e ON e.id=p.edt_id
  LEFT JOIN public.campagnes_maitres ec ON ec.id=e.campagne_id
  WHERE c.id=p_campaign_id AND e.client_id=c.client_id
   AND (p.client_id IS NULL OR p.client_id=e.client_id) AND p.phase_type='installation'
   AND (e.campagne_id IS NULL OR (ec.client_id=c.client_id AND ec.business_context=c.business_context))
   AND public.tos_table_resource_scope(c.client_id,NULL,c.id,e.id,false) IS TRUE
 );
$$;
REVOKE ALL ON FUNCTION public.visual_edt_phase_eligible(bigint,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.visual_edt_phase_eligible(bigint,bigint) TO authenticated;

CREATE FUNCTION public.list_visual_eligible_edt_phases(p_campaign_id bigint)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'phase_type',p.phase_type,
  'date_debut_prevue',p.date_debut_prevue,'edt',jsonb_build_object('id',e.id,'no_edt',e.no_edt,
  'campagne_id',e.campagne_id,'statut',e.statut,'archived_at',e.archived_at)) ORDER BY e.no_edt,p.id),'[]')
 FROM public.edt_phases p JOIN public.suivi_des_edt e ON e.id=p.edt_id
 WHERE public.visual_edt_phase_eligible(p_campaign_id,p.id);
$$;
REVOKE ALL ON FUNCTION public.list_visual_eligible_edt_phases(bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_visual_eligible_edt_phases(bigint) TO authenticated;

ALTER POLICY visual_edt_write ON public.visual_edt_associations
 USING(public.tos_current_role()='Administrateur' AND EXISTS(SELECT 1 FROM public.campagne_visuels_formats v
 WHERE v.id=visual_id AND public.tos_table_resource_scope(v.client_id,NULL,v.campagne_id,edt_id,false)))
 WITH CHECK(public.tos_current_role()='Administrateur' AND EXISTS(
 SELECT 1 FROM public.campagne_visuels_formats v JOIN public.edt_phases p ON p.id=phase_id
 JOIN public.suivi_des_edt e ON e.id=p.edt_id AND e.id=visual_edt_associations.edt_id
 WHERE v.id=visual_id AND v.client_id=e.client_id AND public.visual_edt_phase_eligible(v.campagne_id,p.id)));

CREATE OR REPLACE FUNCTION public.guard_visual_edt_assignment_v1343()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.edt_phase_id IS NOT DISTINCT FROM OLD.edt_phase_id AND NEW.campagne_id IS NOT DISTINCT FROM OLD.campagne_id
   AND NEW.client_id IS NOT DISTINCT FROM OLD.client_id THEN RETURN NEW;END IF;
 ELSIF NEW.edt_phase_id IS NULL THEN RETURN NEW;END IF;
 IF TG_OP='INSERT' OR NEW.edt_phase_id IS DISTINCT FROM OLD.edt_phase_id THEN
  IF (auth.uid() IS NOT NULL AND public.tos_current_role()='Administrateur') IS NOT TRUE THEN
   RAISE EXCEPTION 'admin_visual_edt_assignment_required' USING ERRCODE='42501';END IF;
 END IF;
 IF NEW.edt_phase_id IS NOT NULL AND (public.visual_edt_phase_eligible(NEW.campagne_id,NEW.edt_phase_id) IS NOT TRUE
  OR NOT EXISTS(SELECT 1 FROM public.campagnes_maitres c WHERE c.id=NEW.campagne_id AND (NEW.client_id IS NULL OR NEW.client_id=c.client_id))) THEN
  RAISE EXCEPTION 'visual_edt_client_or_campaign_mismatch' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_visual_edt_owner_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.visual_edt_associations a JOIN public.suivi_des_edt e ON e.id=a.edt_id
 WHERE a.visual_id=NEW.id AND (e.client_id IS DISTINCT FROM NEW.client_id OR public.visual_edt_phase_eligible(NEW.campagne_id,a.phase_id) IS NOT TRUE)) THEN
  RAISE EXCEPTION 'remove_edt_links_before_owner_change' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_visual_edt_owner_change() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.save_campaign_visual_with_edts(p_visual jsonb,p_links jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v public.campagne_visuels_formats%rowtype; owner_id bigint;links jsonb:=p_links;
BEGIN
 IF auth.uid() IS NULL OR public.tos_current_role() NOT IN ('Administrateur','Coordonnateur') THEN
  RAISE EXCEPTION 'visual_write_denied' USING ERRCODE='42501';END IF;
 IF p_links IS NOT NULL AND public.tos_current_role()<>'Administrateur' THEN
  RAISE EXCEPTION 'admin_visual_edt_assignment_required' USING ERRCODE='42501';END IF;
 SELECT client_id INTO owner_id FROM public.campagnes_maitres WHERE id=(p_visual->>'campagne_id')::bigint;
 IF owner_id IS NULL THEN RAISE EXCEPTION 'campaign_scope_denied' USING ERRCODE='42501';END IF;
 IF nullif(p_visual->>'id','') IS NULL THEN
  INSERT INTO public.campagne_visuels_formats(campagne_id,client_id,nom_visuel,format_support)
  VALUES((p_visual->>'campagne_id')::bigint,owner_id,p_visual->>'nom_visuel',p_visual->>'format_support') RETURNING * INTO v;
 ELSE
  SELECT * INTO v FROM public.campagne_visuels_formats WHERE id=(p_visual->>'id')::bigint FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'visual_scope_denied' USING ERRCODE='42501';END IF;
  IF (v.campagne_id IS DISTINCT FROM (p_visual->>'campagne_id')::bigint OR v.client_id IS DISTINCT FROM owner_id) THEN
   IF public.tos_current_role()<>'Administrateur' THEN RAISE EXCEPTION 'admin_visual_edt_assignment_required' USING ERRCODE='42501';END IF;
   IF links IS NULL THEN SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]') INTO links FROM public.visual_edt_associations a WHERE visual_id=v.id;END IF;
   -- The whole RPC is atomic: failed reattachment restores the prior links and visual.
   PERFORM public.save_visual_edt_associations(v.id,'[]');
  END IF;
 END IF;
 UPDATE public.campagne_visuels_formats SET campagne_id=(p_visual->>'campagne_id')::bigint,client_id=owner_id,
 nom_visuel=p_visual->>'nom_visuel',format_support=p_visual->>'format_support',phase=p_visual->>'phase',code_visuel=p_visual->>'code_visuel',
 quantite_prevue=coalesce((p_visual->>'quantite_prevue')::integer,0),actif=coalesce((p_visual->>'actif')::boolean,true),
 is_out_of_frame=coalesce((p_visual->>'is_out_of_frame')::boolean,false),instructions_terrain=p_visual->>'instructions_terrain',updated_at=now()
 WHERE id=v.id RETURNING * INTO v;
 IF NOT FOUND THEN RAISE EXCEPTION 'visual_scope_denied' USING ERRCODE='42501';END IF;
 IF links IS NOT NULL THEN PERFORM public.save_visual_edt_associations(v.id,links);END IF;
 SELECT * INTO v FROM public.campagne_visuels_formats WHERE id=v.id;
 RETURN to_jsonb(v);
END $$;

-- Queue membership is applied before pagination and counting, inside the existing private photo projection.
CREATE OR REPLACE FUNCTION public.photo_inventory_read(p_table text DEFAULT 'support_photos'::text, p_filters jsonb DEFAULT '{}'::jsonb, p_offset integer DEFAULT 0, p_limit integer DEFAULT 500)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE predicate text;rows jsonb;total bigint;field text;filter record;ordering text:='id';
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.utilisateurs WHERE auth_user_id=auth.uid() AND statut='Actif' AND role IS NOT NULL) THEN RAISE EXCEPTION 'photo_read_denied' USING ERRCODE='42501';END IF;
 IF p_table<>ALL(ARRAY['support_photos','photos','historique_des_campagnes','inspections_terrain','inspections','enjeux_terrain','photo_action_log','activity_events','operations_history','terrain_operations','edt_reports','edt_phase_reports','communications_finales']) THEN RAISE EXCEPTION 'photo_read_table_denied' USING ERRCODE='42501';END IF;
 IF p_table='activity_events' AND public.tos_current_role() NOT IN ('Administrateur','Coordonnateur') THEN RETURN jsonb_build_object('rows','[]'::jsonb,'total',0);END IF;
 predicate:=tdm_private.photo_read_predicate(p_table);
 IF p_table='activity_events' AND coalesce(p_filters->>'recent','false')='true' THEN
  predicate:=predicate||' AND action NOT ILIKE ALL(ARRAY[''%initialisation%'',''%démarrage système%'',''%migration%'',''%chargement supabase%'',''%diagnostic technique%'',''%log développeur%''])';
 END IF;
 IF p_table='activity_events' THEN ordering:='occurred_at DESC,id DESC';END IF;
 FOR filter IN SELECT * FROM jsonb_each(p_filters) LOOP
  IF filter.key='review_queue' THEN
   IF p_table<>'support_photos' OR filter.value<>'true'::jsonb THEN RAISE EXCEPTION 'photo_read_filter_denied';END IF;
   predicate:=predicate||' AND (source=''mass_import'' OR review_status IS NOT NULL OR lower(coalesce(statut_validation,'''')) NOT IN (''validée'',''validee'',''valide'',''validated'',''approved'',''manually_validated'',''rejetée'',''rejetee'',''rejected''))';
   CONTINUE;
  END IF;
  IF p_table='activity_events' AND filter.key='actor_email' AND public.tos_current_role() NOT IN ('Client','Client-Admin') THEN predicate:=predicate||format(' AND actor_email=%L',filter.value#>>'{}');CONTINUE;END IF;
  IF p_table='activity_events' AND filter.key='recent' THEN CONTINUE;END IF;
  IF p_table='activity_events' AND filter.key IN ('date_from','date_to') THEN
   predicate:=predicate||format(' AND occurred_at %s %L::timestamptz',CASE WHEN filter.key='date_from' THEN '>=' ELSE '<=' END,(filter.value#>>'{}')||CASE WHEN filter.key='date_from' THEN 'T00:00:00' ELSE 'T23:59:59.999' END);CONTINUE;
  END IF;
  IF p_table='activity_events' AND filter.key='query' THEN
   predicate:=predicate||format(' AND concat_ws('' '',action,entity_id,support_id,CASE WHEN public.tos_current_role() NOT IN (''Client'',''Client-Admin'') THEN actor_email END) ILIKE %L','%'||(filter.value#>>'{}')||'%');CONTINUE;
  END IF;
  IF filter.key<>ALL(ARRAY['id','support_id','edt_id','campagne_id','deleted_at','import_batch_id','review_status','entity_type','entity_id','module','action','actor_role','campaign_id','status','source_system','client_id']) THEN RAISE EXCEPTION 'photo_read_filter_denied';END IF;
  field:=format('to_jsonb(%I)->>%L',p_table,filter.key);
  IF filter.value='null'::jsonb THEN predicate:=predicate||' AND '||field||' IS NULL';
  ELSIF jsonb_typeof(filter.value)='array' THEN predicate:=predicate||format(' AND %s IN (SELECT jsonb_array_elements_text(%L::jsonb))',field,filter.value::text);
  ELSE predicate:=predicate||format(' AND %s=%L',field,filter.value#>>'{}');END IF;
 END LOOP;
 IF NOT (p_table='activity_events' AND coalesce(p_filters->>'recent','false')='true') THEN
 EXECUTE format('SELECT count(*) FROM public.%I WHERE %s',p_table,predicate) INTO total;END IF;
 EXECUTE format('SELECT coalesce(jsonb_agg(public.photo_visible_json(to_jsonb(r))),''[]'') FROM (SELECT * FROM public.%I WHERE %s ORDER BY %s LIMIT $1 OFFSET $2) r',p_table,predicate,ordering)
 INTO rows USING least(1000,greatest(1,coalesce(p_limit,500))),greatest(0,coalesce(p_offset,0));
 RETURN jsonb_build_object('rows',rows,'total',coalesce(total,jsonb_array_length(rows)));
END $function$
;
