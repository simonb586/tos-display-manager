import fs from 'node:fs';
import assert from 'node:assert/strict';
import {managementQuery} from './targeted_management_access.mjs';
const actors=await managementQuery("SELECT id,auth_user_id,role,client_id FROM public.utilisateurs WHERE statut='Actif' AND auth_user_id IS NOT NULL AND role IN ('Administrateur','Client','Client-Admin') ORDER BY id");
const records=[];
for(const actor of actors){
 if(!/^[a-f0-9-]{36}$/i.test(actor.auth_user_id))throw Error('Invalid actor identity');
 const result=await managementQuery(`BEGIN READ ONLY; SET LOCAL statement_timeout='10s';
 SELECT set_config('request.jwt.claim.sub','${actor.auth_user_id}',true);
 SELECT set_config('request.jwt.claims','${JSON.stringify({sub:actor.auth_user_id,role:'authenticated'})}',true);
 SET LOCAL ROLE authenticated;
 SELECT jsonb_build_object(
 'supports',(SELECT count(*) FROM public.infrastructures),
 'support_clients',(SELECT coalesce(jsonb_agg(DISTINCT client_id),'[]') FROM public.infrastructures),
 'history',(SELECT count(*) FROM public.historique_des_campagnes),
 'history_clients',(SELECT coalesce(jsonb_agg(DISTINCT client_id),'[]') FROM public.historique_des_campagnes),
 'visual_clients',(SELECT coalesce(jsonb_agg(DISTINCT client_id),'[]') FROM public.campagne_visuels_formats),
 'campaign_clients',(SELECT coalesce(jsonb_agg(DISTINCT client_id),'[]') FROM public.campagnes_maitres)) data;
 ROLLBACK;`);
 const data=result.find(r=>r.data)?.data;assert(data);
 if(actor.role!=='Administrateur')for(const field of ['support_clients','history_clients','visual_clients','campaign_clients'])assert(data[field].every(id=>id===actor.client_id),`${actor.role}: ${field}`);
 records.push({profile:actor.id,role:actor.role,client:actor.client_id,result:'PASS',supports:data.supports,history:data.history});
}
assert(records.some(r=>r.role==='Client-Admin'&&r.client===2));assert(records.some(r=>r.client===1&&r.role!=='Administrateur'));
fs.writeFileSync('docs/site-support-installations/remote-roles.json',JSON.stringify({at:new Date().toISOString(),readOnly:true,records},null,2));
console.log('PASS: read-only production RLS checks for '+records.length+' profiles, including EXO and Client B');
