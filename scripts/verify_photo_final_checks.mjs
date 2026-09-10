import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const root='docs/stabilization-local/certification/remote/photo-private/';
for(const command of ['check','build']){
 const start=Date.now();const r=spawnSync('cmd.exe',['/d','/s','/c','npm run '+command],{encoding:'utf8',windowsHide:true,timeout:600000});
 const row={command:'npm run '+command,date:new Date().toISOString(),durationMs:Date.now()-start,exitCode:r.status??1,output:(r.stdout||'')+(r.stderr||'')};
 fs.writeFileSync(root+command+'.json',JSON.stringify(row,null,2));console.log((row.exitCode?'FAIL ':'PASS ')+row.command);if(row.exitCode){console.log(row.output.slice(-5000));process.exitCode=1;break;}
}
