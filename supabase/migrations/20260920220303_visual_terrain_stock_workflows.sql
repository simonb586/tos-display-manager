-- Reference replacement is atomic; archived originals remain immutable.
CREATE FUNCTION public.replace_visual_reference(p_visual_id bigint,p_asset_id text,p_asset jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 PERFORM public.remove_visual_reference(p_visual_id,p_asset_id);
 RETURN public.add_visual_reference(p_visual_id,p_asset);
END $$;
REVOKE ALL ON FUNCTION public.replace_visual_reference(bigint,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.replace_visual_reference(bigint,text,jsonb) TO authenticated;

-- One canonical issue catalogue drives both the form and server-side effects.
CREATE TABLE public.terrain_issue_types(
 label text PRIMARY KEY,duration text NOT NULL CHECK(duration IN ('permanent','temporaire')),
 deactivates_support boolean NOT NULL,sort_order integer NOT NULL UNIQUE
);
INSERT INTO public.terrain_issue_types VALUES
 ('Cadre inaccessible ou plus requis','permanent',true,1),('Cadre brisé','permanent',true,2),
 ('Cadre manquant','permanent',true,3),('Cadre difficile d’accès','permanent',false,4),
 ('Cadre en zone de travaux','temporaire',true,5),('Écran à remplacer','permanent',false,6),
 ('Écran manquant','permanent',true,7),('Écran brisé','permanent',true,8),
 ('Écran sale – Visible à 100%','temporaire',false,9),('Écran sale – Visible à 75%','temporaire',false,10),
 ('Écran sale – Visible à 50%','temporaire',false,11);
ALTER TABLE public.terrain_issue_types ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.terrain_issue_types FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.terrain_issue_types TO authenticated;
CREATE POLICY issue_catalog_read ON public.terrain_issue_types FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) IS NOT NULL);
ALTER TABLE public.enjeux_terrain ADD COLUMN duration text,ADD COLUMN deactivates_support boolean,
 ADD COLUMN created_by uuid,ADD COLUMN resolved_by uuid,ADD COLUMN resolution_photo_id bigint REFERENCES public.support_photos(id),
 ADD COLUMN resolution_comment text,ADD COLUMN support_active_before text;
CREATE INDEX terrain_issues_active_support ON public.enjeux_terrain(support_id,id) WHERE resolved_at IS NULL;

CREATE FUNCTION tdm_private.sync_support_issues(p_support text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE i public.infrastructures%rowtype;n integer;blocking boolean;labels text;durations text;comments text;first_date timestamptz;prior text;
BEGIN
 SELECT * INTO i FROM public.infrastructures WHERE support_id=p_support FOR UPDATE;
 SELECT count(*),bool_or(coalesce(e.deactivates_support,false)),string_agg(DISTINCT e.type_enjeu,' ; '),
 string_agg(DISTINCT e.duration,' ; '),string_agg(nullif(e.description,''),' ; '),min(e.created_at)
 INTO n,blocking,labels,durations,comments,first_date FROM public.enjeux_terrain e WHERE e.support_id=p_support AND e.resolved_at IS NULL;
 prior:=i.raw_data->'terrain_issue_state'->>'active_before';
 IF coalesce(blocking,false) AND prior IS NULL THEN prior:=i.actif;END IF;
 UPDATE public.infrastructures SET enjeux=CASE WHEN n>0 THEN labels END,type_enjeux=CASE WHEN n>0 THEN durations END,
 actif=CASE WHEN blocking THEN 'Non' WHEN i.raw_data->'terrain_issue_state'->>'blocked'='true' THEN coalesce(prior,'Oui') ELSE actif END,
 raw_data=coalesce(raw_data,'{}')||jsonb_build_object('terrain_issue_state',jsonb_build_object('count',n,'blocked',coalesce(blocking,false),
 'active_before',CASE WHEN blocking THEN prior END,'comment',comments,'declared_at',first_date)),updated_at=now() WHERE support_id=p_support;
END $$;
REVOKE ALL ON FUNCTION tdm_private.sync_support_issues(text) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION tdm_private.set_terrain_issue_rule() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rule public.terrain_issue_types%rowtype;
BEGIN
 SELECT * INTO rule FROM public.terrain_issue_types WHERE label=NEW.type_enjeu;
 IF NOT FOUND THEN RAISE EXCEPTION 'Choisissez un type de problème de la liste.' USING ERRCODE='23514';END IF;
 SELECT actif INTO NEW.support_active_before FROM public.infrastructures WHERE support_id=NEW.support_id FOR UPDATE;
 NEW.duration:=rule.duration;NEW.deactivates_support:=rule.deactivates_support;NEW.created_by:=auth.uid();
 RETURN NEW;
END $$;
CREATE TRIGGER terrain_issue_rule BEFORE INSERT ON public.enjeux_terrain FOR EACH ROW EXECUTE FUNCTION tdm_private.set_terrain_issue_rule();
REVOKE ALL ON FUNCTION tdm_private.set_terrain_issue_rule() FROM PUBLIC,anon,authenticated;

-- Extend the canonical intervention rather than adding a competing write path.
DO $patch$DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('public.finaliser_intervention_terrain_v01273(text,text,text,text,text,text,text,text,text)'::regprocedure) INTO definition;
 IF position('if v_action=''enjeu'' then' in definition)=0 THEN RAISE EXCEPTION 'issue_rpc_contract_changed';END IF;
 definition:=replace(definition,'  if to_regclass(''public.inspections_terrain'') is not null then',
 '  if v_action=''enjeu'' then perform tdm_private.sync_support_issues(p_support_id);end if;
  if to_regclass(''public.inspections_terrain'') is not null then');
 EXECUTE definition;
END $patch$;

CREATE FUNCTION tdm_private.resolve_terrain_issue(p_issue_id bigint,p_nom_fichier text,p_storage_path text,p_comment text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE issue public.enjeux_terrain%rowtype;result jsonb;actor public.utilisateurs%rowtype;reference text;
BEGIN
 SELECT * INTO actor FROM public.utilisateurs WHERE auth_user_id=auth.uid() AND statut='Actif';
 IF actor.id IS NULL OR actor.role NOT IN ('Administrateur','Coordonnateur','Installateur') THEN RAISE EXCEPTION 'issue_resolution_denied' USING ERRCODE='42501';END IF;
 SELECT * INTO issue FROM public.enjeux_terrain WHERE id=p_issue_id;
 IF NOT FOUND OR public.tos_table_resource_scope(issue.client_id,issue.support_id,NULL,NULL,false) IS NOT TRUE THEN RAISE EXCEPTION 'issue_scope_denied' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.infrastructures WHERE support_id=issue.support_id FOR UPDATE;
 SELECT * INTO issue FROM public.enjeux_terrain WHERE id=p_issue_id FOR UPDATE;
 IF issue.resolved_at IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'reference',issue.reference,'already_resolved',true,'issue_id',issue.id);END IF;
 reference:='RESOLVE-ISSUE-'||issue.id;
 result:=public.finaliser_intervention_terrain_v1342(issue.support_id,NULL,'photo',NULL,p_comment,p_nom_fichier,p_storage_path,NULL,actor.courriel,reference);
 IF coalesce((result->>'ok')::boolean,false) IS NOT TRUE THEN RAISE EXCEPTION '%',result->>'message';END IF;
 UPDATE public.support_photos SET type_photo='Enjeu',metadata=coalesce(metadata,'{}')||jsonb_build_object('issue_id',issue.id,'issue_resolution',true) WHERE id=(result->>'photo_id')::bigint;
 UPDATE public.enjeux_terrain SET statut='Résolu',resolved_at=now(),resolved_by=auth.uid(),resolution_photo_id=(result->>'photo_id')::bigint,resolution_comment=p_comment WHERE id=issue.id;
 PERFORM tdm_private.sync_support_issues(issue.support_id);
 RETURN result||jsonb_build_object('issue_id',issue.id,'resolved',true);
END $$;
REVOKE ALL ON FUNCTION tdm_private.resolve_terrain_issue(bigint,text,text,text) FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA tdm_private TO authenticated;
GRANT EXECUTE ON FUNCTION tdm_private.resolve_terrain_issue(bigint,text,text,text) TO authenticated;
CREATE FUNCTION public.resolve_terrain_issue(p_issue_id bigint,p_nom_fichier text,p_storage_path text,p_comment text DEFAULT NULL) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT tdm_private.resolve_terrain_issue(p_issue_id,p_nom_fichier,p_storage_path,p_comment)$$;
REVOKE ALL ON FUNCTION public.resolve_terrain_issue(bigint,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resolve_terrain_issue(bigint,text,text,text) TO authenticated;

-- Extend the existing material ledger and directory; no competing stock table.
ALTER TABLE public.campagne_visuels_formats ADD COLUMN inventory_item_id bigint REFERENCES public.repertoire_des_affiches(id);
CREATE INDEX visual_inventory_item ON public.campagne_visuels_formats(inventory_item_id) WHERE inventory_item_id IS NOT NULL;
ALTER TABLE public.inventory_movements ADD COLUMN item_id bigint REFERENCES public.repertoire_des_affiches(id),
 ADD COLUMN history_id bigint REFERENCES public.historique_des_campagnes(id),ADD COLUMN movement_kind text,
 ADD COLUMN warehouse_before integer,ADD COLUMN warehouse_after integer,ADD COLUMN field_before integer,ADD COLUMN field_after integer,
 ADD COLUMN client_id bigint REFERENCES public.clients(id),ADD COLUMN campaign_id bigint REFERENCES public.campagnes_maitres(id),
 ADD COLUMN source text,ADD COLUMN intervention_reference text,ADD COLUMN reversed_at timestamptz;
CREATE UNIQUE INDEX inventory_history_kind ON public.inventory_movements(history_id,movement_kind) WHERE history_id IS NOT NULL;
ALTER TABLE public.repertoire_des_affiches ADD COLUMN last_movement_id bigint REFERENCES public.inventory_movements(id),ADD COLUMN last_movement_at timestamptz;
ALTER TABLE public.repertoire_des_affiches ADD CONSTRAINT nonnegative_material_stock CHECK(quantite_entrepot>=0 AND quantite_expo>=0) NOT VALID;
ALTER TABLE public.repertoire_des_affiches VALIDATE CONSTRAINT nonnegative_material_stock;
CREATE FUNCTION tdm_private.material_format(value text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT regexp_replace(lower(replace(replace(coalesce(value,''),',','.'),'×','x')),'(portrait|paysage|landscape|\s)','','g')
$$;
REVOKE ALL ON FUNCTION tdm_private.material_format(text) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION tdm_private.validate_visual_material() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE item public.repertoire_des_affiches%rowtype;BEGIN
 IF NEW.inventory_item_id IS NULL THEN RETURN NEW;END IF;
 SELECT * INTO item FROM public.repertoire_des_affiches WHERE id=NEW.inventory_item_id;
 IF item.id IS NULL OR item.client_id IS DISTINCT FROM NEW.client_id OR tdm_private.material_format(item.format)='' OR tdm_private.material_format(item.format)<>tdm_private.material_format(NEW.format_support)
 THEN RAISE EXCEPTION 'L’article doit appartenir au même client et au même format.' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION tdm_private.validate_visual_material() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER visual_material_scope BEFORE INSERT OR UPDATE OF inventory_item_id,client_id,format_support ON public.campagne_visuels_formats FOR EACH ROW EXECUTE FUNCTION tdm_private.validate_visual_material();
DO $patch$DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('public.save_campaign_visual_with_edts(jsonb,jsonb)'::regprocedure) INTO definition;
 IF position('instructions_terrain=p_visual->>''instructions_terrain''' in definition)=0 THEN RAISE EXCEPTION 'visual_save_contract_changed';END IF;
 definition:=replace(definition,'instructions_terrain=p_visual->>''instructions_terrain''','inventory_item_id=CASE WHEN p_visual ? ''inventory_item_id'' THEN nullif(p_visual->>''inventory_item_id'','''')::bigint ELSE inventory_item_id END,instructions_terrain=p_visual->>''instructions_terrain''');
 EXECUTE definition;
END $patch$;

CREATE FUNCTION tdm_private.record_material_movement() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE kind text;visual public.campagne_visuels_formats%rowtype;item public.repertoire_des_affiches%rowtype;v_id bigint;candidate bigint;matches integer;delta integer;movement bigint;old_m public.inventory_movements%rowtype;
BEGIN
 -- Support lock serializes operations and their idempotency before locking stock.
 PERFORM 1 FROM public.infrastructures WHERE support_id=NEW.support_id FOR UPDATE;
 IF TG_OP='UPDATE' THEN
  FOR old_m IN SELECT * FROM public.inventory_movements WHERE history_id=NEW.id AND reversed_at IS NULL ORDER BY item_id FOR UPDATE LOOP
   IF NEW.movement_meta->'cancellations' ? old_m.movement_kind THEN
    SELECT * INTO item FROM public.repertoire_des_affiches WHERE id=old_m.item_id FOR UPDATE;
    delta:=CASE old_m.movement_kind WHEN 'installation' THEN -1 ELSE 1 END;
    IF item.quantite_entrepot-delta<0 OR item.quantite_expo+delta<0 THEN RAISE EXCEPTION 'Stock insuffisant pour annuler ce mouvement.';END IF;
    UPDATE public.repertoire_des_affiches SET quantite_entrepot=quantite_entrepot-delta,quantite_expo=quantite_expo+delta,last_movement_at=now() WHERE id=item.id;
    UPDATE public.inventory_movements SET reversed_at=now() WHERE id=old_m.id;
   END IF;
  END LOOP;
  RETURN NEW;
 END IF;
 IF NEW.raw_data->>'reference' IS NULL AND NEW.import_movement_key IS NULL THEN RETURN NEW;END IF;
 kind:=CASE WHEN nullif(NEW.date_retrait,'') IS NOT NULL THEN 'retrait' ELSE 'installation' END;
 v_id:=coalesce(nullif(NEW.movement_meta->kind->'state'->>'visuel_id','')::bigint,nullif(NEW.raw_data->>'previous_visual_id','')::bigint,
  (SELECT visuel_id FROM public.support_photos WHERE id=nullif(NEW.raw_data->>'photo_id','')::bigint));
 IF v_id IS NULL THEN
  IF kind='retrait' THEN RETURN NEW;END IF;
  RAISE EXCEPTION 'Visuel requis pour le mouvement de stock.';
 END IF;
 SELECT * INTO visual FROM public.campagne_visuels_formats WHERE id=v_id;
 IF visual.client_id IS DISTINCT FROM NEW.client_id THEN RAISE EXCEPTION 'material_client_mismatch' USING ERRCODE='42501';END IF;
 candidate:=visual.inventory_item_id;
 IF candidate IS NULL THEN
  SELECT count(*),min(r.id) INTO matches,candidate FROM public.repertoire_des_affiches r JOIN public.campagnes_maitres c ON c.id=visual.campagne_id
   WHERE r.client_id=visual.client_id AND lower(trim(r.nom_detaille_visuel))=lower(trim(visual.nom_visuel)) AND lower(trim(r.nom_campagne))=lower(trim(c.nom_campagne))
   AND tdm_private.material_format(r.format)<>'' AND tdm_private.material_format(r.format)=tdm_private.material_format(visual.format_support);
  IF matches<>1 THEN RAISE EXCEPTION 'Associez le visuel à son article et format du Répertoire des affiches avant de terminer.';END IF;
 END IF;
 SELECT * INTO item FROM public.repertoire_des_affiches WHERE id=candidate FOR UPDATE;
 IF item.client_id IS DISTINCT FROM visual.client_id OR tdm_private.material_format(item.format)<>tdm_private.material_format(visual.format_support) THEN RAISE EXCEPTION 'material_format_mismatch';END IF;
 IF item.quantite_entrepot IS NULL OR item.quantite_expo IS NULL THEN RAISE EXCEPTION 'Quantités de stock à renseigner avant cette intervention.';END IF;
 delta:=CASE kind WHEN 'installation' THEN -1 ELSE 1 END;
 IF item.quantite_entrepot+delta<0 OR item.quantite_expo-delta<0 THEN RAISE EXCEPTION 'Stock insuffisant : intervention non enregistrée.' USING ERRCODE='23514';END IF;
 INSERT INTO public.inventory_movements(visual_id,item_id,item_reference,movement_type,quantity,edt_number,support_id,history_id,movement_kind,warehouse_before,warehouse_after,field_before,field_after,client_id,campaign_id,source,intervention_reference)
 VALUES(visual.id,item.id,item.nom_detaille_visuel,CASE kind WHEN 'installation' THEN 'Installation' ELSE 'Retrait' END,1,NEW.no_edt,NEW.support_id,NEW.id,kind,item.quantite_entrepot,item.quantite_entrepot+delta,item.quantite_expo,item.quantite_expo-delta,visual.client_id,visual.campagne_id,CASE WHEN NEW.import_movement_key IS NOT NULL THEN 'Import' ELSE 'Terrain' END,NEW.raw_data->>'reference')
 ON CONFLICT(history_id,movement_kind) WHERE history_id IS NOT NULL DO NOTHING RETURNING id INTO movement;
 IF movement IS NOT NULL THEN UPDATE public.repertoire_des_affiches SET quantite_entrepot=item.quantite_entrepot+delta,quantite_expo=item.quantite_expo-delta,last_movement_id=movement,last_movement_at=now(),updated_at=now() WHERE id=item.id;END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION tdm_private.record_material_movement() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER material_movement AFTER INSERT OR UPDATE OF movement_meta ON public.historique_des_campagnes FOR EACH ROW EXECUTE FUNCTION tdm_private.record_material_movement();

-- A resumable deletion reserves the entire selection before Storage removal.
ALTER TABLE public.support_photos ADD COLUMN review_delete_requested_at timestamptz;
CREATE FUNCTION tdm_private.guard_review_deletion() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF OLD.review_delete_requested_at IS NOT NULL AND (NEW.import_finalized_at IS DISTINCT FROM OLD.import_finalized_at OR NEW.statut_validation IS DISTINCT FROM OLD.statut_validation OR NEW.import_context IS DISTINCT FROM OLD.import_context OR NEW.est_principale OR NEW.is_current_visual OR NEW.support_id IS DISTINCT FROM OLD.support_id OR NEW.review_delete_requested_at IS NULL) THEN
 RAISE EXCEPTION 'Suppression de cette photo en cours. Réessayez la suppression.' USING ERRCODE='55000';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER photo_review_deletion_guard BEFORE UPDATE ON public.support_photos FOR EACH ROW EXECUTE FUNCTION tdm_private.guard_review_deletion();
REVOKE ALL ON FUNCTION tdm_private.guard_review_deletion() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION tdm_private.delete_review_photos(p_ids bigint[],p_finish boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor public.utilisateurs%rowtype;photo public.support_photos%rowtype;result jsonb:='[]';n integer:=0;
BEGIN
 SELECT * INTO actor FROM public.utilisateurs WHERE auth_user_id=auth.uid() AND statut='Actif';
 IF actor.id IS NULL OR actor.role<>'Administrateur' THEN RAISE EXCEPTION 'photo_delete_denied' USING ERRCODE='42501';END IF;
 IF cardinality(p_ids) NOT BETWEEN 1 AND 500 OR EXISTS(SELECT 1 FROM unnest(p_ids) id GROUP BY id HAVING count(*)>1) THEN RAISE EXCEPTION 'invalid_photo_selection';END IF;
 FOR photo IN SELECT * FROM public.support_photos WHERE id=ANY(p_ids) ORDER BY id FOR UPDATE LOOP
  n:=n+1;
  IF photo.import_finalized_at IS NOT NULL OR photo.movement_history_id IS NOT NULL OR photo.est_principale OR photo.is_current_visual
   OR lower(coalesce(photo.statut_validation,'')) IN ('validée','validé','validated','approved')
   OR photo.review_status IN ('manually_validated','ignored')
   OR EXISTS(SELECT 1 FROM public.enjeux_terrain WHERE photo_id=photo.id OR resolution_photo_id=photo.id)
  THEN RAISE EXCEPTION 'Une photo sélectionnée est finalisée ou liée à un historique. Aucune photo supprimée.';END IF;
  IF photo.client_id IS NOT NULL AND public.tos_table_resource_scope(photo.client_id,photo.support_id,photo.campagne_id,NULL,false) IS NOT TRUE
   OR photo.client_id IS NULL AND actor.client_id IS NOT NULL THEN RAISE EXCEPTION 'photo_scope_denied' USING ERRCODE='42501';END IF;
  IF photo.storage_bucket IS NULL OR nullif(photo.storage_path,'') IS NULL OR EXISTS(SELECT 1 FROM public.support_photos other WHERE other.id<>photo.id AND other.storage_bucket=photo.storage_bucket AND other.storage_path=photo.storage_path) THEN RAISE EXCEPTION 'photo_storage_not_unique';END IF;
  IF p_finish THEN
   IF photo.review_delete_requested_at IS NULL OR EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id=photo.storage_bucket AND name=photo.storage_path) THEN RAISE EXCEPTION 'Suppression Storage non confirmée. Réessayez la suppression.';END IF;
   INSERT INTO public.photo_action_log(action,photo_id,support_id,nom_fichier,details,user_id) VALUES('SUPPRESSION',photo.id::text,photo.support_id,photo.nom_fichier,jsonb_build_object('source','review_batch','storage_bucket',photo.storage_bucket,'storage_path',photo.storage_path),auth.uid());
   DELETE FROM public.support_photos WHERE id=photo.id;
  ELSE UPDATE public.support_photos SET review_delete_requested_at=coalesce(review_delete_requested_at,now()) WHERE id=photo.id;
  END IF;
  result:=result||jsonb_build_array(jsonb_build_object('id',photo.id,'storage_bucket',photo.storage_bucket,'storage_path',photo.storage_path));
 END LOOP;
 IF n<>cardinality(p_ids) THEN RAISE EXCEPTION 'Sélection modifiée. Rechargez la file avant de supprimer.';END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION tdm_private.delete_review_photos(bigint[],boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION tdm_private.delete_review_photos(bigint[],boolean) TO authenticated;
CREATE FUNCTION public.delete_review_photos(p_ids bigint[],p_finish boolean DEFAULT false) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT tdm_private.delete_review_photos(p_ids,p_finish)$$;
REVOKE ALL ON FUNCTION public.delete_review_photos(bigint[],boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_review_photos(bigint[],boolean) TO authenticated;
