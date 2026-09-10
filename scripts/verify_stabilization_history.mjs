// Re-run the same historical suite set without invoking npm lifecycle hooks.
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const baseline=JSON.parse(fs.readFileSync('docs/stabilization-local/existing-tests.json','utf8'));
const {scripts}=JSON.parse(fs.readFileSync('package.json','utf8'));
const results=[];
for(const {name} of baseline){
 const commands=scripts[name].split(' && ');
 if(commands.some(command=>!/^node \.\/scripts\/[\w.-]+\.mjs$/.test(command)))throw Error('Unexpected command: '+name);
 let output='',exitCode=0;
 for(const command of commands){
  const result=spawnSync(process.execPath,[command.slice(5)],{encoding:'utf8',windowsHide:true,timeout:120000});
  output+=(result.stdout||'')+(result.stderr||'');
  exitCode=result.status??1;
  if(exitCode)break;
 }
 results.push({name,exitCode,output});
 console.log(`${exitCode?'FAIL':'PASS'} ${name}`);
}
fs.writeFileSync('docs/stabilization-local/followup/existing-tests.json',JSON.stringify(results,null,2));
console.log(JSON.stringify({total:results.length,pass:results.filter(r=>r.exitCode===0).length,fail:results.filter(r=>r.exitCode!==0).length}));
if(results.some(r=>r.exitCode))process.exitCode=1;
