import fs from 'node:fs';
import assert from 'node:assert/strict';
import {managementQuery} from './targeted_management_access.mjs';
const applied=process.argv.includes('--applied');
const migrations=['20260920101916_visual_reference_removal','20260920101926_edt_completed_visibility','20260920200112_confirmed_edt_10_completion'];
const candidate=applied?'':migrations.map(name=>fs.readFileSync(`supabase/migrations/${name}.sql`,'utf8')).join('\n');
const sql=`
CREATE TEMP TABLE mission_results(label text,details jsonb);
GRANT INSERT,SELECT ON mission_results TO authenticated;
DO $$DECLARE actor record;v public.campagne_visuels_formats%rowtype;p text;asset jsonb;result jsonb;rows jsonb;n bigint;before_09 jsonb;BEGIN
 SELECT to_jsonb(e) INTO before_09 FROM public.suivi_des_edt e WHERE id=10;
 IF NOT EXISTS(SELECT 1 FROM public.suivi_des_edt WHERE id=10 AND statut='Terminé' AND lifecycle_status='ferme' AND archived_at IS NULL AND progression=100) THEN RAISE EXCEPTION '10_not_completed';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.suivi_des_edt WHERE id=22 AND no_edt='EDT-TOS-22-A' AND archived_at IS NULL AND statut='Terminé' AND progression=100) THEN RAISE EXCEPTION '22_not_restored';END IF;
 SELECT * INTO v FROM public.campagne_visuels_formats WHERE client_id=2 ORDER BY id LIMIT 1;
 p:=v.client_id||'/'||v.id||'/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.pdf';
 asset:=jsonb_build_object('id','mission-transaction','storage_path',p,'name','Transaction.pdf','mime_type','application/pdf','pages',jsonb_build_array(jsonb_build_object('page',1,'features',jsonb_build_object('version',1))));
 FOR actor IN SELECT * FROM public.utilisateurs WHERE statut='Actif' AND auth_user_id IS NOT NULL AND id IN (1,25,33,-92501) ORDER BY CASE role WHEN 'Administrateur' THEN 0 ELSE 1 END LOOP
  PERFORM set_config('request.jwt.claim.sub',actor.auth_user_id::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor.auth_user_id,'role','authenticated')::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF actor.role='Administrateur' THEN
   INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('visual-references',p,actor.auth_user_id::text) ON CONFLICT DO NOTHING;
   PERFORM public.add_visual_reference(v.id,asset);
   result:=public.remove_visual_reference(v.id,'mission-transaction');
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(result) a WHERE a->>'id'='mission-transaction' AND a->>'archived'='true') THEN RAISE EXCEPTION 'removal_failed';END IF;
   IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='visual-references' AND name=p) THEN RAISE EXCEPTION 'original_lost';END IF;
  ELSE
   BEGIN PERFORM public.remove_visual_reference(v.id,'mission-transaction');RAISE EXCEPTION 'client_write_allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
   SELECT count(*) INTO n FROM storage.objects WHERE bucket_id='visual-references' AND name=p;
   IF actor.client_id IS DISTINCT FROM 2 AND n<>0 THEN RAISE EXCEPTION 'cross_client_reference';END IF;
  END IF;
  IF public.portal_view_allowed('Suivi des EDT') THEN
   rows:=public.portal_business_context('operations')->'edts';
   IF actor.role='Administrateur' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(rows) e WHERE e->>'id'='10' AND e->>'statut'='Terminé' AND e->>'archived_at' IS NULL) THEN RAISE EXCEPTION '10_projection_missing';END IF;
   IF actor.role='Administrateur' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(rows) e WHERE e->>'id'='22' AND e->>'statut'='Terminé' AND e->>'archived_at' IS NULL) THEN RAISE EXCEPTION '22_projection_missing';END IF;
   IF actor.role IN ('Client','Client-Admin') AND EXISTS(SELECT 1 FROM jsonb_array_elements(rows) e WHERE (e->>'client_id')::bigint IS DISTINCT FROM actor.client_id) THEN RAISE EXCEPTION 'cross_client_edt';END IF;
   INSERT INTO mission_results VALUES(actor.role,jsonb_build_object('profile_id',actor.id,'client_id',actor.client_id,'edt_count',jsonb_array_length(rows),'result','PASS'));
  ELSE
   INSERT INTO mission_results VALUES(actor.role,jsonb_build_object('profile_id',actor.id,'client_id',actor.client_id,'view','denied by existing permissions','result','PASS'));
  END IF;
  EXECUTE 'RESET ROLE';
 END LOOP;
 IF (SELECT to_jsonb(e) FROM public.suivi_des_edt e WHERE id=10) IS DISTINCT FROM before_09 THEN RAISE EXCEPTION '10_changed_during_reference_test';END IF;
END $$;
SELECT * FROM mission_results;`;
const results=await managementQuery("BEGIN; SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='45s';\n"+candidate+'\n'+sql+'\nROLLBACK;');
assert(results.some(r=>r.label==='Administrateur'));assert(results.some(r=>r.label==='Client-Admin'));
assert(results.some(r=>r.details.client_id===1),'Client B must be tested');
fs.mkdirSync('.cache/campaign-edt',{recursive:true});
fs.writeFileSync(`.cache/campaign-edt/remote-${applied?'applied':'candidate'}.json`,JSON.stringify({at:new Date().toISOString(),rollback:true,results},null,2));
console.log('PASS: remote rollback, original retention, removal permissions, completed EDT visibility, confirmed EDT preservation, '+results.length+' role profiles including Client B');
