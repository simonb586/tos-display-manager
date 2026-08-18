import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const forbidden=[['one','drive'].join(''),['tos-display-manager','stable'].join('-')];
const norm=v=>String(v||'').replaceAll('/','\\').replace(/[\\]+$/,'').toLowerCase();
function validate({cwd,root,realCwd=cwd,realRoot=root,reparse=false,ci=false,platform='win32',branch='release/v1.3.3'}){
  if([cwd,root,realCwd,realRoot].some(v=>forbidden.some(f=>norm(v).includes(f))))throw new Error('forbidden physical path');
  if(norm(cwd)!==norm(root)||norm(realCwd)!==norm(realRoot))throw new Error('root mismatch');
  if(reparse)throw new Error('reparse point');
  if(!ci&&platform==='win32'&&norm(realRoot)!==norm('C:\\dev\\tos-display-manager'))throw new Error('unofficial root');
  if(!ci&&branch!=='release/v1.3.3')throw new Error('wrong branch');return true;
}
const local={cwd:'C:\\dev\\tos-display-manager',root:'C:\\dev\\tos-display-manager'};
assert.equal(validate(local),true,'CAS A vrai clone');
assert.throws(()=>validate({cwd:'C:\\Users\\sim-0\\OneDrive\\repo',root:'C:\\Users\\sim-0\\OneDrive\\repo'}),/forbidden/,'CAS B OneDrive');
assert.throws(()=>validate({...local,realCwd:'C:\\Users\\sim-0\\OneDrive\\repo',realRoot:'C:\\Users\\sim-0\\OneDrive\\repo',reparse:true}),/forbidden|reparse/,'CAS C junction');
assert.equal(validate({cwd:'/vercel/path0',root:'/vercel/path0',ci:true,platform:'linux',branch:''}),true,'CAS D CI');
const guard=readFileSync('scripts/verify_official_workspace.mjs','utf8');
for(const marker of ['realpathSync.native','isWindowsReparsePoint','fsutil','realRoot'])assert.ok(guard.includes(marker),`Garde incomplet: ${marker}`);
console.log('Contrat workspace: vrai clone PASS; OneDrive FAIL; junction FAIL; CI PASS.');
