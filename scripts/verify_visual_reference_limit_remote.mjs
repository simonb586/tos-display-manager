import fs from 'node:fs';
import assert from 'node:assert/strict';
import {managementQuery} from './targeted_management_access.mjs';
const migration=process.argv.includes('--applied')?'':fs.readFileSync('supabase/migrations/20260920104037_visual_reference_active_limit.sql','utf8');
const rows=await managementQuery(`BEGIN;SET LOCAL lock_timeout='3s';
${migration}
CREATE TEMP TABLE reference_limit_fixture(reference_assets jsonb);
DO $$DECLARE definition text;BEGIN
 SELECT pg_get_constraintdef(oid) INTO definition FROM pg_constraint WHERE conrelid='public.campagne_visuels_formats'::regclass AND conname='visual_reference_assets_shape';
 EXECUTE 'ALTER TABLE reference_limit_fixture ADD CONSTRAINT fixture_limit '||definition;
 INSERT INTO reference_limit_fixture SELECT jsonb_agg(jsonb_build_object('id',i,'archived',i>10)) FROM generate_series(1,12) i;
 BEGIN
  INSERT INTO reference_limit_fixture SELECT jsonb_agg(jsonb_build_object('id',i)) FROM generate_series(1,11) i;
  RAISE EXCEPTION 'active_limit_not_enforced';
 EXCEPTION WHEN check_violation THEN NULL;END;
END $$;
SELECT count(*)::int n FROM reference_limit_fixture;
ROLLBACK;`);
assert.equal(rows[0].n,1);console.log('PASS: remote rollback, 10 active references plus retained history allowed; 11 active rejected');
