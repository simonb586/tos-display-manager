import {photoMissionCandidateSql} from './photo_mission_candidate_sql.mjs';
import fs from 'node:fs';
import {managementQuery} from './targeted_management_access.mjs';
const sql=await photoMissionCandidateSql();
const result=await managementQuery(`BEGIN;${sql}
DO $$DECLARE uid uuid;v bigint;e bigint;p bigint;payload jsonb;action text;path text;BEGIN
 SELECT auth_user_id INTO uid FROM public.utilisateurs WHERE role='Administrateur' AND statut='Actif' AND client_id IS NULL LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 INSERT INTO public.infrastructures(support_id,client_id,format_affichage,site) VALUES('IMPORT-TERRAIN-ROLLBACK',2,'20 x 28 Portrait','Controlled SQL transaction');
 INSERT INTO public.campagne_visuels_formats(campagne_id,client_id,nom_visuel,format_support,actif) VALUES(7,2,'IMPORT-TERRAIN-ROLLBACK','20 x 28',true) RETURNING id INTO v;
 INSERT INTO public.suivi_des_edt(no_edt,client_id,campagne_id,statut) VALUES('IMPORT-TERRAIN-ROLLBACK-EDT',2,7,'En cours') RETURNING id INTO e;
 INSERT INTO public.edt_phases(edt_id,client_id,phase_type,nom) VALUES(e,2,'installation','SQL regression') RETURNING id INTO p;
 INSERT INTO public.visual_edt_associations(visual_id,edt_id,phase_id) VALUES(v,e,p);
 FOREACH action IN ARRAY ARRAY['installation','without','inspection','enjeu','retrait'] LOOP
  path:='supports/IMPORT-TERRAIN-ROLLBACK/'||action||'.png';
  INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('terrain-photos',path,uid::text);
  IF action IN ('installation','without') THEN
   payload:=public.finaliser_installation_terrain_v1344('IMPORT-TERRAIN-ROLLBACK',v,action||'.png',path,NULL,NULL,NULL,'ROLLBACK-'||action,CASE WHEN action='installation' THEN p END,action='without');
  ELSE
   payload:=public.finaliser_intervention_terrain_v01273('IMPORT-TERRAIN-ROLLBACK',action,CASE WHEN action='enjeu' THEN 'Vitre' END,'Test annulé',action||'.png',path,NULL,NULL,'ROLLBACK-'||action);
  END IF;
  IF payload->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Terrain % failed: %',action,payload;END IF;
 END LOOP;
 IF (SELECT count(*) FROM public.support_photos WHERE support_id='IMPORT-TERRAIN-ROLLBACK')<>5 THEN RAISE EXCEPTION 'Terrain photo regression';END IF;
 IF (public.list_display_movements('IMPORT-TERRAIN-ROLLBACK')->>'total')::int<>3 THEN RAISE EXCEPTION 'Inspection/issue became movement';END IF;
 IF (SELECT visuel_id FROM public.infrastructures WHERE support_id='IMPORT-TERRAIN-ROLLBACK') IS NOT NULL THEN RAISE EXCEPTION 'Terrain removal state regression';END IF;
END $$;
SELECT 'PASS' AS terrain_five_workflows;ROLLBACK;`);
fs.writeFileSync('docs/photo-inventory-mission/terrain-transaction-tests.json',JSON.stringify(result,null,2));console.log(result);
