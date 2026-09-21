import fs from 'node:fs';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import {managementQuery} from './targeted_management_access.mjs';
const migration=fs.readFileSync('supabase/migrations/20260920235156_import_manual_edt_assignment.sql','utf8');
const [baseline]=await managementQuery("select pg_get_functiondef('public.finalize_import_photo(bigint)'::regprocedure) as definition");
if(!process.argv.includes('--applied')){const db=new PGlite();try{await db.exec('SET check_function_bodies=false;'+baseline.definition+';');await db.exec(migration);assert((await db.query("select pg_get_functiondef('public.finalize_import_photo(bigint)'::regprocedure) as definition")).rows[0].definition.includes("states->>'edt'='MANUAL_CONFIRMED'"));}finally{await db.close();}}
const sql=`BEGIN;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='45s';${process.argv.includes('--applied')?'':migration}
DO $test$ DECLARE actor uuid;prefix text:='MANUAL-EDT-'||substr(gen_random_uuid()::text,1,8);e bigint;phase_key bigint;v bigint;item bigint;p bigint;s text;ctx jsonb;r jsonb;denied boolean;idx integer;
BEGIN
 SELECT auth_user_id INTO actor FROM utilisateurs WHERE id=1 AND statut='Actif';PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 INSERT INTO suivi_des_edt(no_edt,client_id,campagne_id) VALUES(prefix,2,7) RETURNING id INTO e;
 INSERT INTO edt_phases(edt_id,client_id,phase_type,nom,date_debut_prevue) VALUES(e,2,'installation',prefix,current_date) RETURNING id INTO phase_key;
 INSERT INTO repertoire_des_affiches(client_id,nom_detaille_visuel,format,quantite_entrepot,quantite_expo) VALUES(2,prefix,'678 x 679',100,50) RETURNING id INTO item;
 INSERT INTO campagne_visuels_formats(campagne_id,client_id,nom_visuel,format_support,inventory_item_id) VALUES(7,2,prefix,'678 x 679',item) RETURNING id INTO v;
 FOR idx IN 1..3 LOOP
  s:=prefix||'-'||idx;INSERT INTO infrastructures(support_id,client_id,format_affichage) VALUES(s,CASE WHEN idx=3 THEN 1 ELSE 2 END,'678 x 679');
  INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('support-photos','review/'||s||'.jpg',actor::text);
  INSERT INTO support_photos(source,statut_validation,storage_bucket,storage_path,original_filename,nom_fichier) VALUES('mass_import','À valider','support-photos','review/'||s||'.jpg',s||'.jpg',s||'.jpg') RETURNING id INTO p;
  ctx:=jsonb_build_object('recognition',jsonb_build_object('values',jsonb_build_object('support',s,'date',now()::text,'type','installation','edt',e,'phase',phase_key,'campaign',7,'visual',v),'states',jsonb_build_object('support','MANUAL_CONFIRMED','date','MANUAL_CONFIRMED','type','MANUAL_CONFIRMED','edt',CASE WHEN idx=2 THEN 'AUTO_CONFIRMED' ELSE 'MANUAL_CONFIRMED' END,'phase','MANUAL_CONFIRMED','campaign','MANUAL_CONFIRMED','visual','MANUAL_CONFIRMED')));
  PERFORM save_photo_import_context(p,ctx);
  IF idx=1 THEN
   r:=finalize_import_photo(p);IF (r->>'ok')::boolean IS NOT TRUE OR NOT EXISTS(SELECT 1 FROM edt_supports x WHERE x.edt_id=e AND x.phase_id=phase_key AND x.support_id=s) THEN RAISE EXCEPTION 'manual_assignment_failed';END IF;
   PERFORM finalize_import_photo(p);IF NOT EXISTS(SELECT 1 FROM repertoire_des_affiches WHERE id=item AND quantite_entrepot=99 AND quantite_expo=51) THEN RAISE EXCEPTION 'manual_assignment_stock_retry_failed';END IF;
  ELSE
   denied:=false;BEGIN PERFORM finalize_import_photo(p);EXCEPTION WHEN OTHERS THEN IF SQLERRM='import_edt_context_invalid' THEN denied:=true;ELSE RAISE;END IF;END;
   IF NOT denied OR EXISTS(SELECT 1 FROM edt_supports WHERE support_id=s) THEN RAISE EXCEPTION 'unsafe_assignment_accepted';END IF;
  END IF;
 END LOOP;
END $test$;ROLLBACK;`;
await managementQuery(sql);console.log('PASS: actual import manually assigns EDT once, stock once; unrelated automatic assignment and cross-client assignment denied, transaction rolled back');
