import {photoMissionCandidateSql} from './photo_mission_candidate_sql.mjs';
import fs from 'node:fs';
import {managementQuery} from './targeted_management_access.mjs';
const migration=(await photoMissionCandidateSql())+(process.env.TDM_PHOTO_CANDIDATE?fs.readFileSync(process.env.TDM_PHOTO_CANDIDATE,'utf8'):'');
const result=await managementQuery(`BEGIN;${migration}
DO $$DECLARE uid uuid;e bigint;pi bigint;pr bigint;v bigint;photo bigint;photo2 bigint;ambiguous bigint;ret bigint;first_history bigint;payload jsonb;context jsonb;n bigint;before_state jsonb;BEGIN
 SELECT auth_user_id INTO uid FROM public.utilisateurs WHERE role='Administrateur' AND statut='Actif' AND client_id IS NULL LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 INSERT INTO public.infrastructures(support_id,client_id,format_affichage,site) VALUES('IMPORT-SQL-FINALIZE',2,'20 x 28 Portrait','Controlled SQL transaction');
 INSERT INTO public.suivi_des_edt(no_edt,client_id,campagne_id,statut) VALUES('IMPORT-SQL-FINALIZE-EDT',2,7,'En cours') RETURNING id INTO e;
 INSERT INTO public.edt_phases(edt_id,client_id,phase_type,nom,date_debut_prevue) VALUES(e,2,'installation','Installation','2026-06-01') RETURNING id INTO pi;
 INSERT INTO public.edt_phases(edt_id,client_id,phase_type,nom,date_debut_prevue) VALUES(e,2,'retrait','Retrait','2026-06-15') RETURNING id INTO pr;
 INSERT INTO public.edt_supports(edt_id,phase_id,support_id) VALUES(e,pi,'IMPORT-SQL-FINALIZE'),(e,pr,'IMPORT-SQL-FINALIZE');
 INSERT INTO public.campagne_visuels_formats(campagne_id,client_id,nom_visuel,format_support,actif) VALUES(7,2,'IMPORT-SQL-FINALIZE-VISUAL','20 x 28',true) RETURNING id INTO v;
 INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('support-photos','review/SQL-FINALIZE/a.jpg',uid::text),('support-photos','review/SQL-FINALIZE/b.jpg',uid::text),('support-photos','review/SQL-FINALIZE/unknown.jpg',uid::text),('support-photos','review/SQL-FINALIZE/removal.jpg',uid::text);
 INSERT INTO public.support_photos(source,review_status,type_photo,original_filename,nom_fichier,storage_bucket,storage_path,import_batch_id) VALUES('mass_import','unmatched','Photo','a.jpg','a.jpg','support-photos','review/SQL-FINALIZE/a.jpg','SQL-FINALIZE') RETURNING id INTO photo;
 INSERT INTO public.support_photos(source,review_status,type_photo,original_filename,nom_fichier,storage_bucket,storage_path,import_batch_id) VALUES('mass_import','unmatched','Photo','b.jpg','b.jpg','support-photos','review/SQL-FINALIZE/b.jpg','SQL-FINALIZE') RETURNING id INTO photo2;
 INSERT INTO public.support_photos(source,review_status,type_photo,original_filename,nom_fichier,storage_bucket,storage_path,import_batch_id) VALUES('mass_import','unmatched','Photo','unknown.jpg','unknown.jpg','support-photos','review/SQL-FINALIZE/unknown.jpg','SQL-FINALIZE') RETURNING id INTO ambiguous;
 INSERT INTO public.support_photos(source,review_status,type_photo,original_filename,nom_fichier,storage_bucket,storage_path,import_batch_id) VALUES('mass_import','unmatched','Photo','removal.jpg','removal.jpg','support-photos','review/SQL-FINALIZE/removal.jpg','SQL-FINALIZE') RETURNING id INTO ret;
 IF EXISTS(SELECT 1 FROM public.support_photos WHERE id IN(photo,photo2,ambiguous,ret) AND normalized_filename IS NOT NULL) THEN RAISE EXCEPTION 'Draft prematurely renamed';END IF;
 context:=jsonb_build_object('recognition',jsonb_build_object('values',jsonb_build_object('support','IMPORT-SQL-FINALIZE','date','2026-06-01T12:00:00Z','type','installation','edt',e,'phase',pi,'campaign',7,'visual',v),
 'states',jsonb_build_object('support','MANUAL_CONFIRMED','date','MANUAL_CONFIRMED','type','AUTO_CONFIRMED','edt','AUTO_CONFIRMED','phase','AUTO_CONFIRMED','campaign','AUTO_CONFIRMED','visual','AUTO_CONFIRMED'),'dateSource','MANUAL'));
 before_state:=tdm_private.display_state('IMPORT-SQL-FINALIZE');
 PERFORM public.save_photo_import_context(ambiguous,jsonb_set(context,'{recognition,states,visual}','"TO_REVIEW"'));
 BEGIN PERFORM public.finalize_import_photo(ambiguous);RAISE EXCEPTION 'Ambiguous import accepted';EXCEPTION WHEN raise_exception THEN IF SQLERRM='Ambiguous import accepted' THEN RAISE;END IF;END;
 IF tdm_private.display_state('IMPORT-SQL-FINALIZE') IS DISTINCT FROM before_state THEN RAISE EXCEPTION 'Ambiguous import changed infrastructure';END IF;
 PERFORM public.save_photo_import_context(photo,context);payload:=public.finalize_import_photo(photo);first_history:=(payload->>'history_id')::bigint;
 IF first_history IS NULL THEN RAISE EXCEPTION 'Import installation not recorded';END IF;
 IF (SELECT visuel_id FROM public.infrastructures WHERE support_id='IMPORT-SQL-FINALIZE') IS DISTINCT FROM v THEN RAISE EXCEPTION 'Installed state wrong';END IF;
 PERFORM public.save_photo_import_context(photo2,context);payload:=public.finalize_import_photo(photo2);
 IF (payload->>'history_id')::bigint<>first_history THEN RAISE EXCEPTION 'Multiple photos duplicated installation';END IF;
 IF NOT (public.finalize_import_photo(photo2)->>'already_finalized')::boolean THEN RAISE EXCEPTION 'Repeated finalize not idempotent';END IF;
 context:=jsonb_set(jsonb_set(jsonb_set(context,'{recognition,values,type}','"retrait"'),'{recognition,values,phase}',to_jsonb(pr)),'{recognition,values,date}','"2026-06-15T12:00:00Z"');
 PERFORM public.save_photo_import_context(ret,context);payload:=public.finalize_import_photo(ret);
 IF (SELECT visuel_id FROM public.infrastructures WHERE support_id='IMPORT-SQL-FINALIZE') IS NOT NULL THEN RAISE EXCEPTION 'Removal failed';END IF;
 PERFORM public.cancel_display_movement((payload->>'history_id')::bigint,'retrait','Rollback test');
 IF (SELECT visuel_id FROM public.infrastructures WHERE support_id='IMPORT-SQL-FINALIZE') IS DISTINCT FROM v THEN RAISE EXCEPTION 'Removal cancellation did not restore visual';END IF;
 IF (SELECT count(*) FROM public.support_photos WHERE id IN(photo,photo2,ambiguous,ret))<>4 THEN RAISE EXCEPTION 'Photo lost';END IF;
 IF (SELECT count(*) FROM storage.objects WHERE bucket_id='support-photos' AND name LIKE 'review/SQL-FINALIZE/%')<>4 THEN RAISE EXCEPTION 'Original lost';END IF;
 IF (SELECT storage_path FROM public.support_photos WHERE id=photo)<>'review/SQL-FINALIZE/a.jpg' THEN RAISE EXCEPTION 'Original moved';END IF;
 IF (public.list_display_movements('IMPORT-SQL-FINALIZE',NULL,'',true)->>'total')::int<>2 THEN RAISE EXCEPTION 'Unexpected movement count';END IF;
 -- Existing equivalent canonical events cannot cause a guessed third movement.
 UPDATE public.historique_des_campagnes SET import_movement_key=NULL WHERE id=first_history;
 INSERT INTO public.historique_des_campagnes(support_id,client_id,campagne,visuel,no_edt,date_installation,raw_data,movement_meta)
 SELECT support_id,client_id,campagne,visuel,no_edt,date_installation,raw_data,movement_meta FROM public.historique_des_campagnes WHERE id=first_history;
 context:=jsonb_set(jsonb_set(jsonb_set(context,'{recognition,values,type}','"installation"'),'{recognition,values,phase}',to_jsonb(pi)),'{recognition,values,date}','"2026-06-01T12:00:00Z"');
 PERFORM public.save_photo_import_context(ambiguous,context);
 BEGIN PERFORM public.finalize_import_photo(ambiguous);RAISE EXCEPTION 'Existing ambiguity accepted';EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'import_existing_movement_ambiguous' THEN RAISE;END IF;END;
END $$;
SELECT 'PASS' AS import_transaction;ROLLBACK;`);
fs.writeFileSync('docs/photo-inventory-mission/import-transaction-tests.json',JSON.stringify(result,null,2));console.log(result);
