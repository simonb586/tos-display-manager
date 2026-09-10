import assert from 'node:assert/strict';
import fs from 'node:fs';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
const records=[];
const descriptors=[['General','input:not([readonly]):not([type=number])','text'],['Display','.field-display-choice input','radio'],['Validation','.field-display-choice input','radio'],['Permission','select','select'],['Terrain','select','select'],['ImportExport','select','select'],['Relations','select','relation']];
await offlineBrowser('scripts/fixtures/field-form-entry.jsx',async({evaluate,waitFor,sleep,exceptions,consoleErrors})=>{
 for(const [name,selector,kind]of descriptors){try{
  await evaluate(`mount('${name}')`);await sleep(80);await waitFor("Boolean(document.querySelector('form'))");
  if(kind==='relation'){await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Calculs').click()");await sleep(30)}
  const change=async()=>{await evaluate(`(()=>{const n=${kind==='radio'?`document.querySelectorAll('${selector}')[1]`:kind==='relation'?"[...document.querySelectorAll('fieldset select')].at(-1)":`document.querySelector('${selector}')`};${kind==='radio'?'n.click()':`const proto=n.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(n,${kind==='text'?"'Edited label'":kind==='relation'?"'preserve'":"n.options[1].value"});n.dispatchEvent(new Event(n.tagName==='SELECT'?'change':'input',{bubbles:true}))`}})()`);await sleep(40)};
  await change();assert.equal(await evaluate("document.querySelector('button[type=submit]').disabled"),false,'dirty draft can save');
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Annuler')).click()");await sleep(50);assert.equal(await evaluate('fieldFixture.calls.length'),0,'cancel is local');
  await change();await evaluate("fieldFixture.fail=true;document.querySelector('button[type=submit]').click()");await waitFor("document.body.textContent.includes('FIELD_FIXTURE_ERROR')");
  assert.equal(await evaluate("document.querySelector('button[type=submit]').disabled"),false,'error leaves draft retryable');
  await evaluate("fieldFixture.fail=false;window.beforeFieldSave=fieldFixture.calls.length;const b=document.querySelector('button[type=submit]');b.click();b.click()");await sleep(250);
  assert.equal(await evaluate('fieldFixture.calls.length-beforeFieldSave'),1,'one write for double submit');assert.equal(await evaluate('fieldFixture.saved'),1,'one onSaved callback');
  assert.equal(await evaluate("fieldFixture.calls.at(-1).args[0].field.fieldId"),'infrastructures.notes','correct field ID');
  records.push({FORM_ID:'FieldCatalog'+name,ROLE:'Administrateur',MODE:'EDIT declarative draft',TESTS:'open|initial|dirty|cancel|edit again|error|retry|double submit|callback|field ID',RESULT:'PASS_LOCAL_BROWSER'});console.log('PASS field '+name);
 }catch(error){records.push({FORM_ID:'FieldCatalog'+name,RESULT:'FAIL',ERROR:error.stack});console.error('FAIL field '+name+' '+error.message)}}
 fs.writeFileSync('docs/stabilization-local/followup/field-form-results.json',JSON.stringify({records,exceptions,consoleErrors},null,2));assert.deepEqual(exceptions,[]);assert.deepEqual(consoleErrors,[]);assert.equal(records.filter(r=>r.RESULT==='FAIL').length,0);
},{realServices:['fieldCatalogValidationService.js','fieldCatalogDisplayValidationService.js']});
