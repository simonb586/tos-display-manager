import fs from 'node:fs';
import assert from 'node:assert/strict';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
const records=[];
await offlineBrowser('scripts/fixtures/strict-grid-entry.jsx',async({evaluate,waitFor,sleep,exceptions,consoleErrors,send})=>{
 const views=await evaluate('gridViews.map(v=>v.route)');
 const click=async(expression)=>{await evaluate(`${expression}.click()`);await sleep(35)};
 const page25=async()=>{await waitFor("!!document.querySelector('.grid-pagination select')");await evaluate("const n=document.querySelector('.grid-pagination select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(n,'25');n.dispatchEvent(new Event('change',{bubbles:true}))");await sleep(40)};
 const headers=()=>evaluate("[...document.querySelectorAll('th[data-grid-zone=header] .grid-column-header-label')].map(n=>n.textContent)");
 for(let index=0;index<views.length;index++){
  await evaluate(`localStorage.clear();mount('admin',${index})`);await page25();await waitFor("document.querySelectorAll('tbody tr').length===25");const canonical=await headers();
  for(const [surface,role,client]of [['admin','Administrateur',2],['admin','Coordonnateur',2],['client','Client',2],['client','Client-Admin',2],['client','Client',9],['client','Admin Preview',2]]){
   await evaluate(`localStorage.clear();mount('${surface}',${index},'${role}',${client})`);await sleep(70);await page25();await waitFor("document.querySelectorAll('tbody tr').length===25");assert.deepEqual(await headers(),canonical,views[index]+' canonical business headers '+role);
   const rowText=await evaluate("document.querySelector('tbody').textContent");assert.ok(rowText.includes('SUP-'+client+'-'));assert.ok(!rowText.includes('SUP-'+(client===2?9:2)+'-'));
   console.log('GRID '+views[index]+' '+role);
   const sort="[...document.querySelectorAll('th[data-grid-zone=header]')].find(n=>n.querySelector('.grid-column-header-label')?.textContent.toLowerCase()==='site').querySelector('button')";
   for(const state of ['ascending','descending','none']){await click(sort);assert.equal(await evaluate(`${sort}.closest('th').getAttribute('aria-sort')`),state)}
   const filter="[...document.querySelectorAll('.grid-filter-trigger')].find(n=>n.textContent.trim().toLowerCase()==='site')";await click(filter);await waitFor("!!document.querySelector('.grid-filter-dropdown')");await click("document.querySelector('.grid-filter-options input')");assert.ok(await evaluate("document.querySelectorAll('tbody tr').length<25"));await click("document.querySelector('.grid-filter-actions button')");await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");await sleep(30);assert.equal(await evaluate("!!document.querySelector('.grid-filter-dropdown')"),false);
   await click("document.querySelector('.grid-settings > button')");await waitFor("!!document.querySelector('.grid-settings-backdrop')");await click("document.querySelector('.grid-settings-list input[type=checkbox]')");await click("document.querySelector('.grid-settings footer button:last-child')");assert.equal((await headers()).length,canonical.length-1);await click("document.querySelector('.grid-settings > button')");await click("document.querySelector('.grid-settings footer button:first-child')");await click("document.querySelector('.grid-settings [aria-label=Fermer]')");assert.deepEqual(await headers(),canonical);
   await click("[...document.querySelectorAll('.grid-pagination button')].find(n=>n.textContent.trim()==='2')");await waitFor("document.querySelectorAll('tbody tr').length===5");assert.equal(await evaluate("document.querySelector('.grid-pagination [aria-current=page]').textContent"),'2');
   records.push({view:views[index],surface,role,client,result:'PASS_LOCAL',tests:'canonical business headers|client scope|sort cycle|filter selection/clear/Escape|settings hide/finish/reopen/reset/X|numbered pagination'});
  }
 }
 fs.writeFileSync('docs/stabilization-local/certification/strict/grids-results.json',JSON.stringify({records,exceptions,consoleErrors},null,2));assert.deepEqual(exceptions,[]);assert.deepEqual(consoleErrors,[]);
},{exposeMain:true,realServices:['roleVisibilityService.js','mapService.js']});console.log(records.length+' strict grid/projection cases PASS');
