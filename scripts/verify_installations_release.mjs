import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const dir='docs/site-support-installations';fs.mkdirSync(dir,{recursive:true});
const commands=[['check','cmd.exe',['/d','/c','npm.cmd run check']],
 ...['verify_site_support_installations_browser','verify_reference_recognition_browser','verify_photo_import_recognition',
 'verify_photo_review_queue','verify_mass_photo_import_v121','verify_grid_headers_sorting_assignments_v124',
 'verify_review_edt_mission','verify_terrain_visual_driven_local','verify_terrain_optional_context_local',
 'verify_business_parity_browser','verify_campaign_visual_actions_v129'].map(name=>[name,process.execPath,[`scripts/${name}.mjs`]]),
 ['diff','git',['diff','--check']]];
const requested=process.argv.slice(2);
if(requested.includes('build'))commands.unshift(['build','cmd.exe',['/d','/c','npm.cmd run build']]);
const records=requested.length&&fs.existsSync(`${dir}/checks.json`)?JSON.parse(fs.readFileSync(`${dir}/checks.json`,'utf8')):[];
for(const [name,command,args] of commands){
 if(requested.length&&!requested.includes(name))continue;
 const result=spawnSync(command,args,{encoding:'utf8',windowsHide:true,maxBuffer:30*1024*1024,timeout:300000});
 fs.writeFileSync(`${dir}/${name}.log`,(result.stdout||'')+(result.stderr||'')+(result.error?.message||''));
 const previous=records.findIndex(r=>r.name===name);if(previous>=0)records.splice(previous,1);
 records.push({name,exitCode:result.status,result:result.status===0?'PASS':'FAIL'});
 fs.writeFileSync(`${dir}/checks.json`,JSON.stringify(records,null,2));console.log(name+': '+records.at(-1).result);
}
if(records.some(r=>r.result!=='PASS'))process.exitCode=1;
