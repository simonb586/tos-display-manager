import assert from 'node:assert/strict';
import fs from 'node:fs';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
await offlineBrowser('scripts/fixtures/refresh-entry.jsx',async({evaluate,sleep,exceptions})=>{
 await evaluate(`(()=>{const api=window.testApi;window.testApi=(file,name,args)=>name==='listClientAccessOverview'?api(file,name,args).then(rows=>[...rows,{...rows[0],client_id:9,nom_client:'Client B'}]):name==='getClientAccessDetail'?new Promise(resolve=>setTimeout(()=>resolve({members:[{id:args[0],nom:'MEMBER_CLIENT_'+args[0],role:'Client'}],invitations:[],campaigns:[]}),args[0]===2?250:20)):api(file,name,args)})()`);
 await evaluate("mount('ClientsAccessAdmin')");await sleep(100);
 await evaluate("[...document.querySelectorAll('tbody tr')].find(r=>r.textContent.includes('EXO')).querySelector('td:last-child button').click()");await sleep(15);
 await evaluate("[...document.querySelectorAll('tbody tr')].find(r=>r.textContent.includes('Client B')).querySelector('td:last-child button').click()");await sleep(350);
 assert.equal(await evaluate("document.querySelector('.ca-dialog').textContent.includes('MEMBER_CLIENT_9')&&!document.querySelector('.ca-dialog').textContent.includes('MEMBER_CLIENT_2')"),true,'old client detail must not replace selected client');
 assert.deepEqual(exceptions,[]);fs.writeFileSync('docs/stabilization-local/followup/client-detail-race-results.json',JSON.stringify({cases:['Client A slow / Client B fast: B members only'],result:'PASS_LOCAL_BROWSER',exceptions},null,2));
});
console.log('PASS Client detail response isolation');
