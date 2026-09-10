import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const commands=['verify_certification_client_forms','verify_certification_main','verify_certification_drawer','verify_certification_exports','verify_certification_gallery','verify_certification_reports','verify_certification_visual_drafts','verify_remaining_form_contracts --certification','verify_auth_form_contracts --certification','verify_terrain_form_contracts --certification'];
const results=[];
for(const command of commands){const [suite,...args]=command.split(' ');const start=Date.now();const r=spawnSync(process.execPath,[`scripts/${suite}.mjs`,...args],{encoding:'utf8',windowsHide:true,timeout:240000});results.push({command,exitCode:r.status??1,durationMs:Date.now()-start,output:(r.stdout||'')+(r.stderr||'')});console.log(`${r.status===0?'PASS':'FAIL'} ${command}`);if(r.status!==0)console.log(results.at(-1).output)}
fs.writeFileSync('docs/stabilization-local/certification/new-regression.json',JSON.stringify({date:new Date().toISOString(),results},null,2));if(results.some(r=>r.exitCode))process.exitCode=1;
