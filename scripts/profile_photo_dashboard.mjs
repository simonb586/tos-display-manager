import fs from 'node:fs';
import {managementQuery} from './targeted_management_access.mjs';
let [{definition}]=await managementQuery("SELECT pg_get_functiondef('public.portal_dashboard_summary()'::regprocedure) definition");
definition=definition.replaceAll('v_kpis:=v_kpis||v_part;',`v_kpis:=v_kpis||v_part;PERFORM set_config('tdm.dashboard_profile',(coalesce(nullif(current_setting('tdm.dashboard_profile',true),''),'[]')::jsonb||jsonb_build_object('section',v_part,'ms',extract(epoch from clock_timestamp()-v_started)*1000))::text,true);v_started:=clock_timestamp();`);
const results=[];
for(const jit of ['on','off']){
 const rows=await managementQuery(`BEGIN;${definition};SELECT set_config('request.jwt.claim.sub',(SELECT auth_user_id::text FROM public.utilisateurs WHERE id=25),true);SET LOCAL ROLE authenticated;SET LOCAL jit=${jit};SET LOCAL statement_timeout='20s';SELECT public.portal_dashboard_summary();RESET ROLE;SELECT current_setting('tdm.dashboard_profile')::jsonb timings;ROLLBACK;`);
 results.push({jit,...rows[0]});console.log(JSON.stringify(results.at(-1)));
}
fs.writeFileSync('docs/photo-inventory-mission/dashboard-profile.json',JSON.stringify(results,null,2));
