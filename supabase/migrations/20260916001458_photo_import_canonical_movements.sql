ALTER TABLE public.support_photos ADD COLUMN import_context jsonb,
 ADD COLUMN import_finalized_at timestamptz,
 ADD COLUMN movement_history_id bigint REFERENCES public.historique_des_campagnes(id) ON DELETE RESTRICT,
 ADD COLUMN movement_kind text CHECK(movement_kind IN ('installation','retrait'));
ALTER TABLE public.historique_des_campagnes ADD COLUMN movement_meta jsonb NOT NULL DEFAULT '{}',ADD COLUMN import_movement_key text;
CREATE UNIQUE INDEX history_import_movement_key ON public.historique_des_campagnes(import_movement_key) WHERE import_movement_key IS NOT NULL;
CREATE INDEX photos_movement_history ON public.support_photos(movement_history_id,movement_kind);
CREATE INDEX history_support_chronology ON public.historique_des_campagnes(support_id,created_at,id);
CREATE INDEX photos_import_review ON public.support_photos(import_batch_id,review_status,id) WHERE source='mass_import';

-- Clients consult canonical movements; only authorized internal workflows mutate them.
DO $$DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['historique_des_campagnes','inventory_movements'] LOOP
  EXECUTE format('CREATE POLICY movement_internal_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.tos_current_role() NOT IN (''Client'',''Client-Admin''))',t);
  EXECUTE format('CREATE POLICY movement_internal_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.tos_current_role() NOT IN (''Client'',''Client-Admin'')) WITH CHECK (public.tos_current_role() NOT IN (''Client'',''Client-Admin''))',t);
  EXECUTE format('CREATE POLICY movement_internal_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.tos_current_role() NOT IN (''Client'',''Client-Admin''))',t);
 END LOOP;
END $$;

CREATE TABLE tdm_private.display_baselines(support_id text PRIMARY KEY,state jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE tdm_private.display_baselines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tdm_private.display_baselines FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.photo_inventory_capabilities() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor public.utilisateurs%rowtype;config jsonb;
BEGIN
 SELECT * INTO actor FROM public.utilisateurs WHERE auth_user_id=auth.uid() AND statut='Actif';
 IF NOT FOUND OR actor.role IS NULL OR (actor.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients WHERE id=actor.client_id)) THEN RAISE EXCEPTION 'photo_actor_denied' USING ERRCODE='42501';END IF;
 SELECT capabilities INTO config FROM public.role_ui_permissions WHERE role=actor.role;
 RETURN jsonb_build_object('import',actor.role IN ('Administrateur','Coordonnateur'),
  'cancel',actor.role='Administrateur' OR (actor.role NOT IN ('Client','Client-Admin') AND coalesce(config->'Photos et inventaire'->>'delete','false')='true'),
  'author',actor.role NOT IN ('Client','Client-Admin'));
END $$;

CREATE FUNCTION tdm_private.display_state(p_support text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('campagne_actuelle',i.campagne_actuelle,'campagne_selon_visuel',i.campagne_selon_visuel,
 'visuel_campagne',i.visuel_campagne,'visuel_en_expo',i.visuel_en_expo,'visuel_actuel_cadre',i.visuel_actuel_cadre,
 'visuel_id',i.visuel_id,'phase_campagne',i.phase_campagne,'format_visuel',i.format_visuel,'edt_associe',i.edt_associe,
 'photo_principale_url',i.photo_principale_url,'photo_miniature_url',i.photo_miniature_url,'date_visuel_actuel',i.date_visuel_actuel,
 'date_derniere_manipulation',i.date_derniere_manipulation,'campagne_precedente',i.campagne_precedente,
 'visuel_precedent',i.visuel_precedent,'edt_precedent_associe',i.edt_precedent_associe)
 FROM public.infrastructures i WHERE i.support_id=p_support
$$;
CREATE FUNCTION tdm_private.capture_display_baseline(p_support text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO tdm_private.display_baselines(support_id,state)
 SELECT p_support,tdm_private.display_state(p_support)
 WHERE NOT EXISTS(SELECT 1 FROM public.historique_des_campagnes WHERE support_id=p_support AND (nullif(date_installation,'') IS NOT NULL OR nullif(date_retrait,'') IS NOT NULL))
 ON CONFLICT DO NOTHING;
END $$;
CREATE FUNCTION tdm_private.apply_display_state(p_support text,p_state jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.infrastructures SET
 campagne_actuelle=p_state->>'campagne_actuelle',campagne_selon_visuel=p_state->>'campagne_selon_visuel',
 visuel_campagne=p_state->>'visuel_campagne',visuel_en_expo=p_state->>'visuel_en_expo',visuel_actuel_cadre=p_state->>'visuel_actuel_cadre',
 visuel_id=nullif(p_state->>'visuel_id','')::bigint,phase_campagne=p_state->>'phase_campagne',format_visuel=p_state->>'format_visuel',edt_associe=p_state->>'edt_associe',
 photo_principale_url=p_state->>'photo_principale_url',photo_miniature_url=p_state->>'photo_miniature_url',date_visuel_actuel=nullif(p_state->>'date_visuel_actuel','')::timestamptz,
 date_derniere_manipulation=p_state->>'date_derniere_manipulation',campagne_precedente=p_state->>'campagne_precedente',visuel_precedent=p_state->>'visuel_precedent',edt_precedent_associe=p_state->>'edt_precedent_associe',updated_at=now()
 WHERE support_id=p_support;
END $$;
CREATE FUNCTION tdm_private.movement_time(p_value text,p_fallback timestamptz) RETURNS timestamptz
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
BEGIN RETURN coalesce(nullif(p_value,'')::timestamptz,p_fallback);EXCEPTION WHEN OTHERS THEN RETURN p_fallback;END $$;

CREATE FUNCTION tdm_private.display_events(p_support text DEFAULT NULL) RETURNS TABLE(history_id bigint,movement_kind text,event_at timestamptz,cancelled boolean,event_state jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT h.id,k.kind,tdm_private.movement_time(k.date_value,h.created_at),h.movement_meta->'cancellations' ? k.kind,
 coalesce(h.movement_meta->k.kind->'state',jsonb_build_object(
 'campagne_actuelle',h.campagne,'campagne_selon_visuel',h.campagne,'visuel_campagne',h.visuel,'visuel_en_expo',h.visuel,
 'visuel_id',p.visuel_id,'phase_campagne',v.phase,'format_visuel',v.format_support,'edt_associe',h.no_edt,
 'photo_principale_url',h.photo_installation,'photo_miniature_url',h.photo_installation,'visuel_actuel_cadre',h.photo_installation,
 'date_visuel_actuel',tdm_private.movement_time(k.date_value,h.created_at)))
 FROM public.historique_des_campagnes h
 CROSS JOIN LATERAL (VALUES('installation',h.date_installation),('retrait',h.date_retrait))k(kind,date_value)
 LEFT JOIN public.support_photos p ON p.support_id=h.support_id AND p.id=CASE WHEN h.raw_data->>'photo_id' ~ '^[0-9]+$' THEN (h.raw_data->>'photo_id')::bigint END
 LEFT JOIN public.campagne_visuels_formats v ON v.id=p.visuel_id
 WHERE (p_support IS NULL OR h.support_id=p_support) AND nullif(trim(k.date_value),'') IS NOT NULL
$$;
CREATE FUNCTION tdm_private.rebuild_display(p_support text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE state jsonb;event record;previous jsonb;last_history bigint;last_kind text;
BEGIN
 PERFORM 1 FROM public.infrastructures WHERE support_id=p_support FOR UPDATE;
 SELECT b.state INTO state FROM tdm_private.display_baselines b WHERE b.support_id=p_support;
 state:=coalesce(state,'{}');
 FOR event IN SELECT * FROM tdm_private.display_events(p_support) WHERE NOT coalesce(cancelled,false) ORDER BY event_at,history_id,movement_kind LOOP
  previous:=jsonb_build_object('campagne_precedente',coalesce(nullif(state->'campagne_actuelle','null'),state->'campagne_precedente'),
   'visuel_precedent',coalesce(nullif(state->'visuel_campagne','null'),state->'visuel_precedent'),'edt_precedent_associe',coalesce(nullif(state->'edt_associe','null'),state->'edt_precedent_associe'));
  IF event.movement_kind='installation' THEN
   state:=state||event.event_state||previous;
  ELSE
   state:=previous||jsonb_build_object('campagne_actuelle',NULL,'campagne_selon_visuel',NULL,'visuel_campagne',NULL,'visuel_en_expo',NULL,'visuel_id',NULL,'phase_campagne',NULL,'format_visuel',NULL,'edt_associe',NULL,'photo_principale_url',NULL,'photo_miniature_url',NULL,'visuel_actuel_cadre',NULL,'date_visuel_actuel',NULL);
  END IF;
  state:=state||jsonb_build_object('date_derniere_manipulation',event.event_at);last_history:=event.history_id;last_kind:=event.movement_kind;
 END LOOP;
 UPDATE public.support_photos SET est_principale=false,is_current_visual=false WHERE support_id=p_support AND (est_principale OR is_current_visual);
 IF last_kind='installation' THEN
  UPDATE public.support_photos SET est_principale=true,is_current_visual=true WHERE id=(SELECT min(id) FROM public.support_photos WHERE support_id=p_support AND movement_history_id=last_history AND movement_kind='installation' AND deleted_at IS NULL);
 END IF;
 -- Apply after photo triggers so an older/removed photo cannot win the replay.
 PERFORM tdm_private.apply_display_state(p_support,state);RETURN state;
END $$;

CREATE FUNCTION tdm_private.record_display_movement() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE kind text;BEGIN
 NEW.client_id:=coalesce(NEW.client_id,(SELECT client_id FROM public.infrastructures WHERE support_id=NEW.support_id));
 FOREACH kind IN ARRAY ARRAY['installation','retrait'] LOOP
  IF NEW.raw_data ? 'reference' AND nullif(CASE kind WHEN 'installation' THEN NEW.date_installation ELSE NEW.date_retrait END,'') IS NOT NULL AND NOT NEW.movement_meta ? kind THEN
   NEW.movement_meta:=NEW.movement_meta||jsonb_build_object(kind,jsonb_build_object('state',tdm_private.display_state(NEW.support_id)));
  END IF;
 END LOOP;RETURN NEW;
END $$;
CREATE TRIGGER record_display_movement BEFORE INSERT ON public.historique_des_campagnes FOR EACH ROW EXECUTE FUNCTION tdm_private.record_display_movement();
CREATE FUNCTION tdm_private.link_movement_photo() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.support_photos SET movement_history_id=NEW.id,movement_kind=CASE WHEN nullif(NEW.date_retrait,'') IS NOT NULL THEN 'retrait' ELSE 'installation' END
 WHERE id=CASE WHEN NEW.raw_data->>'photo_id' ~ '^[0-9]+$' THEN (NEW.raw_data->>'photo_id')::bigint END AND support_id=NEW.support_id;
 RETURN NEW;
END $$;
CREATE TRIGGER link_movement_photo AFTER INSERT ON public.historique_des_campagnes FOR EACH ROW EXECUTE FUNCTION tdm_private.link_movement_photo();

CREATE FUNCTION public.cancel_display_movement(p_history_id bigint,p_kind text,p_reason text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE h public.historique_des_campagnes%rowtype;state jsonb;
BEGIN
 IF NOT coalesce((public.photo_inventory_capabilities()->>'cancel')::boolean,false) THEN RAISE EXCEPTION 'movement_cancel_denied' USING ERRCODE='42501';END IF;
 SELECT * INTO h FROM public.historique_des_campagnes WHERE id=p_history_id;
 IF NOT FOUND OR p_kind NOT IN ('installation','retrait') OR NOT public.tos_table_resource_scope(h.client_id,h.support_id,NULL,NULL,false) THEN RAISE EXCEPTION 'movement_scope_denied' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.infrastructures WHERE support_id=h.support_id FOR UPDATE;
 SELECT * INTO h FROM public.historique_des_campagnes WHERE id=p_history_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM tdm_private.display_events(h.support_id) WHERE history_id=h.id AND movement_kind=p_kind) THEN RAISE EXCEPTION 'movement_not_found';END IF;
 IF h.movement_meta->'cancellations' ? p_kind THEN RETURN jsonb_build_object('ok',true,'already_cancelled',true);END IF;
 UPDATE public.historique_des_campagnes SET movement_meta=movement_meta||jsonb_build_object('cancellations',coalesce(movement_meta->'cancellations','{}')||jsonb_build_object(p_kind,jsonb_build_object('at',now(),'by',auth.uid(),'reason',nullif(trim(p_reason),'')))),updated_at=now() WHERE id=h.id;
 state:=tdm_private.rebuild_display(h.support_id);
 RETURN jsonb_build_object('ok',true,'state',state,'photos_preserved',true);
END $$;

CREATE FUNCTION public.list_display_movements(p_support text DEFAULT NULL,p_edt text DEFAULT NULL,p_search text DEFAULT '',p_cancelled boolean DEFAULT false,p_offset integer DEFAULT 0,p_limit integer DEFAULT 100,p_sort text DEFAULT 'recent')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE rows jsonb;total bigint;predicate text;query text;
BEGIN
 PERFORM public.photo_inventory_capabilities();
 IF public.tos_current_role() IN ('Client','Client-Admin') AND NOT public.portal_view_allowed('Photos et inventaire') THEN RAISE EXCEPTION 'inventory_read_denied' USING ERRCODE='42501';END IF;
 predicate:=tdm_private.photo_read_predicate('historique_des_campagnes');
 -- The inventory capability intentionally allows own-tenant movements even if
 -- the separate generic History module is not visible to this client role.
 IF public.tos_current_role() IN ('Client','Client-Admin') THEN predicate:='public.tos_table_resource_scope(client_id,support_id,NULL,NULL,false)';END IF;
 query:=format($q$WITH allowed AS(SELECT * FROM public.historique_des_campagnes WHERE %s), items AS(
 SELECT h.id::text||':'||e.movement_kind id,h.id history_id,e.movement_kind,e.event_at,e.cancelled,h.support_id,h.no_edt edt_number,h.campagne campaign,h.visuel visual,h.client_id,
 CASE WHEN h.import_movement_key IS NOT NULL THEN 'Import massif' WHEN h.raw_data ? 'reference' THEN 'Terrain' ELSE 'Manuel' END source,
 CASE WHEN coalesce(e.cancelled,false) THEN 'CANCELLED' ELSE 'ACTIVE' END status,
 h.utilisateur author,(SELECT coalesce(jsonb_agg(public.photo_visible_json(to_jsonb(p))),'[]') FROM public.support_photos p WHERE p.deleted_at IS NULL AND p.support_id=h.support_id AND public.tos_table_resource_scope(p.client_id,p.support_id,p.campagne_id,CASE WHEN p.edt_id ~ '^[0-9]+$' THEN p.edt_id::bigint END,false) AND (p.movement_history_id=h.id AND p.movement_kind=e.movement_kind OR p.id=CASE WHEN h.raw_data->>'photo_id' ~ '^[0-9]+$' THEN (h.raw_data->>'photo_id')::bigint END)) photos
 FROM allowed h JOIN tdm_private.display_events($1) e ON e.history_id=h.id
 WHERE ($2 IS NULL OR h.no_edt=$2) AND ($3 OR NOT coalesce(e.cancelled,false))
 AND ($4='' OR concat_ws(' ',h.support_id,h.no_edt,h.campagne,h.visuel,e.event_at::date,e.movement_kind) ILIKE '%%'||$4||'%%'))
 SELECT jsonb_build_object('total',(SELECT count(*) FROM items),'rows',(SELECT coalesce(jsonb_agg(public.photo_visible_json(to_jsonb(r))),'[]') FROM (SELECT * FROM items ORDER BY CASE WHEN $7='oldest' THEN event_at END ASC,CASE WHEN $7='support' THEN support_id END ASC,event_at DESC,id LIMIT $5 OFFSET $6)r))$q$,predicate);
 EXECUTE query INTO rows USING p_support,p_edt,p_cancelled,coalesce(p_search,''),least(500,greatest(1,p_limit)),greatest(0,p_offset),p_sort;
 RETURN rows;
END $$;

CREATE FUNCTION public.display_current_state(p_support text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.photo_inventory_capabilities();
 IF public.tos_current_role() IN ('Client','Client-Admin') AND NOT public.portal_view_allowed('Photos et inventaire') THEN RAISE EXCEPTION 'inventory_read_denied' USING ERRCODE='42501';END IF;
 IF NOT public.tos_table_resource_scope(NULL,p_support,NULL,NULL,false) THEN RAISE EXCEPTION 'support_scope_denied' USING ERRCODE='42501';END IF;
 RETURN public.photo_visible_json(tdm_private.display_state(p_support));
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA tdm_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.photo_inventory_capabilities(),public.cancel_display_movement(bigint,text,text),public.list_display_movements(text,text,text,boolean,integer,integer,text),public.display_current_state(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.photo_inventory_capabilities(),public.cancel_display_movement(bigint,text,text),public.list_display_movements(text,text,text,boolean,integer,integer,text),public.display_current_state(text) TO authenticated;

CREATE FUNCTION public.save_photo_import_context(p_photo_id bigint,p_context jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE photo public.support_photos%rowtype;support text;
BEGIN
 IF NOT coalesce((public.photo_inventory_capabilities()->>'import')::boolean,false) THEN RAISE EXCEPTION 'import_denied' USING ERRCODE='42501';END IF;
 SELECT * INTO photo FROM public.support_photos WHERE id=p_photo_id FOR UPDATE;
 IF NOT FOUND OR photo.source<>'mass_import' OR photo.import_finalized_at IS NOT NULL OR photo.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'import_draft_required';END IF;
 IF NOT public.tos_remaining_tenant_scope('support_photos',to_jsonb(photo),'read') THEN RAISE EXCEPTION 'import_photo_scope_denied' USING ERRCODE='42501';END IF;
 support:=p_context->'recognition'->'values'->>'support';
 IF support IS NOT NULL AND NOT public.tos_table_resource_scope(NULL,support,NULL,NULL,false) THEN RAISE EXCEPTION 'import_support_scope_denied' USING ERRCODE='42501';END IF;
 IF octet_length(p_context::text)>200000 THEN RAISE EXCEPTION 'import_context_too_large';END IF;
 UPDATE public.support_photos SET import_context=p_context,
 review_status=CASE WHEN support IS NULL THEN 'unmatched' ELSE 'needs_review' END,
 proposed_support_id=support,updated_at=now() WHERE id=photo.id RETURNING * INTO photo;
 RETURN to_jsonb(photo);
END $$;

CREATE FUNCTION public.finalize_import_photo(p_photo_id bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE photo public.support_photos%rowtype;actor public.utilisateurs%rowtype;infra public.infrastructures%rowtype;
 edt public.suivi_des_edt%rowtype;phase public.edt_phases%rowtype;visual public.campagne_visuels_formats%rowtype;campaign public.campagnes_maitres%rowtype;
 values jsonb;states jsonb;field text;kind text;captured timestamptz;without_edt boolean;history_id bigint;key text;state jsonb;photo_ref text;seq integer;filename text;extension text;
BEGIN
 IF NOT coalesce((public.photo_inventory_capabilities()->>'import')::boolean,false) THEN RAISE EXCEPTION 'import_denied' USING ERRCODE='42501';END IF;
 SELECT * INTO actor FROM public.utilisateurs WHERE auth_user_id=auth.uid() AND statut='Actif';
 SELECT * INTO photo FROM public.support_photos WHERE id=p_photo_id;
 IF NOT FOUND OR photo.source<>'mass_import' OR photo.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'import_photo_required';END IF;
 IF NOT public.tos_remaining_tenant_scope('support_photos',to_jsonb(photo),'read') THEN RAISE EXCEPTION 'import_photo_scope_denied' USING ERRCODE='42501';END IF;
 IF photo.import_finalized_at IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'already_finalized',true,'photo_id',photo.id,'history_id',photo.movement_history_id);END IF;
 values:=photo.import_context->'recognition'->'values';states:=photo.import_context->'recognition'->'states';
 FOREACH field IN ARRAY ARRAY['support','date','type','edt','phase','campaign','visual'] LOOP
  IF coalesce(states->>field,'TO_REVIEW') NOT IN ('AUTO_CONFIRMED','MANUAL_CONFIRMED','NOT_APPLICABLE') THEN RAISE EXCEPTION 'import_field_requires_review: %',field;END IF;
 END LOOP;
 IF states->>'support'='NOT_APPLICABLE' OR states->>'date'='NOT_APPLICABLE' OR states->>'type'='NOT_APPLICABLE' THEN RAISE EXCEPTION 'import_required_context';END IF;
 kind:=values->>'type';captured:=(values->>'date')::timestamptz;without_edt:=coalesce((values->>'withoutEdt')::boolean,false);
 IF kind IS NULL OR kind NOT IN ('installation','retrait','inspection','enjeu','photo') OR captured IS NULL OR captured>now()+interval '1 day' THEN RAISE EXCEPTION 'import_type_date_invalid';END IF;
 SELECT * INTO infra FROM public.infrastructures WHERE support_id=values->>'support' FOR UPDATE;
 IF NOT FOUND OR NOT public.tos_table_resource_scope(infra.client_id,infra.support_id,NULL,NULL,false) THEN RAISE EXCEPTION 'import_support_scope_denied' USING ERRCODE='42501';END IF;
 -- Same lock order as cancellation and Terrain: support, then photo/history.
 SELECT * INTO photo FROM public.support_photos WHERE id=p_photo_id FOR UPDATE;
 IF photo.import_finalized_at IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'already_finalized',true,'photo_id',photo.id,'history_id',photo.movement_history_id);END IF;
 IF photo.import_context->'recognition'->'values' IS DISTINCT FROM values OR photo.import_context->'recognition'->'states' IS DISTINCT FROM states THEN RAISE EXCEPTION 'import_context_changed_retry' USING ERRCODE='40001';END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id=photo.storage_bucket AND name=photo.storage_path) THEN RAISE EXCEPTION 'import_original_missing';END IF;
 IF kind IN ('installation','retrait') THEN
  IF NOT without_edt THEN
   SELECT * INTO edt FROM public.suivi_des_edt WHERE id=(values->>'edt')::bigint;
   SELECT * INTO phase FROM public.edt_phases WHERE id=(values->>'phase')::bigint;
   IF edt.id IS NULL OR phase.id IS NULL OR phase.edt_id<>edt.id OR phase.phase_type<>kind OR edt.client_id IS DISTINCT FROM infra.client_id
    OR NOT EXISTS(SELECT 1 FROM public.edt_supports WHERE edt_id=edt.id AND support_id=infra.support_id)
   THEN RAISE EXCEPTION 'import_edt_context_invalid';END IF;
  ELSIF kind<>'installation' THEN RAISE EXCEPTION 'without_edt_installation_only';END IF;
  SELECT * INTO campaign FROM public.campagnes_maitres WHERE id=(values->>'campaign')::bigint;
  SELECT * INTO visual FROM public.campagne_visuels_formats WHERE id=(values->>'visual')::bigint;
  IF campaign.id IS NULL OR visual.id IS NULL OR campaign.client_id IS DISTINCT FROM infra.client_id OR visual.client_id IS DISTINCT FROM infra.client_id OR visual.campagne_id<>campaign.id
   OR campaign.business_context NOT IN ('marketing','operational_communication') OR edt.campagne_id IS NOT NULL AND edt.campagne_id<>campaign.id
   OR (visual.is_out_of_frame OR nullif(regexp_replace(lower(replace(replace(visual.format_support,',','.'),'×','x')),'(portrait|paysage|landscape|\s)','','g'),'')=nullif(regexp_replace(lower(replace(replace(infra.format_affichage,',','.'),'×','x')),'(portrait|paysage|landscape|\s)','','g'),'')) IS NOT TRUE
  THEN RAISE EXCEPTION 'import_visual_context_invalid';END IF;
  key:=md5(concat_ws('|',infra.client_id,infra.support_id,coalesce(edt.id::text,'WITHOUT_EDT'),kind,(captured AT TIME ZONE 'America/Toronto')::date,visual.id));
  SELECT id INTO history_id FROM public.historique_des_campagnes WHERE import_movement_key=key;
  IF history_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.historique_des_campagnes h WHERE h.import_movement_key=key AND h.movement_meta->'cancellations' ? kind) THEN RAISE EXCEPTION 'import_movement_cancelled';END IF;
  IF history_id IS NULL THEN
   -- Reuse a uniquely matching canonical Terrain intervention when importing
   -- additional evidence of that same dated support/phase/visual operation.
   SELECT CASE WHEN count(*)=1 THEN min(h.id) END INTO history_id
   FROM public.historique_des_campagnes h JOIN tdm_private.display_events(infra.support_id) ev ON ev.history_id=h.id
   WHERE ev.movement_kind=kind AND NOT coalesce(ev.cancelled,false)
    AND (ev.event_at AT TIME ZONE 'America/Toronto')::date=(captured AT TIME ZONE 'America/Toronto')::date
    AND ev.event_state->>'visuel_id'=visual.id::text
    AND (without_edt AND h.raw_data->>'installation_sans_edt'='true' OR NOT without_edt AND h.raw_data->>'edt_phase_id'=phase.id::text);
  END IF;
 END IF;
 photo_ref:=photo.storage_bucket||'/'||photo.storage_path;
 SELECT count(*)+1 INTO seq FROM public.support_photos WHERE support_id=infra.support_id AND (prise_le AT TIME ZONE 'America/Toronto')::date=(captured AT TIME ZONE 'America/Toronto')::date AND lower(type_photo)=kind AND import_finalized_at IS NOT NULL;
 extension:=lower(substring(photo.original_filename from '\.([A-Za-z0-9]+)$'));
 filename:=regexp_replace(infra.support_id,'[^A-Za-z0-9_-]','-','g')||'_'||to_char(captured AT TIME ZONE 'America/Toronto','YYYY-MM-DD')||'_'||upper(kind)||'_'||coalesce(campaign.id::text,'NONE')||'_'||coalesce(edt.no_edt,'NONE')||'_'||lpad(seq::text,3,'0')||'.'||coalesce(extension,'jpg');
 PERFORM tdm_private.capture_display_baseline(infra.support_id);
 UPDATE public.support_photos SET support_id=infra.support_id,client_id=infra.client_id,campagne_id=campaign.id,visuel_id=visual.id,edt_id=edt.id::text,
 type_photo=initcap(kind),captured_at=captured,prise_le=captured,normalized_filename=filename,nom_fichier=filename,
 photo_url=photo_ref,thumbnail_url=photo_ref,statut_validation='Validée',review_status=CASE WHEN states::text LIKE '%MANUAL_CONFIRMED%' THEN 'manually_validated' ELSE 'auto_matched' END,
 import_finalized_at=now(),validee_le=now(),validee_par=auth.uid(),est_principale=false,is_current_visual=false,
 metadata=coalesce(metadata,'{}')||jsonb_build_object('installation_sans_edt',without_edt,'edt_number',edt.no_edt,'date_source',photo.import_context->'recognition'->>'dateSource','original_storage_path',photo.storage_path,'validated_by',auth.uid()),
 updated_at=now() WHERE id=photo.id;
 IF kind IN ('installation','retrait') THEN
  IF history_id IS NULL THEN
   state:=jsonb_build_object('campagne_actuelle',campaign.nom_campagne,'campagne_selon_visuel',campaign.nom_campagne,'visuel_campagne',visual.nom_visuel,'visuel_en_expo',visual.nom_visuel,
    'visuel_id',visual.id,'phase_campagne',visual.phase,'format_visuel',visual.format_support,'edt_associe',edt.no_edt,'photo_principale_url',photo_ref,'photo_miniature_url',photo_ref,'visuel_actuel_cadre',photo_ref,'date_visuel_actuel',captured);
   INSERT INTO public.historique_des_campagnes(support_id,client_id,campagne,visuel,no_edt,date_installation,date_retrait,photo_installation,utilisateur,raw_data,movement_meta,import_movement_key)
   VALUES(infra.support_id,infra.client_id,campaign.nom_campagne,visual.nom_visuel,edt.no_edt,CASE WHEN kind='installation' THEN captured::text END,CASE WHEN kind='retrait' THEN captured::text END,photo_ref,actor.courriel,
    jsonb_build_object('source','mass_import','photo_id',photo.id,'edt_id',edt.id,'edt_phase_id',phase.id,'business_context',campaign.business_context,'installation_sans_edt',without_edt),jsonb_build_object(kind,jsonb_build_object('state',state)),key) RETURNING id INTO history_id;
  END IF;
  UPDATE public.support_photos SET movement_history_id=history_id,movement_kind=kind WHERE id=photo.id;
  PERFORM tdm_private.rebuild_display(infra.support_id);
 ELSE
  -- An inspection/issue/photo is not an advertising movement and must not
  -- replace the installed display through thumbnail synchronization triggers.
  PERFORM tdm_private.apply_display_state(infra.support_id,jsonb_build_object('campagne_actuelle',infra.campagne_actuelle)||
   (SELECT jsonb_object_agg(k,to_jsonb(infra)->k) FROM jsonb_object_keys(tdm_private.display_state(infra.support_id))k));
 END IF;
 RETURN jsonb_build_object('ok',true,'photo_id',photo.id,'history_id',history_id,'filename',filename,'original_preserved',true);
END $$;
REVOKE ALL ON FUNCTION public.save_photo_import_context(bigint,jsonb),public.finalize_import_photo(bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_photo_import_context(bigint,jsonb),public.finalize_import_photo(bigint) TO authenticated;



-- Canonical Terrain integration: unchanged inputs and business decisions.

CREATE OR REPLACE FUNCTION public.finaliser_installation_terrain_v1344(p_support_id text, p_visuel_id bigint, p_nom_fichier text, p_storage_path text, p_photo_url text, p_utilisateur text DEFAULT NULL::text, p_commentaires text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text, p_edt_phase_id bigint DEFAULT NULL::bigint, p_sans_edt boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare

  v_user public.utilisateurs%rowtype;v_prior public.terrain_operations%rowtype;
  v_ref text:=coalesce(nullif(trim(p_idempotency_key),''),'INSTALL-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||regexp_replace(p_support_id,'[^A-Za-z0-9]','','g'));
  v_op uuid;v_visual public.campagne_visuels_formats%rowtype;v_campaign public.campagnes_maitres%rowtype;
  v_infra public.infrastructures%rowtype;v_photo public.support_photos%rowtype;v_edt public.suivi_des_edt%rowtype;v_email text;
BEGIN
IF p_sans_edt IS NULL OR (p_sans_edt AND p_edt_phase_id IS NOT NULL) OR (NOT p_sans_edt AND p_edt_phase_id IS NULL) THEN RAISE EXCEPTION 'installation_context_required' USING ERRCODE='23502';END IF;
PERFORM 1 FROM public.campagne_visuels_formats WHERE id=p_visuel_id FOR SHARE;
IF NOT p_sans_edt AND NOT EXISTS(SELECT 1 FROM public.visual_edt_associations a WHERE a.visual_id=p_visuel_id AND a.phase_id=p_edt_phase_id) THEN RAISE EXCEPTION 'visual_edt_association_required' USING ERRCODE='42501';END IF;
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur','Installateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF p_edt_phase_id IS NOT NULL THEN
IF (EXISTS(SELECT 1 FROM public.edt_phases sec_phase JOIN public.suivi_des_edt sec_edt ON sec_edt.id=sec_phase.edt_id WHERE sec_phase.id=p_edt_phase_id AND (sec_phase.client_id IS NULL OR sec_phase.client_id=sec_edt.client_id) AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'phase_scope_denied' USING ERRCODE='42501';END IF;
END IF;
IF (public.tos_table_resource_scope(NULL,p_support_id,NULL,(SELECT sec_phase.edt_id FROM public.edt_phases sec_phase WHERE sec_phase.id=p_edt_phase_id),false)) IS NOT TRUE THEN RAISE EXCEPTION 'support_scope_denied' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.campagne_visuels_formats sec_visual WHERE sec_visual.id=p_visuel_id AND public.tos_table_resource_scope(sec_visual.client_id,p_support_id,sec_visual.campagne_id,(SELECT sec_phase.edt_id FROM public.edt_phases sec_phase WHERE sec_phase.id=p_edt_phase_id),false))) IS NOT TRUE THEN RAISE EXCEPTION 'visual_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into v_user from public.utilisateurs where auth_user_id=auth.uid() and statut='Actif' limit 1;
  if not found or v_user.role not in ('Administrateur','Coordonnateur','Installateur') then raise exception 'terrain_role_denied' using errcode='42501'; end if;

  select * into v_infra from public.infrastructures where support_id=p_support_id for update;
  IF NOT FOUND THEN RAISE EXCEPTION 'support_not_found'; END IF;
  PERFORM tdm_private.capture_display_baseline(p_support_id);
  if not found then raise exception 'support_not_found'; end if;
  if p_edt_phase_id is not null then
  select e.* into v_edt from public.edt_phases ep
  join public.suivi_des_edt e on e.id=ep.edt_id
  where ep.id=p_edt_phase_id and ep.phase_type='installation' and e.archived_at is null;
  if not found then raise exception 'cross_context_support_denied' using errcode='42501'; end if;
  if v_infra.client_id is null or v_edt.client_id is null or v_infra.client_id<>v_edt.client_id then raise exception 'cross_client_denied' using errcode='42501'; end if;
  end if;
  if v_user.client_id is not null and v_user.client_id<>v_infra.client_id then raise exception 'cross_client_denied' using errcode='42501'; end if;

  select * into v_visual from public.campagne_visuels_formats where id=p_visuel_id and actif;
  if not found then raise exception 'visual_campaign_denied' using errcode='42501'; end if;
  select * into v_campaign from public.campagnes_maitres where id=v_visual.campagne_id and publiee_terrain and lower(coalesce(statut,''))='active';
  if not found or v_campaign.business_context not in ('marketing','operational_communication') then raise exception 'visual_campaign_denied' using errcode='42501'; end if;
  if v_campaign.id<>v_edt.campagne_id then raise exception 'visual_campaign_context_denied' using errcode='42501'; end if;
  if v_campaign.client_id is distinct from v_infra.client_id or v_visual.client_id is distinct from v_infra.client_id then raise exception 'cross_client_denied' using errcode='42501'; end if;
  if not public.terrain_visual_is_eligible_v1331(p_support_id,p_visuel_id) then raise exception 'visual_support_denied' using errcode='42501'; end if;
  v_email:=coalesce(nullif(v_user.courriel,''),(select email from auth.users where id=auth.uid()));

  if p_storage_path is null or left(p_storage_path,length('supports/'||p_support_id||'/')) is distinct from 'supports/'||p_support_id||'/'
     or p_storage_path ~ '(^|/)[.][.]?(/|$)|//|[?#%]'
     or not exists(select 1 from storage.objects o where o.bucket_id='terrain-photos' and o.name=p_storage_path and o.owner_id=auth.uid()::text)
  then raise exception 'photo_scope_denied' using errcode='42501';end if;
  p_photo_url:='terrain-photos/'||p_storage_path;
  select * into v_prior from public.terrain_operations where reference=v_ref for update;
  if found then
    if v_prior.support_id is distinct from p_support_id or v_prior.type_operation is distinct from 'installation' then raise exception 'terrain_idempotency_conflict' using errcode='40001';end if;
    if v_prior.statut='Réussie' then
      if (v_prior.details->>'edt_phase_id')::bigint is distinct from p_edt_phase_id or not exists(select 1 from public.support_photos p where p.id=(v_prior.details->>'photo_id')::bigint and p.support_id=p_support_id and p.storage_path=p_storage_path and p.visuel_id=p_visuel_id) then raise exception 'terrain_idempotency_conflict' using errcode='40001';end if;
      return jsonb_build_object('ok',true,'reference',v_ref,'support_id',p_support_id,'campagne',v_prior.details->>'campagne','visuel',v_prior.details->>'visuel','edt',v_prior.details->>'edt','edt_id',v_edt.id,'edt_phase_id',p_edt_phase_id,'photo_id',v_prior.details->'photo_id');
    end if;
  end if;
  insert into public.terrain_operations(reference,type_operation,support_id,utilisateur)
  values(v_ref,'installation',p_support_id,v_email)
  on conflict(reference) do update set reference=excluded.reference returning id into v_op;
  update public.support_photos set est_principale=false where support_id=p_support_id and est_principale;
  insert into public.support_photos(storage_bucket,client_id,support_id,campagne_id,visuel_id,type_photo,nom_fichier,storage_path,photo_url,thumbnail_url,prise_le,utilisateur,statut_validation,est_principale,validee_le)
  values('terrain-photos',v_infra.client_id,p_support_id,v_campaign.id,v_visual.id,'Installation',p_nom_fichier,p_storage_path,p_photo_url,p_photo_url,now(),v_email,'Validée',true,now()) on conflict do nothing;
  select * into v_photo from public.support_photos where support_id=p_support_id and storage_path=p_storage_path order by id desc limit 1;
  if not found then raise exception 'photo_not_persisted'; end if;

  update public.support_photos set edt_id=v_edt.id::text, metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('installation_sans_edt',p_sans_edt,'edt_number',v_edt.no_edt,'edt_phase_id',p_edt_phase_id,'operation_label',case when p_sans_edt then 'Installation sans EDT' else 'Installation' end) where id=v_photo.id;
  PERFORM tdm_private.apply_display_state(p_support_id,tdm_private.display_state(p_support_id)||(SELECT jsonb_build_object('campagne_precedente',case when campagne_actuelle is distinct from v_campaign.nom_campagne then campagne_actuelle else campagne_precedente end,'visuel_precedent',case when visuel_campagne is distinct from v_visual.nom_visuel then visuel_campagne else visuel_precedent end,'edt_precedent_associe',case when edt_associe is distinct from v_edt.no_edt then edt_associe else edt_precedent_associe end,'campagne_actuelle',v_campaign.nom_campagne,'campagne_selon_visuel',v_campaign.nom_campagne,'visuel_campagne',v_visual.nom_visuel,'visuel_en_expo',v_visual.nom_visuel,'visuel_actuel_cadre',p_photo_url,'visuel_id',v_visual.id,'phase_campagne',v_visual.phase,'format_visuel',v_visual.format_support,'edt_associe',v_edt.no_edt,'photo_principale_url',p_photo_url,'photo_miniature_url',p_photo_url,'date_derniere_manipulation',now()::text) FROM public.infrastructures WHERE support_id=p_support_id));
UPDATE public.infrastructures SET commentaires=coalesce(nullif(p_commentaires,''),commentaires) WHERE support_id=p_support_id;
SELECT * INTO v_infra FROM public.infrastructures WHERE support_id=p_support_id;

  insert into public.historique_des_campagnes(support_id,campagne,visuel,no_edt,date_installation,photo_installation,utilisateur,raw_data)
  values(p_support_id,v_campaign.nom_campagne,v_visual.nom_visuel,v_edt.no_edt,now()::text,p_photo_url,v_email,
    jsonb_build_object('reference',v_ref,'photo_id',v_photo.id,'source','v1.3.3.1','edt_id',v_edt.id,'edt_phase_id',p_edt_phase_id,'business_context',v_campaign.business_context,'installation_sans_edt',p_sans_edt,'operation_label',case when p_sans_edt then 'Installation sans EDT' else 'Installation' end));
  update public.edt_supports set statut='Terminé',progression=100,completed_at=coalesce(completed_at,now()),updated_at=now()
  where edt_id=v_edt.id and phase_id=p_edt_phase_id and support_id=p_support_id;
  if v_edt.id is not null then perform public.refresh_edt_enterprise(v_edt.id);end if;
  update public.terrain_operations set statut='Réussie',etape='Terminée',details=jsonb_build_object('campagne',v_campaign.nom_campagne,'visuel',v_visual.nom_visuel,'edt',v_edt.no_edt,'edt_phase_id',p_edt_phase_id,'photo_id',v_photo.id,'installation_sans_edt',p_sans_edt,'operation_label',case when p_sans_edt then 'Installation sans EDT' else 'Installation' end),completed_at=now() where id=v_op;
  return jsonb_build_object('ok',true,'reference',v_ref,'support_id',p_support_id,'campagne',v_campaign.nom_campagne,'visuel',v_visual.nom_visuel,'edt',v_edt.no_edt,'edt_id',v_edt.id,'edt_phase_id',p_edt_phase_id,'photo_id',v_photo.id,'installation_sans_edt',p_sans_edt,'operation_label',case when p_sans_edt then 'Installation sans EDT' else 'Installation' end);
exception when others then
  update public.terrain_operations set statut='Échouée',erreur=sqlerrm,etape='Annulée',completed_at=now() where reference=v_ref AND statut IS DISTINCT FROM 'Réussie';
  return jsonb_build_object('ok',false,'reference',v_ref,'message',sqlerrm,'code',sqlstate);
END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.finaliser_intervention_terrain_v01273(p_support_id text, p_action text, p_type_enjeu text, p_commentaires text, p_nom_fichier text, p_storage_path text, p_photo_url text, p_utilisateur text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_action text := lower(trim(p_action));
  v_ref text := coalesce(nullif(trim(p_idempotency_key),''),
    upper(v_action)||'-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||regexp_replace(p_support_id,'[^A-Za-z0-9]','','g'));
  v_op uuid;v_prior public.terrain_operations%rowtype;
  v_photo public.support_photos%rowtype;v_infra public.infrastructures%rowtype;
  v_issue_id bigint;
begin
  if v_action not in ('inspection','enjeu','photo','retrait') then
    raise exception 'Action terrain non permise';
  end if;
  if not exists(select 1 from public.infrastructures where support_id=p_support_id) then
    raise exception 'Support introuvable';
  end if;


  if auth.uid() is null or p_storage_path is null
     or left(p_storage_path,length('supports/'||p_support_id||'/')) is distinct from 'supports/'||p_support_id||'/'
     or p_storage_path ~ '(^|/)[.][.]?(/|$)|//|[?#%]'
     or not exists(select 1 from storage.objects o where o.bucket_id='terrain-photos' and o.name=p_storage_path and o.owner_id=auth.uid()::text)
  then raise exception 'photo_scope_denied' using errcode='42501';end if;
  p_photo_url:='terrain-photos/'||p_storage_path;
  select * into v_infra from public.infrastructures where support_id=p_support_id for update;
  IF NOT FOUND THEN RAISE EXCEPTION 'support_not_found'; END IF;
  PERFORM tdm_private.capture_display_baseline(p_support_id);

  select * into v_prior from public.terrain_operations where reference=v_ref for update;
  if found then
    if v_prior.support_id is distinct from p_support_id or v_prior.type_operation is distinct from v_action then raise exception 'terrain_idempotency_conflict' using errcode='40001';end if;
    if v_prior.statut='Réussie' then
      if not exists(select 1 from public.support_photos p where p.id=(v_prior.details->>'photo_id')::bigint and p.support_id=p_support_id and p.storage_path=p_storage_path) then raise exception 'terrain_idempotency_conflict' using errcode='40001';end if;
      return jsonb_build_object('ok',true,'reference',v_ref,'support_id',p_support_id,'action',v_action)||v_prior.details;
    end if;
  end if;
  insert into public.terrain_operations(reference,type_operation,support_id,utilisateur)
  values(v_ref,v_action,p_support_id,p_utilisateur)
  on conflict(reference) do update set reference=excluded.reference
  returning id into v_op;

  insert into public.support_photos(
    storage_bucket,client_id,support_id,type_photo,nom_fichier,storage_path,photo_url,thumbnail_url,
    prise_le,utilisateur,statut_validation,est_principale
  )
  values(
    'terrain-photos',(select client_id from public.infrastructures where support_id=p_support_id),p_support_id,
    case when v_action='inspection' then 'Inspection'
         when v_action='enjeu' then 'Enjeu' when v_action='retrait' then 'Retrait' else 'Photo' end,
    p_nom_fichier,p_storage_path,p_photo_url,p_photo_url,now(),p_utilisateur,
    case when v_action in ('inspection','retrait') then 'Validée' else 'À valider' end,
    false
  )
  on conflict do nothing;

  select * into v_photo from public.support_photos
  where support_id=p_support_id and storage_path=p_storage_path
  order by id desc limit 1;
  if not found then raise exception 'Photo non confirmée'; end if;


  if v_action='retrait' then
    -- Keep every photo/file in the support gallery. Only clear current flags.
    update public.support_photos set is_current_visual=false,est_principale=false
      where support_id=p_support_id and (is_current_visual or est_principale);
    PERFORM tdm_private.apply_display_state(p_support_id,tdm_private.display_state(p_support_id)||(SELECT jsonb_build_object('campagne_precedente',coalesce(campagne_actuelle,campagne_precedente),'visuel_precedent',coalesce(visuel_campagne,visuel_precedent),'edt_precedent_associe',coalesce(edt_associe,edt_precedent_associe),'campagne_actuelle',null,'campagne_selon_visuel',null,'visuel_campagne',null,'visuel_en_expo',null,'visuel_actuel_cadre',null,'visuel_id',null,'phase_campagne',null,'format_visuel',null,'edt_associe',null,'photo_principale_url',null,'photo_miniature_url',null,'date_visuel_actuel',null,'date_derniere_manipulation',now()::text) FROM public.infrastructures WHERE support_id=p_support_id));


    insert into public.historique_des_campagnes(
      support_id,client_id,campagne,visuel,no_edt,date_retrait,photo_installation,utilisateur,raw_data)
    values(p_support_id,v_infra.client_id,v_infra.campagne_actuelle,v_infra.visuel_campagne,
      v_infra.edt_associe,now()::text,v_infra.photo_principale_url,p_utilisateur,
      jsonb_build_object('reference',v_ref,'source','terrain_retrait','photo_id',v_photo.id,
        'photo_retrait',p_photo_url,'previous_visual_id',v_infra.visuel_id));
  end if;
  if v_action='enjeu' then

    insert into public.enjeux_terrain(
      reference,support_id,type_enjeu,description,photo_id,photo_url,
      storage_path,utilisateur
    )
    values(
      v_ref,p_support_id,coalesce(nullif(trim(p_type_enjeu),''),'Autre'),
      p_commentaires,v_photo.id,p_photo_url,p_storage_path,p_utilisateur
    )
    returning id into v_issue_id;

    update public.infrastructures
    set enjeux=coalesce(nullif(trim(p_commentaires),''),'Enjeu déclaré'),
        type_enjeux=coalesce(nullif(trim(p_type_enjeu),''),'Autre'),
        updated_at=now()
    where support_id=p_support_id;

    if not exists(select 1 from public.enjeux_terrain where id=v_issue_id)
       or not exists(select 1 from public.infrastructures
                     where support_id=p_support_id
                       and coalesce(type_enjeux,'')=coalesce(nullif(trim(p_type_enjeu),''),'Autre'))
    then raise exception 'Enjeu non confirmé dans toutes les tables'; end if;
  end if;

  if to_regclass('public.inspections_terrain') is not null then
    insert into public.inspections_terrain(
      support_id,source_type,emplacement,action,commentaires,
      utilisateur_courriel,statut,photo_path,photo_url,created_at
    )
    select p_support_id,'Infrastructure',
           coalesce(i.emplacement_visibilite,i.site,''),
           v_action,p_commentaires,p_utilisateur,'Terminée',
           p_storage_path,p_photo_url,now()
    from public.infrastructures i where i.support_id=p_support_id;
  end if;

  update public.terrain_operations
  set statut='Réussie',etape='Terminée',
      details=jsonb_build_object('photo_id',v_photo.id,'enjeu_id',v_issue_id),
      completed_at=now()
  where id=v_op;

  return jsonb_build_object(
    'ok',true,'reference',v_ref,'support_id',p_support_id,
    'action',v_action,'photo_id',v_photo.id,'enjeu_id',v_issue_id
  );
exception when others then
  update public.terrain_operations
  set statut='Échouée',erreur=sqlerrm,etape='Annulée',completed_at=now()
  where reference=v_ref AND statut IS DISTINCT FROM 'Réussie';
  return jsonb_build_object('ok',false,'reference',v_ref,'message',sqlerrm,'code',sqlstate);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.portal_preview_guard()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE target text:=nullif(current_setting('request.headers',true),'')::jsonb->>'x-tos-preview-user';
 target_uid uuid;claims jsonb;method text:=current_setting('request.method',true);path text:=current_setting('request.path',true);
 reads text[]:=ARRAY['photo_inventory_read','photo_inventory_capabilities','list_display_movements','display_current_state','portal_dashboard_summary','portal_business_rows','portal_business_context','portal_preview_storage_read',
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
END $function$
;

CREATE OR REPLACE FUNCTION public.sync_photo_current_visual_v132p0()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  new.captured_at := coalesce(new.captured_at,new.prise_le,now());
  new.prise_le := coalesce(new.prise_le,new.captured_at);
  new.original_filename := coalesce(new.original_filename,new.nom_fichier);
  new.normalized_filename := CASE WHEN new.source='mass_import' AND new.import_finalized_at IS NULL THEN NULL ELSE coalesce(new.normalized_filename,new.nom_fichier) END;
  new.storage_bucket := coalesce(nullif(new.storage_bucket,''),
    case
      when coalesce(new.photo_url,'') like '%/terrain-photos/%' then 'terrain-photos'
      when coalesce(new.photo_url,'') like '%/support-photos/%' then 'support-photos'
      else 'support-photos'
    end);
  new.source := coalesce(nullif(new.source,''),
    case when new.storage_bucket='terrain-photos' then 'terrain' else 'legacy' end);
  new.updated_at := now();
  if tg_op='INSERT' or new.type_photo is distinct from old.type_photo then
    new.is_current_visual := (new.source IS DISTINCT FROM 'mass_import' AND lower(coalesce(new.type_photo,''))='inspection')
      or (lower(coalesce(new.type_photo,''))='installation' and new.est_principale);
  end if;
  new.est_principale := new.is_current_visual;
  if new.is_current_visual then
    update public.support_photos set is_current_visual=false,est_principale=false,updated_at=now()
      where support_id=new.support_id and id<>new.id and (is_current_visual or est_principale);
  end if;
  IF tg_op='INSERT' AND new.source='mass_import' THEN
   SELECT courriel INTO new.utilisateur FROM public.utilisateurs WHERE auth_user_id=auth.uid() AND statut='Actif';
   new.uploaded_by:=auth.uid()::text;
  END IF;
  return new;
end $function$
;
