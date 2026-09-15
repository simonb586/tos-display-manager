import assert from 'node:assert/strict';
import fs from 'node:fs';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
const records=[];
await offlineBrowser('scripts/fixtures/targeted-improvements-entry.jsx',async b=>{
 const click=text=>b.evaluate(`[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(text)}).click()`);
 for(const role of ['Client','Client-Admin','Administrateur']){
  await b.evaluate(`mount('photos',${JSON.stringify(role)})`);await b.waitFor("document.querySelectorAll('[aria-label^=\"Ouvrir \"]').length===4");
  for(const label of ['EDT-TOS-73-F','Inspections','Supports avec enjeux','Installation sans EDT']){
   await b.evaluate(`document.querySelector('[aria-label="Ouvrir ${label}"]').click()`);await b.waitFor("!!document.querySelector('.photo-review-body')");
   assert.equal(await b.evaluate("document.querySelectorAll('.photo-review-body').length"),1);
   assert.equal(await b.evaluate("!!document.querySelector('.photo-review-actions')"),role==='Administrateur');
   await b.evaluate("document.querySelector('.photo-review-image').click()");await b.waitFor("!!document.querySelector('[role=dialog]')");await click('Zoom +');await click('Fermer');await click('Tous les dossiers');
  }
  await b.evaluate("setInput('input[type=search]','NO-MATCH-TARGETED')");await b.sleep(80);assert.equal(await b.evaluate("document.querySelectorAll('.photo-review-body').length"),0);
  await b.evaluate("setInput('input[type=search]','')");await b.sleep(80);
  await click('Inventaire');await b.sleep(50);assert.equal(await b.evaluate("document.body.textContent.includes('Nouveau mouvement')"),role==='Administrateur');
  records.push({role,folders:'PASS',readOnly:role==='Administrateur'?'internal management preserved':'PASS',zoom:'PASS'});
 }
 await b.evaluate("mount('visual','Administrateur')");await b.waitFor("!!document.querySelector('.visual-managed-actions')");await click('Modifier');await b.sleep(80);
 await click('+ Ajouter un EDT');await b.sleep(50);
 await b.evaluate("setInput('fieldset > div:nth-of-type(2) select','116')");await b.sleep(50);
 await b.evaluate("setInput('fieldset > div:nth-of-type(1) input[type=date]','2026-01-01')");await b.sleep(50);
 await b.evaluate("setInput('fieldset > div:nth-of-type(2) input[type=date]','2026-02-01')");await b.sleep(50);
 await click('Enregistrer les modifications');await b.waitFor("fixture.calls.some(c=>c.name==='saveCampaignVisual')");
 const links=await b.evaluate("fixture.calls.find(c=>c.name==='saveCampaignVisual').args[0].edt_associations");assert.equal(links.length,2);assert.equal(links[1].phase_id,'116');assert.notEqual(links[0].date_debut,links[1].date_debut);records.push({visualMultiEdt:'PASS',dates:'PASS'});
 for(const mode of ['enjeu','normal','without']){
  await b.evaluate("mount('terrain')");await b.waitFor("!!document.querySelector('.terrain-inline input')");
  await b.evaluate("setInput('.terrain-inline input','SUP-EXO')");await b.sleep(70);
  await b.evaluate("[...document.querySelectorAll('button')].find(x=>x.textContent.includes('SUP-EXO')).click()");await b.sleep(100);
  if(mode==='enjeu'){
   await b.evaluate("[...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='enjeu')).setAttribute('data-action-select','')");await b.evaluate("setInput('[data-action-select]','enjeu')");await b.sleep(60);
   assert.equal(await b.evaluate("document.body.textContent.includes('Contexte EDT / phase')"),false);
   await b.evaluate("setInput('input[placeholder^=\"Ex.\"]','Vitre brisée')");
  }else{
   assert.equal(await b.evaluate("document.querySelector('input[type=checkbox]').checked"),false);
   if(mode==='without'){await b.evaluate("document.querySelector('input[type=checkbox]').click()");await b.sleep(50);}
   else{await b.evaluate("[...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='114')).setAttribute('data-edt','')");await b.evaluate("setInput('[data-edt]','114')");await b.sleep(50);}
   await b.evaluate("[...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='35')).setAttribute('data-visual','')");await b.evaluate("setInput('[data-visual]','35')");
  }
  await b.evaluate('choosePhoto()');await b.sleep(60);await b.evaluate("document.querySelector('button[type=submit]').click()");await b.waitFor("fixture.calls.some(c=>c.name.startsWith('finalizeTerrain'))");
  const call=await b.evaluate("fixture.calls.find(c=>c.name.startsWith('finalizeTerrain')).args[0]");
  if(mode==='enjeu')assert.equal(call.phaseId,null);else{assert.equal(call.withoutEdt,mode==='without');assert.equal(call.phaseId,mode==='without'?null:'114');}
  records.push({terrain:mode,result:'PASS'});
 }
 assert.deepEqual(b.exceptions,[]);assert.deepEqual(b.consoleErrors,[]);
});
fs.writeFileSync('docs/targeted-improvements/browser-tests.json',JSON.stringify(records,null,2));console.log('Targeted browser tests PASS');
