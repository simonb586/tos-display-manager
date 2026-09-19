import fs from 'node:fs';
import {managementQuery} from './targeted_management_access.mjs';
const migration=process.env.TDM_MISSION_APPLIED?'':fs.readFileSync('supabase/migrations/20260919232440_review_edt_campaign_consistency.sql','utf8');
const result=await managementQuery(`BEGIN;${migration}
CREATE TEMP TABLE mission_results(label text,result jsonb);GRANT ALL ON mission_results TO authenticated;
DO $$DECLARE uid uuid;v jsonb;baseline jsonb;links jsonb;actor record;n bigint;photo_count bigint;expected bigint;BEGIN
 SELECT auth_user_id INTO uid FROM public.utilisateurs WHERE role='Administrateur' AND statut='Actif' AND client_id IS NULL LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
 links:=public.photo_inventory_read('support_photos','{"deleted_at":null,"review_queue":true}',0,1000);
 SELECT count(*) INTO expected FROM public.support_photos WHERE deleted_at IS NULL AND (source='mass_import' OR review_status IS NOT NULL OR statut_validation='À valider');
 IF (links->>'total')::bigint<>expected OR jsonb_array_length(links->'rows')<>expected THEN RAISE EXCEPTION 'review_queue_count_mismatch';END IF;
 INSERT INTO mission_results VALUES('review queue database / RPC',jsonb_build_object('database',expected,'rpc',links->'total'));
 v:=public.save_campaign_visual_with_edts('{"campagne_id":11,"nom_visuel":"MISSION-ROLLBACK-TEST","format_support":"20 x 28"}',
 '[{"phase_id":18,"date_debut":"2026-09-01","date_fin":"2026-09-15"},{"phase_id":40,"date_debut":"2026-09-02","date_fin":"2026-09-16"}]');
 SELECT count(*) INTO n FROM public.visual_edt_associations WHERE visual_id=(v->>'id')::bigint;
 IF n<>2 THEN RAISE EXCEPTION 'multi_edt_missing';END IF;
 INSERT INTO mission_results VALUES('EDT-TOS-09 / EDT-TOS-22-A / multi-EDT',jsonb_build_object('links',n));
 v:=public.save_campaign_visual_with_edts(v||'{"campagne_id":15}','[{"phase_id":40,"date_debut":"2026-09-03","date_fin":"2026-09-17"}]');
 SELECT jsonb_agg(to_jsonb(a)) INTO baseline FROM public.visual_edt_associations a WHERE visual_id=(v->>'id')::bigint;
 IF jsonb_array_length(baseline)<>1 OR baseline->0->>'date_debut'<>'2026-09-03' THEN RAISE EXCEPTION 'date_or_removal_failed';END IF;
 BEGIN
  PERFORM public.save_campaign_visual_with_edts(v,'[{"phase_id":40,"date_debut":"2026-09-17","date_fin":"2026-09-03"}]');
  RAISE EXCEPTION 'invalid_dates_accepted';
 EXCEPTION WHEN check_violation THEN NULL;END;
 SELECT jsonb_agg(to_jsonb(a)) INTO links FROM public.visual_edt_associations a WHERE visual_id=(v->>'id')::bigint;
 IF links IS DISTINCT FROM baseline THEN RAISE EXCEPTION 'failed_save_lost_associations';END IF;
 SELECT p.id INTO n FROM public.edt_phases p JOIN public.suivi_des_edt e ON e.id=p.edt_id JOIN public.campagnes_maitres c ON c.id=e.campagne_id WHERE c.business_context='operational_communication' AND p.phase_type='installation' LIMIT 1;
 BEGIN
  PERFORM public.save_visual_edt_associations((v->>'id')::bigint,jsonb_build_array(jsonb_build_object('phase_id',n)));
  RAISE EXCEPTION 'cross_context_accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 PERFORM public.save_visual_edt_associations((v->>'id')::bigint,'[]');
 IF EXISTS(SELECT 1 FROM public.visual_edt_associations WHERE visual_id=(v->>'id')::bigint) THEN RAISE EXCEPTION 'remove_failed';END IF;
 INSERT INTO mission_results VALUES('atomic campaign update / dates / remove / rejected cross-context','"PASS"');
 FOR actor IN SELECT auth_user_id,role,client_id FROM public.utilisateurs WHERE statut='Actif' AND auth_user_id IS NOT NULL AND role IN ('Administrateur','Client','Client-Admin') LOOP
  EXECUTE 'RESET ROLE';PERFORM set_config('request.jwt.claim.sub',actor.auth_user_id::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
  links:=public.photo_inventory_read('support_photos','{"deleted_at":null}',0,1000);
  IF actor.role IN ('Client','Client-Admin') AND EXISTS(SELECT 1 FROM jsonb_array_elements(links->'rows') r WHERE nullif(r->>'client_id','')::bigint IS DISTINCT FROM actor.client_id) THEN RAISE EXCEPTION 'cross_client_photo_read';END IF;
  IF actor.role IN ('Client','Client-Admin') THEN
   BEGIN PERFORM public.save_campaign_visual_with_edts(v,'[]');RAISE EXCEPTION 'client_visual_write_accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  END IF;
  INSERT INTO mission_results VALUES('photo scope / '+actor.role, jsonb_build_object('client',actor.client_id,'total',links->'total'));
 END LOOP;
END $$;
RESET ROLE;SELECT * FROM mission_results;ROLLBACK;`.replace("'photo scope / '+actor.role","'photo scope / '||actor.role"));
fs.mkdirSync('docs/review-edt-mission',{recursive:true});fs.writeFileSync('docs/review-edt-mission/sql-remote.json',JSON.stringify(result,null,2));console.log(result);
