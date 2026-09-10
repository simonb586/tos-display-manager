import assert from 'node:assert/strict';
import fs from 'node:fs';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
const cases=[];
await offlineBrowser('scripts/fixtures/refresh-entry.jsx',async({evaluate,waitFor,sleep,exceptions})=>{
 await evaluate(`(()=>{const api=window.testApi;window.testApi=(file,name,args)=>name==='listClientAccessOverview'?api(file,name,args).then(rows=>[...rows,{...rows[0],id:9,client_id:9,nom_client:'Client B'}]):api(file,name,args)})()`);
 await evaluate("mount('ClientsAccessAdmin')");await sleep(120);await evaluate("[...document.querySelectorAll('tbody tr')].find(r=>r.textContent.includes('EXO')).querySelector('td:last-child button').click()");await waitFor("Boolean(document.querySelector('.ca-dialog article select'))");
 assert.deepEqual(await evaluate("[...document.querySelector('.ca-dialog article select').options].map(o=>o.value)"),['','9'],'source client excluded from transfer');cases.push('transfer offers another client, excludes current client');
 await evaluate("window.transfer=()=>{const n=document.querySelector('.ca-dialog article select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(n,'9');n.dispatchEvent(new Event('change',{bubbles:true}))};window.confirm=()=>false;transfer()");assert.equal(await evaluate("fixture.calls.filter(c=>c.name==='transferUserClient').length"),0);cases.push('cancel transfer performs no mutation');
 await evaluate('window.confirm=()=>true;fixture.delay=80;fixture.fail=true;transfer()');await waitFor("document.body.textContent.includes('REFRESH_FIXTURE_ERROR')");assert.equal(await evaluate("Boolean(document.querySelector('.ca-dialog article'))"),true);cases.push('transfer error preserves access modal');
 await evaluate("fixture.fail=false;window.before=fixture.calls.filter(c=>c.name==='transferUserClient').length;transfer();transfer()");await sleep(300);
 assert.equal(await evaluate("fixture.calls.filter(c=>c.name==='transferUserClient').length-before"),1);assert.deepEqual(await evaluate("fixture.calls.filter(c=>c.name==='transferUserClient').at(-1).args[0]"),{userId:1,clientId:9,role:'Client'});cases.push('retry double transfer sends one mutation with user and destination IDs');
 assert.deepEqual(exceptions,[]);fs.writeFileSync('docs/stabilization-local/followup/client-transfer-results.json',JSON.stringify({cases,result:'PASS_LOCAL_BROWSER',exceptions},null,2));
});
console.log('PASS four Client transfer contracts');
