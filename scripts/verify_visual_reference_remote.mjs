import fs from 'node:fs';
import assert from 'node:assert/strict';
import {managementQuery} from './targeted_management_access.mjs';
const migration=fs.readFileSync('supabase/migrations/20260920085824_visual_reference_assets.sql','utf8');
const sql=`
CREATE TEMP TABLE reference_results(label text,details jsonb);
GRANT INSERT,SELECT ON reference_results TO authenticated;
DO $$DECLARE actor record;v public.campagne_visuels_formats%rowtype;p text;asset jsonb;n bigint;BEGIN
 SELECT * INTO v FROM public.campagne_visuels_formats WHERE client_id=2 ORDER BY id LIMIT 1;
 p:=v.client_id||'/'||v.id||'/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.pdf';
 asset:=jsonb_build_object('id','transaction-only','storage_path',p,'name','Transaction.pdf','mime_type','application/pdf','pages',jsonb_build_array(jsonb_build_object('page',1,'features',jsonb_build_object('version',1))));
 FOR actor IN SELECT * FROM public.utilisateurs WHERE statut='Actif' AND auth_user_id IS NOT NULL AND role IN ('Administrateur','Client','Client-Admin') ORDER BY CASE role WHEN 'Administrateur' THEN 0 ELSE 1 END LOOP
  PERFORM set_config('request.jwt.claim.sub',actor.auth_user_id::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor.auth_user_id,'role','authenticated')::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF actor.role='Administrateur' THEN
   INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('visual-references',p,actor.auth_user_id::text) ON CONFLICT DO NOTHING;
   PERFORM public.add_visual_reference(v.id,asset);
   PERFORM public.add_visual_reference(v.id,asset);
   SELECT count(*) INTO n FROM public.campagne_visuels_formats f CROSS JOIN LATERAL jsonb_array_elements(f.reference_assets) a WHERE f.id=v.id AND a->>'id'='transaction-only';
   IF n<>1 THEN RAISE EXCEPTION 'duplicate_reference';END IF;
  ELSE
   SELECT count(*) INTO n FROM storage.objects WHERE bucket_id='visual-references' AND name=p;
   IF actor.client_id IS DISTINCT FROM 2 AND n<>0 THEN RAISE EXCEPTION 'cross_client_reference';END IF;
   BEGIN PERFORM public.add_visual_reference(v.id,asset);RAISE EXCEPTION 'client_write_allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
   SELECT count(*) INTO n FROM public.infrastructures WHERE client_id IS DISTINCT FROM actor.client_id;
   IF n<>0 THEN RAISE EXCEPTION 'cross_client_infrastructure';END IF;
   SELECT count(*) INTO n FROM public.historique_des_campagnes WHERE client_id IS DISTINCT FROM actor.client_id;
   IF n<>0 THEN RAISE EXCEPTION 'cross_client_history';END IF;
  END IF;
  INSERT INTO reference_results VALUES(actor.role,jsonb_build_object('profile_id',actor.id,'client_id',actor.client_id,'result','PASS'));
  EXECUTE 'RESET ROLE';
 END LOOP;
END $$;
SELECT * FROM reference_results;
`;
const results=await managementQuery("BEGIN; SET LOCAL lock_timeout='2s'; SET LOCAL statement_timeout='15s';\n"+migration+'\n'+sql+'\nROLLBACK;');
assert(results.some(r=>r.label==='Administrateur'));assert(results.some(r=>r.label==='Client-Admin'));
fs.mkdirSync('docs/site-support-installations',{recursive:true});
fs.writeFileSync('docs/site-support-installations/remote-transaction.json',JSON.stringify({at:new Date().toISOString(),rollback:true,results},null,2));
console.log('PASS: migration transaction rolled back; '+results.length+' active profiles checked');
