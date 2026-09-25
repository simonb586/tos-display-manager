-- One resolver for Terrain preflight and the canonical inventory trigger.
-- No data backfill, new inventory table, or change to photo storage policies.
CREATE FUNCTION tdm_private.material_text(value text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT trim(regexp_replace(translate(replace(replace(lower(coalesce(value,'')),'œ','oe'),'æ','ae'),
 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ','aaaaaaceeeeiiiinooooouuuuyy'),'[^a-z0-9]+',' ','g'))
$$;
REVOKE ALL ON FUNCTION tdm_private.material_text(text) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION tdm_private.resolve_material(
 p_visual_id bigint,p_support_id text DEFAULT NULL,p_phase_id bigint DEFAULT NULL,p_reference text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE
 v public.campagne_visuels_formats%rowtype;c public.campagnes_maitres%rowtype;
 a jsonb;assignment jsonb;e jsonb;s jsonb;op jsonb;medium text;direct_id bigint;n integer;
 candidates jsonb:='[]';refined jsonb;status text;message text;
BEGIN
 SELECT * INTO v FROM public.campagne_visuels_formats WHERE id=p_visual_id;
 SELECT * INTO c FROM public.campagnes_maitres WHERE id=v.campagne_id;
 IF v.id IS NULL OR v.client_id IS NULL OR c.client_id IS DISTINCT FROM v.client_id THEN
  RETURN jsonb_build_object('status','not_found','record',NULL,'matches','[]'::jsonb,'match_count',0);
 END IF;
 SELECT to_jsonb(i) INTO s FROM public.infrastructures i WHERE support_id=p_support_id;
 SELECT to_jsonb(link) INTO a FROM public.visual_edt_associations link WHERE visual_id=v.id AND phase_id=p_phase_id;
 SELECT to_jsonb(es) INTO assignment FROM public.edt_supports es WHERE support_id=p_support_id AND phase_id=p_phase_id;
 SELECT to_jsonb(edt) INTO e FROM public.edt_phases phase JOIN public.suivi_des_edt edt ON edt.id=phase.edt_id WHERE phase.id=p_phase_id;
 SELECT details INTO op FROM public.terrain_operations WHERE reference=p_reference AND support_id=p_support_id
  AND (details->>'visuel_id'=v.id::text OR EXISTS(SELECT 1 FROM public.support_photos photo WHERE photo.id=nullif(details->>'photo_id','')::bigint AND photo.visuel_id=v.id));
 -- Direct IDs must come from stored context, never a caller's arbitrary choice.
 direct_id:=coalesce(nullif(op->>'repertoire_affiche_id','')::bigint,
  nullif(a->>'repertoire_affiche_id','')::bigint,nullif(a->>'inventory_item_id','')::bigint,
  nullif(assignment->>'repertoire_affiche_id','')::bigint,
  nullif(e->>'repertoire_affiche_id','')::bigint,
  CASE WHEN coalesce(e->'raw_data'->>'canonical_visual_id',e->'raw_data'->>'visuel_id')=v.id::text THEN nullif(e->'raw_data'->>'repertoire_affiche_id','')::bigint END,
  v.inventory_item_id);
 medium:=coalesce(nullif(a->>'medium_affichage',''),nullif(assignment->>'medium_affichage',''),
  nullif(to_jsonb(v)->>'medium_affichage',''),nullif(s->>'medium_affichage',''),
  CASE WHEN coalesce(e->'raw_data'->>'canonical_visual_id',e->'raw_data'->>'visuel_id')=v.id::text THEN nullif(e->'raw_data'->>'medium_affichage','') END);
 IF direct_id IS NOT NULL THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'nom_detaille_visuel',r.nom_detaille_visuel,'format',r.format,'nom_campagne',r.nom_campagne,'medium_affichage',r.medium_affichage)),'[]') INTO candidates
   FROM public.repertoire_des_affiches r WHERE r.id=direct_id AND r.client_id=v.client_id
   AND tdm_private.material_format(r.format)<>'' AND tdm_private.material_format(r.format)=tdm_private.material_format(v.format_support);
  status:=CASE WHEN jsonb_array_length(candidates)=1 THEN 'resolved' ELSE 'invalid_direct' END;
 ELSE
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'nom_detaille_visuel',r.nom_detaille_visuel,'format',r.format,'nom_campagne',r.nom_campagne,'medium_affichage',r.medium_affichage) ORDER BY r.id),'[]') INTO candidates
   FROM public.repertoire_des_affiches r WHERE r.client_id=v.client_id
   AND tdm_private.material_format(r.format)<>'' AND tdm_private.material_format(r.format)=tdm_private.material_format(v.format_support)
   AND tdm_private.material_text(v.nom_visuel)<>''
   AND tdm_private.material_text(v.nom_visuel) IN (tdm_private.material_text(r.nom_detaille_visuel),tdm_private.material_text(r.visuel));
  -- Campaign is used whenever available. Blank legacy campaign names do not
  -- contradict a match; a different populated campaign must never be borrowed.
  IF tdm_private.material_text(c.nom_campagne)<>'' THEN
   SELECT coalesce(jsonb_agg(x),'[]') INTO refined FROM jsonb_array_elements(candidates) x WHERE tdm_private.material_text(x->>'nom_campagne')=tdm_private.material_text(c.nom_campagne);
   IF jsonb_array_length(refined)>0 THEN candidates:=refined;
   ELSE SELECT coalesce(jsonb_agg(x),'[]') INTO candidates FROM jsonb_array_elements(candidates) x WHERE tdm_private.material_text(x->>'nom_campagne')='';END IF;
  END IF;
  IF jsonb_array_length(candidates)>1 AND tdm_private.material_text(medium)<>'' THEN
   SELECT coalesce(jsonb_agg(x),'[]') INTO candidates FROM jsonb_array_elements(candidates) x WHERE tdm_private.material_text(x->>'medium_affichage')=tdm_private.material_text(medium);
  END IF;
  n:=jsonb_array_length(candidates);status:=CASE WHEN n=1 THEN 'resolved' WHEN n=0 THEN 'not_found' ELSE 'ambiguous' END;
 END IF;
 message:=CASE status
  WHEN 'not_found' THEN 'Aucun article correspondant trouvé dans le Répertoire des affiches pour ce visuel et ce format. Un administrateur doit vérifier le catalogue. Votre intervention et votre photo sont conservées.'
  WHEN 'ambiguous' THEN 'Plusieurs articles correspondent à ce visuel et ce format dans le Répertoire des affiches. Un administrateur doit départager la campagne et le médium. Votre intervention et votre photo sont conservées.'
  WHEN 'invalid_direct' THEN 'L’article lié à cette intervention est introuvable ou incompatible avec le client ou le format. Un administrateur doit vérifier le Répertoire des affiches. Votre intervention et votre photo sont conservées.' END;
 RETURN jsonb_build_object('status',status,'record',CASE WHEN status='resolved' THEN candidates->0 END,'matches',candidates,
  'match_count',jsonb_array_length(candidates),'message',message,'visual_id',v.id,'visuel',v.nom_visuel,'format',v.format_support,'campagne',c.nom_campagne,'medium_affichage',medium,'direct',direct_id IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION tdm_private.resolve_material(bigint,text,bigint,text) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION tdm_private.resolve_repertoire_affiche(
 p_visual_id bigint,p_support_id text,p_edt_phase_id bigint DEFAULT NULL,p_repertoire_affiche_id bigint DEFAULT NULL,p_intervention_reference text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor public.utilisateurs%rowtype;v public.campagne_visuels_formats%rowtype;i public.infrastructures%rowtype;result jsonb;
BEGIN
 SELECT * INTO actor FROM public.utilisateurs WHERE auth_user_id=auth.uid() AND statut='Actif';
 IF actor.id IS NULL OR actor.role NOT IN ('Administrateur','Coordonnateur','Installateur') THEN RAISE EXCEPTION 'terrain_role_denied' USING ERRCODE='42501';END IF;
 SELECT * INTO v FROM public.campagne_visuels_formats WHERE id=p_visual_id;
 SELECT * INTO i FROM public.infrastructures WHERE support_id=p_support_id;
 IF v.id IS NULL OR i.id IS NULL OR v.client_id IS NULL OR v.client_id IS DISTINCT FROM i.client_id
  OR (actor.client_id IS NOT NULL AND actor.client_id IS DISTINCT FROM i.client_id)
  OR public.tos_table_resource_scope(v.client_id,p_support_id,v.campagne_id,NULL,false) IS NOT TRUE
 THEN RAISE EXCEPTION 'material_scope_denied' USING ERRCODE='42501';END IF;
 IF p_edt_phase_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.visual_edt_associations a JOIN public.suivi_des_edt e ON e.id=a.edt_id
  WHERE a.visual_id=v.id AND a.phase_id=p_edt_phase_id AND e.client_id=v.client_id
  AND public.tos_table_resource_scope(e.client_id,p_support_id,e.campagne_id,e.id,false))
 THEN RAISE EXCEPTION 'phase_scope_denied' USING ERRCODE='42501';END IF;
 result:=tdm_private.resolve_material(p_visual_id,p_support_id,p_edt_phase_id,p_intervention_reference);
 IF result->>'status'='resolved' AND p_repertoire_affiche_id IS NOT NULL AND (result->'record'->>'id')::bigint<>p_repertoire_affiche_id THEN
  RETURN result||jsonb_build_object('status','changed','record',NULL,'message','L’article du Répertoire des affiches a changé. Réessayez la finalisation ; votre intervention et votre photo sont conservées.');
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION tdm_private.resolve_repertoire_affiche(bigint,text,bigint,bigint,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION tdm_private.resolve_repertoire_affiche(bigint,text,bigint,bigint,text) TO authenticated;
CREATE FUNCTION public.resolve_repertoire_affiche(
 p_visual_id bigint,p_support_id text,p_edt_phase_id bigint DEFAULT NULL,p_repertoire_affiche_id bigint DEFAULT NULL,p_intervention_reference text DEFAULT NULL
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT tdm_private.resolve_repertoire_affiche(p_visual_id,p_support_id,p_edt_phase_id,p_repertoire_affiche_id,p_intervention_reference)
$$;
REVOKE ALL ON FUNCTION public.resolve_repertoire_affiche(bigint,text,bigint,bigint,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resolve_repertoire_affiche(bigint,text,bigint,bigint,text) TO authenticated;

-- Replace only the old stock lookup. Keep row locks, cancellation, validation,
-- ledger uniqueness and quantity updates in the existing canonical trigger.
DO $patch$
DECLARE definition text;start_at integer;end_at integer;old_lookup text;
BEGIN
 SELECT pg_get_functiondef('tdm_private.record_material_movement()'::regprocedure) INTO definition;
 start_at:=strpos(definition,' candidate:=visual.inventory_item_id;');
 end_at:=strpos(definition,' SELECT * INTO item FROM public.repertoire_des_affiches WHERE id=candidate FOR UPDATE;');
 IF start_at=0 OR end_at<=start_at THEN RAISE EXCEPTION 'material_trigger_contract_changed';END IF;
 old_lookup:=substr(definition,start_at,end_at-start_at);
 definition:=replace(definition,'DECLARE kind text;','DECLARE resolution jsonb;kind text;');
 definition:=replace(definition,old_lookup,$replacement$
 resolution:=tdm_private.resolve_material(v_id,NEW.support_id,nullif(NEW.raw_data->>'edt_phase_id','')::bigint,NEW.raw_data->>'reference');
 candidate:=nullif(resolution->'record'->>'id','')::bigint;
 IF candidate IS NULL THEN RAISE EXCEPTION '%',coalesce(resolution->>'message','Aucun article correspondant trouvé dans le Répertoire des affiches pour ce visuel et ce format.');END IF;
$replacement$);
 EXECUTE definition;
END $patch$;

CREATE FUNCTION tdm_private.finaliser_installation_material(
 p_support_id text,p_visuel_id bigint,p_nom_fichier text,p_storage_path text,p_photo_url text,
 p_utilisateur text DEFAULT NULL,p_commentaires text DEFAULT NULL,p_idempotency_key text DEFAULT NULL,
 p_edt_phase_id bigint DEFAULT NULL,p_sans_edt boolean DEFAULT false,p_repertoire_affiche_id bigint DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE resolution jsonb;result jsonb;prior public.terrain_operations%rowtype;v_item_id bigint;ref text;
BEGIN
 ref:=coalesce(nullif(trim(p_idempotency_key),''),'TERRAIN-'||p_support_id||'-'||p_storage_path);
 -- Same locking order and canonical authorization as the existing finalizer.
 resolution:=tdm_private.resolve_repertoire_affiche(p_visuel_id,p_support_id,p_edt_phase_id,NULL,ref);
 PERFORM 1 FROM public.campagne_visuels_formats WHERE id=p_visuel_id FOR SHARE;
 PERFORM 1 FROM public.infrastructures WHERE support_id=p_support_id FOR UPDATE;
 SELECT * INTO prior FROM public.terrain_operations WHERE reference=ref FOR UPDATE;
 IF prior.id IS NOT NULL AND (prior.support_id IS DISTINCT FROM p_support_id OR prior.type_operation IS DISTINCT FROM 'installation') THEN
  RAISE EXCEPTION 'terrain_idempotency_conflict' USING ERRCODE='40001';
 END IF;
 IF prior.statut='Réussie' THEN
  -- A committed operation remains replayable even if the catalog later changes.
  result:=public.finaliser_installation_terrain_v1344(p_support_id,p_visuel_id,p_nom_fichier,p_storage_path,p_photo_url,p_utilisateur,p_commentaires,ref,p_edt_phase_id,p_sans_edt);
  v_item_id:=coalesce(nullif(prior.details->>'repertoire_affiche_id','')::bigint,(SELECT m.item_id FROM public.inventory_movements m WHERE m.intervention_reference=ref AND m.movement_kind='installation' AND m.reversed_at IS NULL LIMIT 1));
  RETURN result||jsonb_build_object('repertoire_affiche_id',v_item_id);
 END IF;
 resolution:=tdm_private.resolve_repertoire_affiche(p_visuel_id,p_support_id,p_edt_phase_id,p_repertoire_affiche_id,ref);
 v_item_id:=nullif(resolution->'record'->>'id','')::bigint;
 IF v_item_id IS NULL THEN RETURN jsonb_build_object('ok',false,'code','material_'||(resolution->>'status'),'message',resolution->>'message','reference',ref);END IF;
 -- Reserve the resolved ID on the intervention. The existing finalizer and
 -- stock trigger run in this same transaction; no separate stock mutation.
 INSERT INTO public.terrain_operations(reference,type_operation,support_id,utilisateur,details)
 VALUES(ref,'installation',p_support_id,auth.uid()::text,jsonb_build_object('repertoire_affiche_id',v_item_id,'visuel_id',p_visuel_id))
 ON CONFLICT(reference) DO UPDATE SET details=coalesce(terrain_operations.details,'{}')||excluded.details
 WHERE terrain_operations.support_id=excluded.support_id AND terrain_operations.type_operation='installation';
 IF NOT FOUND THEN RAISE EXCEPTION 'terrain_idempotency_conflict' USING ERRCODE='40001';END IF;
 result:=public.finaliser_installation_terrain_v1344(p_support_id,p_visuel_id,p_nom_fichier,p_storage_path,p_photo_url,p_utilisateur,p_commentaires,ref,p_edt_phase_id,p_sans_edt);
 IF (result->>'ok')::boolean IS TRUE THEN
  IF NOT EXISTS(SELECT 1 FROM public.inventory_movements m WHERE m.intervention_reference=ref AND m.item_id=v_item_id AND m.visual_id=p_visuel_id AND m.movement_kind='installation') THEN
   RAISE EXCEPTION 'material_movement_not_confirmed';
  END IF;
  UPDATE public.terrain_operations SET details=details||jsonb_build_object('repertoire_affiche_id',v_item_id,'visuel_id',p_visuel_id) WHERE reference=ref;
 END IF;
 RETURN result||jsonb_build_object('repertoire_affiche_id',v_item_id);
END $$;
REVOKE ALL ON FUNCTION tdm_private.finaliser_installation_material(text,bigint,text,text,text,text,text,text,bigint,boolean,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION tdm_private.finaliser_installation_material(text,bigint,text,text,text,text,text,text,bigint,boolean,bigint) TO authenticated;
CREATE FUNCTION public.finaliser_installation_terrain_v1345(
 p_support_id text,p_visuel_id bigint,p_nom_fichier text,p_storage_path text,p_photo_url text,
 p_utilisateur text DEFAULT NULL,p_commentaires text DEFAULT NULL,p_idempotency_key text DEFAULT NULL,
 p_edt_phase_id bigint DEFAULT NULL,p_sans_edt boolean DEFAULT false,p_repertoire_affiche_id bigint DEFAULT NULL
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT tdm_private.finaliser_installation_material(p_support_id,p_visuel_id,p_nom_fichier,p_storage_path,p_photo_url,p_utilisateur,p_commentaires,p_idempotency_key,p_edt_phase_id,p_sans_edt,p_repertoire_affiche_id)
$$;
REVOKE ALL ON FUNCTION public.finaliser_installation_terrain_v1345(text,bigint,text,text,text,text,text,text,bigint,boolean,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finaliser_installation_terrain_v1345(text,bigint,text,text,text,text,text,text,bigint,boolean,bigint) TO authenticated;
NOTIFY pgrst,'reload schema';
