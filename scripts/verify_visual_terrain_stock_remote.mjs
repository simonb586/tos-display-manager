import fs from 'node:fs';
import {managementQuery} from './targeted_management_access.mjs';
const candidate=process.argv.includes('--applied')?'':fs.readFileSync('supabase/migrations/20260920220303_visual_terrain_stock_workflows.sql','utf8');
const sql=`BEGIN;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='45s';
${candidate}
DO $test$
DECLARE actor uuid;support text:='WORKFLOW-ROLLBACK-'||substr(gen_random_uuid()::text,1,8);v bigint;item bigint;h bigint;result jsonb;rule record;issue bigint;path text;n integer;before_photo text;ids bigint[]:='{}';p bigint;
BEGIN
 SELECT auth_user_id INTO actor FROM public.utilisateurs WHERE id=1 AND statut='Actif';
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 INSERT INTO public.infrastructures(support_id,client_id,format_affichage,actif,photo_principale_url) VALUES(support,2,'987 x 654','Oui','preserved-original.jpg');
 INSERT INTO public.repertoire_des_affiches(client_id,nom_campagne,nom_detaille_visuel,format,quantite_entrepot,quantite_expo) VALUES(2,'Test workflow',support,'987 x 654',100,50) RETURNING id INTO item;
 INSERT INTO public.campagne_visuels_formats(campagne_id,client_id,nom_visuel,format_support,actif,inventory_item_id) VALUES(7,2,support,'987 x 654',true,item) RETURNING id INTO v;
 FOR rule IN SELECT * FROM public.terrain_issue_types ORDER BY sort_order LOOP
  path:='supports/'||support||'/issue-'||rule.sort_order||'.jpg';
  INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('terrain-photos',path,actor::text);
  result:=public.finaliser_intervention_terrain_v1342(support,NULL,'enjeu',rule.label,'','issue.jpg',path,NULL,NULL,path);
  IF (result->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'issue_failed: %',result;END IF;
  issue:=(result->>'enjeu_id')::bigint;
  IF NOT EXISTS(SELECT 1 FROM public.enjeux_terrain WHERE id=issue AND duration=rule.duration AND deactivates_support=rule.deactivates_support AND client_id=2) THEN RAISE EXCEPTION 'issue_rule_not_persisted';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.infrastructures WHERE support_id=support AND actif=CASE WHEN rule.deactivates_support THEN 'Non' ELSE 'Oui' END AND photo_principale_url='preserved-original.jpg') THEN RAISE EXCEPTION 'issue_support_projection_or_photo_changed';END IF;
  path:='supports/'||support||'/resolution-'||rule.sort_order||'.jpg';INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('terrain-photos',path,actor::text);
  result:=public.resolve_terrain_issue(issue,'resolved.jpg',path,NULL);
  IF (result->>'ok')::boolean IS NOT TRUE OR NOT EXISTS(SELECT 1 FROM public.infrastructures WHERE support_id=support AND actif='Oui' AND photo_principale_url='preserved-original.jpg') THEN RAISE EXCEPTION 'resolution_failed: %',result;END IF;
 END LOOP;
 path:='supports/'||support||'/install.jpg';INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('terrain-photos',path,actor::text);
 result:=public.finaliser_installation_terrain_v1344(support,v,'install.jpg',path,NULL,NULL,NULL,path,NULL,true);
 IF (result->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'installation_failed: %',result;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.repertoire_des_affiches WHERE id=item AND quantite_entrepot=99 AND quantite_expo=51) THEN RAISE EXCEPTION 'stock_installation_failed';END IF;
 result:=public.finaliser_installation_terrain_v1344(support,v,'install.jpg',path,NULL,NULL,NULL,path,NULL,true);
 IF (result->>'ok')::boolean IS NOT TRUE OR NOT EXISTS(SELECT 1 FROM public.repertoire_des_affiches WHERE id=item AND quantite_entrepot=99 AND quantite_expo=51) THEN RAISE EXCEPTION 'stock_retry_failed';END IF;

 path:='review/'||support||'/additional-proof.jpg';INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('support-photos',path,actor::text);
 INSERT INTO public.support_photos(source,statut_validation,storage_bucket,storage_path,nom_fichier,original_filename) VALUES('mass_import','À valider','support-photos',path,'additional-proof.jpg','additional-proof.jpg') RETURNING id INTO p;
 PERFORM public.save_photo_import_context(p,jsonb_build_object('recognition',jsonb_build_object('values',jsonb_build_object('support',support,'date',now()::text,'type','installation','edt',null,'phase',null,'campaign',7,'visual',v,'withoutEdt',true),'states','{"support":"MANUAL_CONFIRMED","date":"MANUAL_CONFIRMED","type":"MANUAL_CONFIRMED","edt":"NOT_APPLICABLE","phase":"NOT_APPLICABLE","campaign":"MANUAL_CONFIRMED","visual":"MANUAL_CONFIRMED"}'::jsonb)));
 result:=public.finalize_import_photo(p);IF (result->>'ok')::boolean IS NOT TRUE OR NOT EXISTS(SELECT 1 FROM public.repertoire_des_affiches WHERE id=item AND quantite_entrepot=99 AND quantite_expo=51) THEN RAISE EXCEPTION 'import_existing_installation_stock_duplicated';END IF;
 result:=public.finalize_import_photo(p);IF (result->>'already_finalized')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'import_retry_not_idempotent';END IF;
 path:='supports/'||support||'/remove.jpg';INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('terrain-photos',path,actor::text);
 result:=public.finaliser_intervention_terrain_v1342(support,NULL,'retrait',NULL,NULL,'remove.jpg',path,NULL,NULL,path);
 IF (result->>'ok')::boolean IS NOT TRUE OR NOT EXISTS(SELECT 1 FROM public.repertoire_des_affiches WHERE id=item AND quantite_entrepot=100 AND quantite_expo=50) THEN RAISE EXCEPTION 'stock_removal_failed: %',result;END IF;
 UPDATE public.repertoire_des_affiches SET quantite_entrepot=0 WHERE id=item;
 path:='supports/'||support||'/zero.jpg';INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('terrain-photos',path,actor::text);
 result:=public.finaliser_installation_terrain_v1344(support,v,'zero.jpg',path,NULL,NULL,NULL,path,NULL,true);
 IF (result->>'ok')::boolean IS NOT FALSE OR EXISTS(SELECT 1 FROM public.support_photos WHERE storage_path=path) THEN RAISE EXCEPTION 'stock_zero_rollback_failed';END IF;
 FOR n IN 1..20 LOOP
  INSERT INTO public.support_photos(source,statut_validation,storage_bucket,storage_path,nom_fichier,original_filename) VALUES('mass_import','À valider','support-photos','review/'||support||'/'||n||'.jpg',n||'.jpg',n||'.jpg') RETURNING id INTO p;
  IF n<=5 THEN ids:=array_append(ids,p);END IF;
 END LOOP;
 result:=public.delete_review_photos(ids,false);IF jsonb_array_length(result)<>5 THEN RAISE EXCEPTION 'batch_reservation_failed';END IF;
 BEGIN UPDATE public.support_photos SET import_finalized_at=now() WHERE id=ids[1];RAISE EXCEPTION 'reservation_guard_missing';EXCEPTION WHEN object_not_in_prerequisite_state THEN NULL;END;
 PERFORM set_config('request.jwt.claim.sub',(SELECT auth_user_id::text FROM public.utilisateurs WHERE id=25),true);
 BEGIN PERFORM public.delete_review_photos(ids,false);RAISE EXCEPTION 'client_delete_allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.resolve_terrain_issue(issue,'resolved.jpg',path,NULL);RAISE EXCEPTION 'client_resolution_allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $test$;
SELECT 'PASS' result;ROLLBACK;`;
await managementQuery(sql);console.log('PASS: remote rollback; 11 issue rules, preserved main photo, resolution, atomic canonical installation/removal, retry, zero-stock rollback, bulk reservation and Client-Admin denial');
