import assert from 'node:assert/strict';
import {build} from 'vite';
import {spawnSync} from 'node:child_process';
import {targetedAccess} from './targeted_remote_access.mjs';
const access=await targetedAccess(),client=access.userClient();
const key=client.supabaseKey;
assert.equal(JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role,'anon','Only a public key may enter the build');
process.env.VITE_SUPABASE_URL=client.supabaseUrl;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY=key;
delete process.env.VITE_SUPABASE_ANON_KEY;
if(process.argv.includes('--vercel')){
 const result=spawnSync(process.platform==='win32'?'cmd.exe':'npx',process.platform==='win32'?['/d','/c','npx.cmd --no-install vercel build --prod --yes']:['--no-install','vercel','build','--prod','--yes'],{env:process.env,stdio:'inherit',windowsHide:true});
 assert.equal(result.status,0,'Vercel production build failed');
}else if(process.argv.includes('--check')){
 const result=spawnSync(process.platform==='win32'?'cmd.exe':'npm',process.platform==='win32'?['/d','/c','npm.cmd run check']:['run','check'],{env:process.env,stdio:'inherit',windowsHide:true});
 assert.equal(result.status,0,'Release check failed');
}else await build();
console.log('PASS: release build with validated public Supabase configuration');
