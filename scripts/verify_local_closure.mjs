import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const suites=['verify_stabilization_browser','verify_refresh_contracts','verify_refresh_lifecycle','verify_historical_ui_contracts','verify_user_form_contracts','verify_form_closure','verify_auth_form_contracts','verify_field_form_contracts','verify_remaining_form_contracts','verify_terrain_form_contracts','verify_row_mutation_contracts','verify_client_transfer_contracts','verify_client_detail_race','verify_portal_view_renderability','verify_export_artifacts','verify_admin_view_registry','verify_business_column_contracts'];
const results=[];
for(const suite of suites){
 const start=Date.now();const result=spawnSync(process.execPath,[`scripts/${suite}.mjs`],{encoding:'utf8',windowsHide:true,timeout:240000});
 const row={suite,exitCode:result.status??1,durationMs:Date.now()-start,output:(result.stdout||'')+(result.stderr||'')};results.push(row);
 console.log(`${row.exitCode?'FAIL':'PASS'} ${suite}`);if(row.exitCode)console.log(row.output.slice(-6000));
}
fs.writeFileSync('docs/stabilization-local/followup/local-closure-regression.json',JSON.stringify({date:new Date().toISOString(),results},null,2));
if(results.some(row=>row.exitCode))process.exitCode=1;
