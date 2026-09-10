import assert from 'node:assert/strict';
import fs from 'node:fs';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
const records=[];
await offlineBrowser('scripts/fixtures/historical-ui-entry.jsx',async({evaluate,waitFor,sleep,exceptions})=>{
 const click=async(label,selector='button')=>{await evaluate(`(()=>{const b=[...document.querySelectorAll(${JSON.stringify(selector)})].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b)throw Error('Missing button '+${JSON.stringify(label)});b.click()})()`);await sleep(70)};
 for(const role of ['Administrateur','Coordonnateur']){
  await evaluate(`mount('dashboard','marketing',${JSON.stringify(role)})`);await waitFor("document.querySelector('.m14-bars')&&document.querySelector('.executive-kpi strong').textContent!=='…'");
  assert.equal(await evaluate("document.querySelector('h1').textContent"),'Tableau de bord');
  for(const tab of ['Marketing','Communication opérationnelle','Terrain','EDT','Infrastructures','Clients','Rapports','Alertes','Tendances','Vue générale']){
   await click(tab,'.command-tabs button');
   if(tab==='Rapports')assert.deepEqual(await evaluate("[...document.querySelectorAll('.executive-kpi strong')].map(x=>x.textContent)"),['3','4','5','6']);
   const targets=await evaluate("(()=>{const b=[...document.querySelectorAll('.executive-kpi,.command-alerts button')];routes=[];b.forEach(x=>x.click());return routes})()");
   assert.ok(targets.every(x=>typeof x==='string'&&x.length));
   records.push({role,view:'Dashboard',control:tab,result:'PASS_LOCAL_BROWSER',targets});
  }
 }
 for(const [identity,role] of [['Marylene EXO','Client-Admin'],['EXO','Client'],['Client B','Client'],['Preview Marylene','Administrateur']]){
  await evaluate(`mount('client-dashboard',${JSON.stringify(identity)},${JSON.stringify(role)})`);await waitFor(`document.body.textContent.includes(${JSON.stringify(identity)})`);
  assert.equal(await evaluate('calls.length'),0,'scoped dashboard must never load Admin services');
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.executive-kpi strong')].map(x=>x.textContent)"),['7']);
  assert.equal(await evaluate("document.querySelectorAll('.executive-kpi').length"),1,'only permitted view rendered');
  await evaluate("document.querySelector('.executive-kpi').click()");assert.deepEqual(await evaluate('routes'),['infrastructures']);
  records.push({role,view:'Scoped shared dashboard',control:identity,result:'PASS_LOCAL_BROWSER',targets:['infrastructures']});
 }
 for(const context of ['marketing','operational_communication']){
  await evaluate(`mount('assignments',${JSON.stringify(context)})`);await waitFor("Boolean(document.querySelector('button[title=\"Fiche 360\"]'))");
  for(const label of ['ID historique','Contexte métier','Données source'])assert.equal(await evaluate(`document.querySelector('table').textContent.includes(${JSON.stringify(label)})`),true,'canonical assignment column '+label);
  for(const [label,target] of [['Fiche 360','Infrastructures'],['Photos','Photos et inventaire'],['Historique','Édition — Historique'],['EDT','Centre EDT et BT'],['Visuel',context==='marketing'?'Campagne — Visuels et formats':'Communication opérationnelle — Visuels']]){
   await click(label,'.assignment-actions button');assert.equal(await evaluate('routes.at(-1)'),target);
   assert.equal(await evaluate("JSON.parse(sessionStorage.getItem('tos_assignment_context')).support_id"),'EXO-2');
   records.push({role:'Administrateur',view:context,control:label,result:'PASS_LOCAL_BROWSER',target});
  }
  await evaluate("document.querySelector('input[aria-label=\"Sélectionner la page\"]').click()");await sleep(50);
  assert.equal(await evaluate("[...document.querySelectorAll('.assignment-toolbar button')].find(b=>b.textContent.trim()==='Sélection').disabled"),false);
  await click('Modifier la grille');await waitFor("Boolean(document.querySelector('.grid-edit-toolbar'))");
  const count=await evaluate("document.querySelectorAll('[data-grid-zone=header]').length");
  await evaluate("document.querySelector('.grid-edit-toolbar input[type=checkbox]').click()");await sleep(50);
  assert.equal(await evaluate("document.querySelectorAll('[data-grid-zone=header]').length"),count-1);
  await click('Réinitialiser la grille');assert.equal(await evaluate("document.querySelectorAll('[data-grid-zone=header]').length"),count);
  records.push({role:'Administrateur',view:context,control:'selection / columns / reset',result:'PASS_LOCAL_BROWSER'});
 }
 // Exercise the production stylesheet in a browser, measuring the actual row
 // and sticky action geometry instead of pinning an obsolete source literal.
 const css=fs.readFileSync('src/features/v13/automation-assistant.css','utf8');
 await evaluate(`(()=>{const style=document.createElement('style');style.textContent=${JSON.stringify(css)};document.head.append(style);document.getElementById('root').innerHTML='<div class="automation-table-wrap" style="width:600px;overflow:auto"><table class="automation-config-table automation-engine-table"><thead><tr><th>Name</th><th>Actions</th></tr></thead><tbody><tr><td>Fixture</td><td class="automation-actions-cell"><button>Tester</button></td></tr><tr><td>Second</td><td class="automation-actions-cell"><button>Tester</button></td></tr></tbody></table></div>'})()`);
 const geometry=await evaluate("(()=>{const rows=[...document.querySelectorAll('tbody tr')];const cell=document.querySelector('.automation-actions-cell');return {heights:rows.map(r=>r.getBoundingClientRect().height),position:getComputedStyle(cell).position,align:getComputedStyle(cell).verticalAlign,head:document.querySelector('th').getBoundingClientRect().height}})()");
 assert.equal(geometry.heights[0],geometry.heights[1]);assert.ok(geometry.heights[0]>=104);assert.equal(geometry.position,'sticky');assert.equal(geometry.align,'middle');assert.ok(geometry.head>=48);
 records.push({view:'Automation CSS',control:'row geometry',result:'PASS_LOCAL_BROWSER',geometry});
 assert.deepEqual(exceptions,[]);
 fs.writeFileSync('docs/stabilization-local/followup/historical-ui-results.json',JSON.stringify({records,exceptions},null,2));
});
console.log(`${records.length} historical UI contracts PASS`);
