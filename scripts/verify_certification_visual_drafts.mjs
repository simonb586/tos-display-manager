import assert from 'node:assert/strict';
import fs from 'node:fs';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
const records=[];
await offlineBrowser('scripts/fixtures/remaining-form-entry.jsx',async({evaluate,sleep,exceptions,consoleErrors})=>{
 for(const role of ['Administrateur','Coordonnateur'])for(const context of ['marketing','operational_communication']){
  await evaluate(`sessionStorage.clear();mount('CampaignVisualManager','${role}','${context}')`);await sleep(120);
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Créer un visuel')).click()");await sleep(40);
  await evaluate("window.change=(n,v)=>{Object.getOwnPropertyDescriptor(n.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(n,v);n.dispatchEvent(new Event(n.tagName==='SELECT'?'change':'input',{bubbles:true}))};change(document.querySelector('form input[required]'),'VISUAL DRAFT')");await sleep(40);
  await evaluate("change(document.querySelector('form select[required]'),'1')");await sleep(40);
  await evaluate(`mount('CampaignVisualManager','${role}','${context}')`);await sleep(120);assert.equal(await evaluate("document.querySelector('form input[required]').value"),'VISUAL DRAFT');assert.equal(await evaluate("document.querySelector('form select[required]').value"),'1');
  await evaluate(`mount('CampaignVisualManager','${role}','${context==='marketing'?'operational_communication':'marketing'}')`);await sleep(100);assert.equal(await evaluate("Boolean(document.querySelector('form'))"),false,'other context cannot restore this draft');
  await evaluate(`mount('CampaignVisualManager','${role}','${context}')`);await sleep(100);assert.equal(await evaluate("document.querySelector('form input[required]').value"),'VISUAL DRAFT');
  await evaluate("[...document.querySelectorAll('form button')].find(b=>b.textContent.includes('Annuler')).click()");await sleep(50);assert.equal(await evaluate(`sessionStorage.getItem('tdm-form-draft:v1:visual:${context}')`),null);
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Créer un visuel')).click()");await sleep(40);assert.equal(await evaluate("document.querySelector('form input[required]').value"),'');
  records.push({role,context,result:'PASS_LOCAL',tests:'draft restore|selected campaign restored|context isolation|cancel cleanup|reopen empty'});
 }
 fs.writeFileSync('docs/stabilization-local/certification/visual-draft-results.json',JSON.stringify({records,exceptions,consoleErrors},null,2));assert.deepEqual(exceptions,[]);assert.deepEqual(consoleErrors,[]);
});
console.log('PASS four visual draft role/context contracts');
