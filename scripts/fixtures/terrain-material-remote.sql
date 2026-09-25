DO $test$
DECLARE actor uuid;client_actor uuid;support text:='MATERIAL-TEST-'||substr(gen_random_uuid()::text,1,8);
 campaign bigint;campaign_name text;visual bigint;item bigint;duplicate bigint;result jsonb;path text;ref text;phase bigint;edt bigint;
BEGIN
 SELECT auth_user_id INTO actor FROM public.utilisateurs WHERE role='Installateur' AND statut='Actif' AND client_id IS NULL LIMIT 1;
 IF actor IS NULL THEN RAISE EXCEPTION 'active_installer_fixture_required';END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 SELECT id,nom_campagne INTO campaign,campaign_name FROM public.campagnes_maitres WHERE client_id=2 AND publiee_terrain AND lower(statut)='active' LIMIT 1;
 INSERT INTO public.infrastructures(support_id,client_id,format_affichage,actif) VALUES(support,2,'987 x 654','Oui');
 INSERT INTO public.campagne_visuels_formats(campagne_id,client_id,nom_visuel,format_support,actif) VALUES(campaign,2,support,'987 x 654 Portrait',true) RETURNING id INTO visual;
 result:=public.resolve_repertoire_affiche(visual,support);
 IF result->>'status'<>'not_found' THEN RAISE EXCEPTION 'missing_item_not_detected: %',result;END IF;
 INSERT INTO public.repertoire_des_affiches(client_id,nom_campagne,nom_detaille_visuel,format,medium_affichage,quantite_entrepot,quantite_expo)
 VALUES(2,campaign_name,support,'987 x 654','Papier',100,50) RETURNING id INTO item;
 result:=public.resolve_repertoire_affiche(visual,support);
 IF result->>'status'<>'resolved' OR (result->'record'->>'id')::bigint<>item THEN RAISE EXCEPTION 'unique_item_not_resolved: %',result;END IF;
 INSERT INTO public.repertoire_des_affiches(client_id,nom_campagne,nom_detaille_visuel,format,medium_affichage,quantite_entrepot,quantite_expo)
 VALUES(2,campaign_name,support,'987 x 654','Autocollant',100,50) RETURNING id INTO duplicate;
 result:=public.resolve_repertoire_affiche(visual,support,NULL,item);
 IF result->>'status'<>'ambiguous' THEN RAISE EXCEPTION 'duplicate_chosen_arbitrarily: %',result;END IF;
 INSERT INTO public.suivi_des_edt(no_edt,client_id,campagne_id,statut,raw_data)
 VALUES(support||'-EDT',2,campaign,'En cours',jsonb_build_object('visuel_id',visual,'medium_affichage','Autocollant')) RETURNING id INTO edt;
 INSERT INTO public.edt_phases(edt_id,client_id,phase_type,nom,statut) VALUES(edt,2,'installation','Material test','en_cours') RETURNING id INTO phase;
 INSERT INTO public.visual_edt_associations(visual_id,phase_id,edt_id) VALUES(visual,phase,edt);
 result:=public.resolve_repertoire_affiche(visual,support,phase);
 IF (result->'record'->>'id')::bigint IS DISTINCT FROM duplicate THEN RAISE EXCEPTION 'medium_not_resolved: %',result;END IF;
 UPDATE public.suivi_des_edt SET raw_data=raw_data||jsonb_build_object('repertoire_affiche_id',item) WHERE id=edt;
 result:=public.resolve_repertoire_affiche(visual,support,phase);
 IF (result->'record'->>'id')::bigint IS DISTINCT FROM item THEN RAISE EXCEPTION 'direct_edt_not_resolved: %',result;END IF;
 UPDATE public.campagne_visuels_formats SET inventory_item_id=item WHERE id=visual;
 path:='supports/'||support||'/install.jpg';ref:='TERRAIN-'||support||'-'||path;
 INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('terrain-photos',path,actor::text);
 result:=public.finaliser_installation_terrain_v1345(support,visual,'install.jpg',path,NULL,NULL,NULL,ref,phase,false,item);
 IF (result->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'installation_failed: %',result;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.repertoire_des_affiches WHERE id=item AND quantite_entrepot=99 AND quantite_expo=51) THEN RAISE EXCEPTION 'wrong_stock';END IF;
 result:=public.finaliser_installation_terrain_v1345(support,visual,'install.jpg',path,NULL,NULL,NULL,ref,phase,false,item);
 IF (result->>'ok')::boolean IS NOT TRUE OR NOT EXISTS(SELECT 1 FROM public.repertoire_des_affiches WHERE id=item AND quantite_entrepot=99 AND quantite_expo=51) THEN RAISE EXCEPTION 'retry_not_idempotent: %',result;END IF;
 IF (SELECT count(*) FROM public.inventory_movements WHERE intervention_reference=ref)<>1 THEN RAISE EXCEPTION 'duplicated_inventory_movement';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.terrain_operations WHERE reference=ref AND details->>'repertoire_affiche_id'=item::text) THEN RAISE EXCEPTION 'operation_article_link_missing';END IF;
 -- No EDT: still uses the canonical finalizer, including rollback on stock zero.
 path:='supports/'||support||'/zero.jpg';INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('terrain-photos',path,actor::text);
 UPDATE public.repertoire_des_affiches SET quantite_entrepot=0 WHERE id=item;
 result:=public.finaliser_installation_terrain_v1345(support,visual,'zero.jpg',path,NULL,NULL,NULL,path,NULL,true,item);
 IF (result->>'ok')::boolean IS NOT FALSE OR EXISTS(SELECT 1 FROM public.support_photos WHERE storage_path=path) THEN RAISE EXCEPTION 'zero_stock_rollback_failed: %',result;END IF;
 UPDATE public.repertoire_des_affiches SET quantite_entrepot=99 WHERE id=item;
 result:=public.finaliser_installation_terrain_v1345(support,visual,'zero.jpg',path,NULL,NULL,NULL,path,NULL,true,item);
 IF (result->>'ok')::boolean IS NOT TRUE OR NOT EXISTS(SELECT 1 FROM public.repertoire_des_affiches WHERE id=item AND quantite_entrepot=98 AND quantite_expo=52) THEN RAISE EXCEPTION 'failed_operation_retry_failed: %',result;END IF;
 SELECT auth_user_id INTO client_actor FROM public.utilisateurs WHERE role='Client-Admin' AND client_id=1 AND statut='Actif' LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',client_actor::text,true);
 BEGIN PERFORM public.resolve_repertoire_affiche(visual,support);RAISE EXCEPTION 'client_material_access_allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 IF has_function_privilege('anon','public.resolve_repertoire_affiche(bigint,text,bigint,bigint,text)','EXECUTE') THEN RAISE EXCEPTION 'anonymous_material_access_allowed';END IF;
END $test$;
