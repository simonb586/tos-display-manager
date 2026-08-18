import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql=fs.readFileSync('supabase/V1_3_4_2_TERRAIN_SECURITY_CONTEXT_PREPARED.sql','utf8').toLowerCase();
let checks=0;const ok=(value,message)=>{assert.ok(value,message);checks++};
const mutations=['finaliser_installation_terrain_v01210(text,bigint,text,text,text,text,text,text)','finaliser_intervention_terrain_v1342(text,bigint,text,text,text,text,text,text,text,text)','resolve_terrain_sync_v113(uuid,text)','request_terrain_sync_retry_v113(uuid)'];
for(const signature of mutations){ok(sql.includes(`revoke execute on function public.${signature} from public,anon`),`${signature}: révocation PUBLIC/anon absente`);ok(sql.includes(`grant execute on function public.${signature} to authenticated`),`${signature}: grant authenticated absent`)}
for(const marker of['auth.uid() is null','terrain_role_denied','cross_context_support_denied','set search_path=pg_catalog,public,pg_temp','security definer'])ok(sql.includes(marker),marker);
ok(!/grant execute on function public\.finaliser_(installation|intervention)_terrain[^;]+to anon/.test(sql),'Une mutation Terrain est accordée à anon.');
ok(sql.includes('revoke execute on function public.finaliser_intervention_terrain_v01273')&&sql.includes('from public,anon,authenticated'),'Ancienne intervention encore exposée.');
ok(sql.includes("v_user.role not in ('administrateur','coordonnateur','installateur')"),'Rôles Terrain non contrôlés.');
ok(sql.includes('es.support_id=p_support_id')&&sql.includes('e.campagne_id=v_campaign_id'),'Support/campagne non liés côté serveur.');
console.log(`V1.3.4.2 sécurité RPC Terrain : ${checks} contrôles réussis.`);
