import assert from 'node:assert/strict';
import fs from 'node:fs';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
const records=[];
await offlineBrowser('scripts/fixtures/certification-main-entry.jsx',async({evaluate,waitFor,sleep,exceptions,consoleErrors})=>{
 for(const kind of ['grid','detail'])for(const role of ['Administrateur','Coordonnateur','Client','Client-Admin','Installateur']){try{
  await evaluate(`mount('${kind}','${role}')`);await sleep(100);
  const label=kind==='grid'?'Modifier la grille':'Modifier la fiche';
  if(role!=='Administrateur'){assert.equal(await evaluate(`[...document.querySelectorAll('button')].some(b=>b.textContent.includes('${label}')&&${kind==='grid'?"!b.closest('.grid-settings')":"b.classList.contains('grid-edit-primary')"})`),false);records.push({kind,role,result:'PASS_LOCAL',tests:'no edit capability'});continue}
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('${label}')&&${kind==='grid'?"!b.closest('.grid-settings')":"b.classList.contains('grid-edit-primary')"}).click()`);await sleep(40);
  const selector=kind==='grid'?'.grid-edit-cell input':'.detailGrid input';
  await evaluate(`window.target=[...document.querySelectorAll('${selector}')].find(n=>n.value==='Local site');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(target,'Edited site');target.dispatchEvent(new Event('input',{bubbles:true}))`);await sleep(40);
  const save="[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Enregistrer')&&b.classList.contains('grid-edit-primary'))";
  await evaluate(`window.confirm=()=>false;${save}.click()`);assert.equal(await evaluate('mainFixture.calls.length'),0);
  await evaluate(`window.confirm=()=>true;mainFixture.fail=true;${save}.click()`);await waitFor("document.body.textContent.includes('MAIN_FIXTURE_ERROR')");assert.equal(await evaluate('target.value'),'Edited site');
  await evaluate(`mainFixture.fail=false;window.before=mainFixture.calls.length;const b=${save};b.click();b.click()`);await sleep(300);assert.equal(await evaluate('mainFixture.calls.length-before'),1,'single main edit mutation');assert.equal(await evaluate('mainFixture.saved.length'),1);
  records.push({kind,role,result:'PASS_LOCAL',tests:'edit|confirm cancel|error|state retained|retry|double click|saved callback'});console.log('PASS main '+kind);
 }catch(error){records.push({kind,role,result:'FAIL',error:error.message});console.error('FAIL main '+kind+' '+role+' '+error.message)}}
 await evaluate("mount('detail','Administrateur',true)");await sleep(100);assert.equal(await evaluate("[...document.querySelectorAll('button.grid-edit-primary')].some(b=>b.textContent.includes('Modifier'))"),false);records.push({kind:'detail',role:'Administrateur',state:'readOnly config',result:'PASS_LOCAL',tests:'readOnly has no edit capability'});
 fs.writeFileSync('docs/stabilization-local/certification/main-results.json',JSON.stringify({records,exceptions,consoleErrors},null,2));assert.deepEqual(exceptions,[]);assert.deepEqual(consoleErrors,[]);assert.equal(records.filter(r=>r.result==='FAIL').length,0);
},{exposeMain:true,realServices:['roleVisibilityService.js','mapService.js']});
