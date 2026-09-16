import {photoMissionCandidateSql} from './photo_mission_candidate_sql.mjs';
import fs from 'node:fs';
import {managementQuery} from './targeted_management_access.mjs';
const sql=await photoMissionCandidateSql();
const result=await managementQuery(`BEGIN;${sql}
DO $$DECLARE uid uuid;role_name text;t text;payload jsonb;s text;original_client bigint;BEGIN
 SELECT auth_user_id,client_id INTO uid,original_client FROM public.utilisateurs WHERE id=25;
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 FOREACH role_name IN ARRAY ARRAY['Client','Client-Admin'] LOOP
  UPDATE public.utilisateurs SET role=role_name WHERE id=25;
  FOREACH t IN ARRAY ARRAY['support_photos','photos','historique_des_campagnes','inspections_terrain','enjeux_terrain','activity_events','operations_history','terrain_operations','edt_reports','edt_phase_reports','communications_finales'] LOOP
   payload:=public.photo_inventory_read(t);
   IF payload::text ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}' THEN RAISE EXCEPTION 'Author exposed in % for %',t,role_name;END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(payload->'rows')r WHERE nullif(r->>'client_id','')::bigint IS DISTINCT FROM original_client AND r->>'client_id' IS NOT NULL) THEN RAISE EXCEPTION 'Cross tenant %',t;END IF;
  END LOOP;
  SELECT support_id INTO s FROM public.support_photos WHERE client_id=original_client LIMIT 1;
  payload:=public.portal_business_context('support',s);
  IF payload::text ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}' THEN RAISE EXCEPTION '360 author exposed';END IF;
  IF (public.photo_inventory_capabilities()->>'cancel')::boolean OR (public.photo_inventory_capabilities()->>'import')::boolean THEN RAISE EXCEPTION 'Client mutation capability';END IF;
 END LOOP;
 UPDATE public.utilisateurs SET role='Client-Admin',client_id=1 WHERE id=25;
 payload:=public.photo_inventory_read('support_photos');
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(payload->'rows')r WHERE r->>'client_id'='2') THEN RAISE EXCEPTION 'Client B sees EXO';END IF;
 UPDATE public.utilisateurs SET role='Client-Admin',client_id=original_client WHERE id=25;
 SELECT auth_user_id INTO uid FROM public.utilisateurs WHERE role='Administrateur' AND statut='Actif' AND client_id IS NULL LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 payload:=public.admin_preview_client_portal_section_v1361(25,'photos');
 IF payload::text ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}' THEN RAISE EXCEPTION 'Preview author exposed';END IF;
 payload:=public.photo_inventory_read('support_photos');
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(payload->'rows')r WHERE r ? 'utilisateur') THEN RAISE EXCEPTION 'Internal audit projection removed';END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);
 BEGIN PERFORM public.photo_inventory_read();RAISE EXCEPTION 'Anonymous reader allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
SELECT 'PASS' AS privacy_roles_360_reports_preview;ROLLBACK;`);
fs.writeFileSync('docs/photo-inventory-mission/privacy-matrix-tests.json',JSON.stringify(result,null,2));console.log(result);
