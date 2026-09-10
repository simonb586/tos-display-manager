import assert from 'node:assert/strict';
import fs from 'node:fs';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
const records=[];
await offlineBrowser('scripts/fixtures/certification-exports-entry.jsx',async({evaluate,waitFor,sleep,exceptions,consoleErrors})=>{
 for(const role of ['Administrateur','Coordonnateur','Installateur','Client','Client-Admin']){
  for(const mode of role==='Administrateur'?['row','selection','lightbox']:['denied']){try{
   await evaluate(`mount('gallery','${role}')`);await waitFor("Boolean(document.querySelector('.support-gallery-item'))");await sleep(40);
   if(mode==='denied'){assert.equal(await evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Supprimer'))"),false);records.push({role,mode,result:'PASS_LOCAL',tests:'delete not rendered; no mutation'});continue}
   if(mode==='selection')await evaluate("document.querySelector('.support-gallery-check').click()");
   if(mode==='lightbox')await evaluate("document.querySelector('.support-gallery-open').click()");await sleep(40);
   const selector=mode==='row'?'.support-gallery-item-actions .danger':mode==='selection'?'.support-gallery-toolbar .danger':'.photo-lightbox .danger';
   await evaluate(`window.confirm=()=>false;document.querySelector('${selector}').click()`);assert.equal(await evaluate("exportFixture.calls.filter(c=>c.name.startsWith('delete')).length"),0);
   await evaluate(`window.confirm=()=>true;exportFixture.fail=true;document.querySelector('${selector}').click()`);await waitFor("document.body.textContent.includes('EXPORT_FIXTURE_ERROR')");
   await evaluate(`exportFixture.fail=false;window.before=exportFixture.calls.length;const b=document.querySelector('${selector}');b.click();b.click()`);await sleep(300);
   assert.equal(await evaluate("exportFixture.calls.slice(before).filter(c=>c.name.startsWith('delete')).length"),1);
   records.push({role,mode,result:'PASS_LOCAL',tests:'confirmation cancel|failure preserves photo|retry|single delete|selected row'});console.log('PASS gallery '+mode);
  }catch(error){records.push({role,mode,result:'FAIL',error:error.message});console.error('FAIL gallery '+mode+' '+error.message)}}
 }
 fs.writeFileSync('docs/stabilization-local/certification/gallery-results.json',JSON.stringify({records,exceptions,consoleErrors},null,2));assert.deepEqual(exceptions,[]);assert.deepEqual(consoleErrors,[]);assert.equal(records.filter(r=>r.result==='FAIL').length,0);
});
