import assert from 'node:assert/strict';
import fs from 'node:fs';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
const records=[];
const tabs=[['Général','text'],['Affichage','radio'],['Validation','radio'],['Permissions','select'],['Mobile / Terrain','select'],['Import / Export','select'],['Relations et calculs','relation']];
await offlineBrowser('scripts/fixtures/certification-drawer-entry.jsx',async({evaluate,waitFor,sleep,exceptions,consoleErrors})=>{
 const click=async(label,selector='button')=>{await evaluate(`[...document.querySelectorAll(${JSON.stringify(selector)})].find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`);await sleep(40)};
 for(const [tab,kind]of tabs){
  await evaluate('mount()');await sleep(80);await click(tab);if(kind==='relation')await click('Calculs');
  const change=async()=>{await evaluate(`(()=>{${kind==='radio'?"document.querySelectorAll('.field-display-choice input')[1].click()":`const n=${kind==='text'?"document.querySelector('form input:not([readonly]):not([type=number])')":kind==='relation'?"[...document.querySelectorAll('fieldset select')].at(-1)":"document.querySelector('form select')"};Object.getOwnPropertyDescriptor(n.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(n,${kind==='text'?"'Draft kept'":kind==='relation'?"'preserve'":"n.options[1].value"});n.dispatchEvent(new Event(n.tagName==='SELECT'?'change':'input',{bubbles:true}))`}})()`);await sleep(40)};
  await change();await evaluate("window.confirm=()=>false;document.querySelector('.field-catalog-close').click()");await sleep(50);
  const hasDialog=await evaluate("Boolean(document.querySelector('.field-display-dialog'))");
  if(hasDialog){assert.equal(await evaluate("document.querySelector('.field-catalog-drawer > section').hasAttribute('inert')"),true,'background inert');await click('Continuer l’édition');}
  assert.equal(await evaluate('drawerFixture.closed'),0,'cancel closing keeps draft');
  await evaluate("window.confirm=()=>true;document.querySelector('.field-catalog-close').click()");await sleep(40);
  if(hasDialog)await click('Abandonner les changements');
  assert.equal(await evaluate('drawerFixture.closed'),1);assert.equal(await evaluate('drawerFixture.calls.length'),0,'discard makes no mutation');
  await click('Open');await click(tab);if(kind==='relation')await click('Calculs');await change();
  if(hasDialog){
   await evaluate("drawerFixture.fail=true;document.querySelector('.field-catalog-close').click()");await click('Enregistrer le brouillon','.field-display-dialog button');
   await waitFor("document.body.textContent.includes('DRAWER_FIXTURE_ERROR')");assert.equal(await evaluate('drawerFixture.closed'),1,'error does not close parent');assert.equal(await evaluate("Boolean(document.querySelector('.field-display-dialog'))"),true);
   await evaluate("drawerFixture.fail=false;window.before=drawerFixture.calls.length;const b=[...document.querySelectorAll('.field-display-dialog button')].at(-1);b.click();b.click()");await waitFor('drawerFixture.closed===2');assert.equal(await evaluate('drawerFixture.calls.length-before'),1,'single save through dialog');
  }else{await evaluate("document.querySelector('form button[type=submit]').click()");await waitFor('drawerFixture.saved===1');await evaluate("document.querySelector('.field-catalog-close').click()");await sleep(40);assert.equal(await evaluate('drawerFixture.closed'),2)}
  records.push({tab,role:'Administrateur',result:'PASS_LOCAL',tests:'open|dirty|cancel closing|discard|close|reopen|save|error keeps parent/retry where save dialog exists|single mutation',saveDialog:hasDialog});console.log('PASS drawer '+tab);
 }
 fs.writeFileSync('docs/stabilization-local/certification/drawer-results.json',JSON.stringify({records,exceptions,consoleErrors},null,2));assert.deepEqual(exceptions,[]);assert.deepEqual(consoleErrors,[]);
},{realServices:['fieldCatalogValidationService.js','fieldCatalogDisplayValidationService.js']});
