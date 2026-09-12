import assert from 'node:assert/strict';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
import {assignmentUpdatePayload} from '../src/lib/assignmentEditing.js';
assert.deepEqual(assignmentUpdatePayload({_assignment_table:'campagnes_supports',id:1},{visuel_attendu:'A',client_id:9,support_id:'B'}),{visuel_attendu:'A'});
await offlineBrowser('scripts/fixtures/business-parity-final-entry.jsx',async b=>{
 const click=text=>b.evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`);
 for(const role of ['Client','Client-Admin']){
  await b.evaluate(`mount(${JSON.stringify(role)},2,'assignments')`);
  await b.waitFor("document.querySelector('[data-dashboard-state]')?.dataset.dashboardState==='ready'");
  const menu=await b.evaluate("[...document.querySelectorAll('.client-body aside button')].map(b=>b.textContent.trim())");
  for(const label of ['Carte interactive','Campagnes et visuels par site et supports','Communications opérationnelles par site et supports'])assert(menu.includes(label),role+' '+label);
  for(const label of ['Campagnes et visuels par site et supports','Communications opérationnelles par site et supports']){
   await click(label);await b.waitFor("!!document.querySelector('.assignment-page tbody tr')");
   assert.equal(await b.evaluate("!!document.querySelector('.assignment-actions [aria-label=Modifier]')"),role==='Client-Admin');
   if(role==='Client-Admin'){
    await b.evaluate("document.querySelector('.assignment-actions [aria-label=Modifier]').click()");
    await b.waitFor("!!document.querySelector('[aria-label=\"Modifier l’affectation\"] form')");
    await b.evaluate("(()=>{const input=document.querySelector('[aria-label=\"Modifier l’affectation\"] input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Correction validée');input.dispatchEvent(new Event('input',{bubbles:true}));})()");await b.sleep(50);
    await b.evaluate("(()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Enregistrer');button.click();button.click()})()");
    await b.waitFor("!document.querySelector('[aria-label=\"Modifier l’affectation\"]') && document.querySelector('.assignment-page tbody')?.textContent.includes('Correction validée')");
   }
   await click('Visuel');await b.waitFor("!!document.querySelector('[aria-label=\"Détails du visuel\"]')");await click('Fermer');
  }
  if(role==='Client-Admin')assert.equal(await b.evaluate("fixture.calls.filter(c=>c.name==='updateSiteSupportAssignment').length"),2,'Double click must save once per form');
 }
 const headers=[];
 for(const role of ['Administrateur','Client','Client-Admin']){
  await b.evaluate(`mountAssignments(${JSON.stringify(role)})`);await b.waitFor(`document.querySelector('[data-fixture-role]')?.dataset.fixtureRole===${JSON.stringify(role)} && !!document.querySelector('.assignment-page tbody tr')`);
  headers.push(await b.evaluate("[...document.querySelectorAll('.data-grid-header-row th')].map(x=>x.textContent)"));
  assert.equal(await b.evaluate("!!document.querySelector('.assignment-actions [aria-label=Modifier]')"),role!=='Client');
 }
 assert.deepEqual(headers[0],headers[1]);assert.deepEqual(headers[0],headers[2]);
 assert.deepEqual(b.exceptions,[]);assert.deepEqual(b.consoleErrors,[]);
});
console.log('Assignment browser PASS: mandatory menus, shared Admin columns, Client read-only, Client-Admin edit/save/reload, double-click protection, visual details');
