CREATE OR REPLACE FUNCTION public.finalize_import_photo(p_photo_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE photo public.support_photos%rowtype;actor public.utilisateurs%rowtype;infra public.infrastructures%rowtype;
 edt public.suivi_des_edt%rowtype;phase public.edt_phases%rowtype;visual public.campagne_visuels_formats%rowtype;campaign public.campagnes_maitres%rowtype;
 values jsonb;states jsonb;field text;kind text;captured timestamptz;without_edt boolean;history_id bigint;matching_movements bigint;key text;state jsonb;photo_ref text;seq integer;filename text;extension text;
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
   SELECT min(h.id),count(*) INTO history_id,matching_movements
   FROM public.historique_des_campagnes h JOIN tdm_private.display_events(infra.support_id) ev ON ev.history_id=h.id
   WHERE ev.movement_kind=kind AND NOT coalesce(ev.cancelled,false)
    AND (ev.event_at AT TIME ZONE 'America/Toronto')::date=(captured AT TIME ZONE 'America/Toronto')::date
    AND ev.event_state->>'visuel_id'=visual.id::text
    AND (without_edt AND h.raw_data->>'installation_sans_edt'='true' OR NOT without_edt AND h.raw_data->>'edt_phase_id'=phase.id::text);
   IF matching_movements>1 THEN RAISE EXCEPTION 'import_existing_movement_ambiguous';END IF;
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
END $function$
;
