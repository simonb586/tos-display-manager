import assert from 'node:assert/strict';
import fs from 'node:fs';
import JSZip from 'jszip';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
const records=[];
await offlineBrowser('scripts/fixtures/certification-exports-entry.jsx',async({evaluate,waitFor,sleep,exceptions,consoleErrors})=>{
 for(const [role,client]of [['Administrateur',2],['Coordonnateur',2],['Client',2],['Client-Admin',2],['Client',9],['Admin Preview',2]])for(const [format,label]of [['csv','CSV complet'],['xlsx','Excel complet'],['pdf','PDF complet'],['zip','Télécharger le ZIP autorisé']]){try{
  await evaluate(`mount('exports','${role}',${client})`);await sleep(70);
  const button=`[...document.querySelectorAll('button')].find(b=>b.textContent.includes(${JSON.stringify(label)}))`;
  await evaluate(`exportFixture.fail=true;${button}.click()`);await waitFor("document.body.textContent.includes('EXPORT_FIXTURE_ERROR')");assert.equal(await evaluate('exportFixture.files.length'),0,'error creates no artifact');
  await evaluate(`exportFixture.fail=false;window.before=exportFixture.calls.length;const b=${button};b.click();b.click()`);
  await waitFor("exportFixture.files.length>0&&document.body.textContent.includes('exportée')");
  assert.equal(await evaluate("exportFixture.calls.slice(before).filter(c=>c.name==='loadRows').length"),1,'one export for double click');
  await evaluate("window.bytes=null;void exportFixture.files.at(-1).arrayBuffer().then(buffer=>{window.bytes=btoa(String.fromCharCode(...new Uint8Array(buffer)))})");await waitFor('bytes!==null');
  const data=Buffer.from(await evaluate('bytes'),'base64');assert.ok(data.length>0);
  if(format==='zip'){const zip=await JSZip.loadAsync(data);assert.ok(Object.keys(zip.files).some(p=>p.includes('SUP-'+client)));assert.ok(!Object.keys(zip.files).some(p=>p.includes('SUP-'+(client===2?9:2))))}
  if(format==='csv'){assert.ok(data.toString().includes('SUP-'+client));assert.ok(!data.toString().includes('storage_path'))}
  if(format==='pdf')assert.ok(data.subarray(0,4).toString()==='%PDF');
  records.push({role,client,format,result:'PASS_LOCAL',tests:'error|retry|one artifact for double action|artifact bytes|scope from authorized parent'});console.log('PASS export '+role+' '+client+' '+format);
 }catch(error){records.push({role,client,format,result:'FAIL',error:error.message});console.error('FAIL export '+role+' '+format+' '+error.message)}}
 fs.writeFileSync('docs/stabilization-local/certification/exports-results.json',JSON.stringify({records,exceptions,consoleErrors},null,2));assert.deepEqual(exceptions,[]);assert.deepEqual(consoleErrors,[]);assert.equal(records.filter(r=>r.result==='FAIL').length,0);
});
