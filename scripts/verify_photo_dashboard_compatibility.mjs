import fs from 'node:fs';
import {managementQuery} from './targeted_management_access.mjs';
const candidate=fs.readFileSync('supabase/migrations/20260916003054_photo_projection_dashboard_compatibility.sql','utf8');
const result=await managementQuery(`BEGIN;
SELECT set_config('request.jwt.claim.sub',(SELECT auth_user_id::text FROM public.utilisateurs WHERE id=25),true);
CREATE TEMP TABLE expected_dashboard(value jsonb);
DO $$DECLARE t text;BEGIN FOR t IN SELECT tablename FROM pg_policies WHERE schemaname='public' AND policyname='photo_private_client_projection' LOOP EXECUTE format('ALTER POLICY photo_private_client_projection ON public.%I USING (true)',t);END LOOP;END $$;
GRANT ALL ON expected_dashboard TO authenticated;
SET LOCAL ROLE authenticated;
INSERT INTO expected_dashboard SELECT public.portal_dashboard_summary()->'kpis';
RESET ROLE;
${candidate}
SET LOCAL ROLE authenticated;
DO $$DECLARE actual jsonb;BEGIN actual:=public.portal_dashboard_summary()->'kpis';IF actual IS DISTINCT FROM (SELECT value FROM expected_dashboard) THEN RAISE EXCEPTION 'Dashboard aggregate regression: % instead of %',actual,(SELECT value FROM expected_dashboard);END IF;IF (SELECT count(*) FROM public.support_photos)<>0 THEN RAISE EXCEPTION 'Raw privacy weakened';END IF;END $$;
RESET ROLE;
SELECT 'PASS' AS original_dashboard_counts_preserved;ROLLBACK;`);
fs.writeFileSync('docs/photo-inventory-mission/dashboard-compatibility-tests.json',JSON.stringify(result,null,2));console.log(result);
