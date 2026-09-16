import {photoMissionCandidateSql} from './photo_mission_candidate_sql.mjs';
import fs from 'node:fs';
import {managementQuery} from './targeted_management_access.mjs';
const migration=await photoMissionCandidateSql();
const result=await managementQuery(`BEGIN;${migration}
DO $$DECLARE uid uuid;payload jsonb;n bigint;BEGIN
 SELECT auth_user_id INTO uid FROM public.utilisateurs WHERE id=25 AND statut='Actif';
 IF uid IS NULL THEN RAISE EXCEPTION 'Missing test identity';END IF;
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
END $$;
SET LOCAL ROLE authenticated;
DO $$DECLARE payload jsonb;n bigint;BEGIN
 SELECT count(*) INTO n FROM public.support_photos;IF n<>0 THEN RAISE EXCEPTION 'Raw photo identity exposed';END IF;
 payload:=public.photo_inventory_read('support_photos',jsonb_build_object('deleted_at',NULL));
 IF (payload->>'total')::int<1 THEN RAISE EXCEPTION 'Scoped photos lost: %',payload->>'total';END IF;
 IF payload::text ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' THEN RAISE EXCEPTION 'Projection email exposed';END IF;
 payload:=public.portal_business_rows('Historique des campagnes');
 IF payload::text ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' THEN RAISE EXCEPTION 'History email exposed';END IF;
END $$;
RESET ROLE;
SELECT 'PASS' AS privacy_transaction;ROLLBACK;`);
fs.writeFileSync('docs/photo-inventory-mission/privacy-transaction-tests.json',JSON.stringify(result,null,2));console.log(result);
