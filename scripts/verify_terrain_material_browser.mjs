import fs from 'node:fs';
import assert from 'node:assert/strict';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
const records=[];
await offlineBrowser('scripts/fixtures/terrain-material-entry.jsx',async b=>{
 const {evaluate,waitFor,sleep}=b;
 const prepare=async()=>{
  await evaluate('mount()');await waitFor('Boolean(document.querySelector(".terrain-inline input"))');
  await evaluate('change(".terrain-inline input","TEST-SUPPORT")');await waitFor('Boolean(document.querySelector(".terrain-suggestions button"))');
  await evaluate('document.querySelector(".terrain-suggestions button").click()');await waitFor('document.querySelectorAll("form select").length===3');
  await evaluate('change("form select:nth-of-type(1)","installation")');
  await evaluate('change("form label:has(select) select", "installation")');
  await evaluate('window.edtSelect=[...document.querySelectorAll("form select")].find(s=>[...s.options].some(o=>o.value==="7"));Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value").set.call(edtSelect,"7");edtSelect.dispatchEvent(new Event("change",{bubbles:true}))');
  await sleep(30);
  await evaluate('window.visualSelect=[...document.querySelectorAll("form select")].find(s=>[...s.options].some(o=>o.value==="11"));visualSelect.id="test-visual";change("#test-visual","11");attach();change("textarea","Commentaire conservé")');
  await waitFor('fixture.calls.some(c=>c.name==="resolve_repertoire_affiche")');await sleep(50);
 };
 for(const status of ['not_found','ambiguous']){
  await prepare();await evaluate(`fixture.status=${JSON.stringify(status)};document.querySelector('button[type=submit]').click()`);
  await waitFor(`document.body.textContent.includes(${JSON.stringify(status==='not_found'?'Aucun article correspondant':'Plusieurs articles correspondent')})`);
  assert.equal(await evaluate('fixture.calls.filter(c=>c.name==="uploadTerrainPhoto").length'),0,'Resolve before upload');
  assert.equal(await evaluate('document.querySelector("input[type=file]").files.length'),1);assert.equal(await evaluate('document.querySelector("textarea").value'),'Commentaire conservé');
  await evaluate('fixture.status="resolved";document.querySelector("button[type=submit]").click()');await waitFor('document.body.textContent.includes("Installation confirmée")');
  assert.equal(await evaluate('fixture.calls.find(c=>c.name==="finalizeTerrainInstallation").args[0].repertoireAfficheId'),51);
  records.push({case:status+' preserves draft and can be retried',result:'PASS'});
 }
 await prepare();await evaluate('fixture.fail=true;document.querySelector("button[type=submit]").click()');await waitFor('document.body.textContent.includes("connexion au serveur est interrompue")');
 assert.equal(await evaluate('fixture.calls.filter(c=>c.name==="rollbackUploadedPhoto").length'),0,'Uncertain committed upload is not deleted');
 await evaluate('fixture.fail=false;document.querySelector("button[type=submit]").click();document.querySelector("button[type=submit]").click()');await waitFor('document.body.textContent.includes("Installation confirmée")');
 assert.equal(await evaluate('fixture.calls.filter(c=>c.name==="uploadTerrainPhoto").length'),1);
 const saves=await evaluate('fixture.calls.filter(c=>c.name==="finalizeTerrainInstallation").map(c=>c.args[0])');assert.equal(saves.length,2);assert.equal(saves[0].storagePath,saves[1].storagePath);assert.equal(saves[1].repertoireAfficheId,51);
 records.push({case:'network retry reuses upload and idempotency input; double-click guarded',result:'PASS'});
 assert.deepEqual(b.exceptions,[]);
},{realServices:['repertoireAfficheService.js'],supabaseSource:'export const supabaseConfigured=true;export const supabase={rpc:(name,args)=>window.materialRpc(name,args)};'});
fs.mkdirSync('.cache/terrain-material',{recursive:true});fs.writeFileSync('.cache/terrain-material/browser-local.json',JSON.stringify({records},null,2));
console.log('PASS: automatic article selection, no-match/ambiguity preserve photo and comment, retry and double click');
