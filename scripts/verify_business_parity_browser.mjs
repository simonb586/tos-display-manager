import assert from 'node:assert/strict';
import fs from 'node:fs';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
const records=[];
await offlineBrowser('scripts/fixtures/business-parity-final-entry.jsx',async b=>{
 const click=text=>b.evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`);
 const ready=()=>b.waitFor("Boolean(document.querySelector('.tablePage tbody tr'))");
 await b.evaluate("mount('Administrateur')");await ready();
 const headers=await b.evaluate("[...document.querySelectorAll('.tablePage thead .data-grid-header-row th')].map(x=>x.textContent)");
 for(const role of ['Client','Client-Admin'])for(const preview of [false,true]){
  await b.evaluate(`mount(${JSON.stringify(role)},2,'infrastructures',${preview})`);
  await b.sleep(100);
  await b.waitFor("!!document.querySelector('.client-body aside button') && document.querySelector('[data-dashboard-state]')?.dataset.dashboardState==='ready'");
  await click('Infrastructures');await ready();
  assert.deepEqual(await b.evaluate("[...document.querySelectorAll('.tablePage thead .data-grid-header-row th')].map(x=>x.textContent)"),headers);
  assert.equal(await b.evaluate("!!document.querySelector('[data-business-write=update]')"),role==='Client-Admin',`${role} preview=${preview}`);
  await b.evaluate("document.querySelector('[aria-label=\"Page suivante\"]').click()");await b.waitFor("document.querySelector('.grid-pagination-summary strong')?.textContent==='51–100'");
  await click('Carte');await b.waitFor("!!document.querySelector('.client-back')");await click('Tableau');
  assert.equal(await b.evaluate("document.querySelector('.grid-pagination-summary strong').textContent"),'51–100');
  await b.evaluate("document.querySelector('.tablePage tbody tr').click()");await b.waitFor("!!document.querySelector('.drawer')");
  assert.equal(await b.evaluate("document.querySelector('.drawer').textContent.includes('Modifier la fiche')"),role==='Client-Admin');
  if(role==='Client-Admin'){
   await click('Modifier la fiche');await b.waitFor("!!document.querySelector('.detail-edit-actions .grid-edit-secondary')");
   assert.equal(await b.evaluate("document.querySelector('.detail-edit-actions .grid-edit-primary').disabled"),preview);
   if(!preview){
    await b.evaluate("(()=>{const item=[...document.querySelectorAll('.detailGrid > div')].find(x=>x.querySelector('label')?.textContent.toLowerCase()==='commentaires');const input=item.querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Modification validée');input.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await b.sleep(50);
    await b.evaluate("(()=>{const button=document.querySelector('.detail-edit-actions .grid-edit-primary');button.click();button.click();})()");
    await b.waitFor("document.querySelector('.drawer')?.textContent.includes('Fiche enregistrée.')");
    assert.equal(await b.evaluate("fixture.calls.filter(c=>c.name==='updateUniversalRow').length"),1);
    assert(await b.evaluate("document.querySelector('.tablePage tbody')?.textContent.includes('Modification validée')"));
    records.push({editSaveRefresh:'PASS',doubleClickOneMutation:'PASS'});
   }
  }
  records.push({role,preview,columns:'PASS',editButton:'PASS',mapRoundTrip:'PASS',pagePreserved:'PASS',detail:'PASS'});
 }
 for(const role of ['Client','Client-Admin']){
  await b.evaluate(`mount(${JSON.stringify(role)},2,'requests')`);await b.sleep(100);
  await b.waitFor("[...document.querySelectorAll('button')].some(x=>x.textContent.trim()==='Nouvelle requête')");
  await click('Nouvelle requête');await b.waitFor("!!document.querySelector('.bulk-support-rows input')");
  await b.evaluate("document.querySelector('.bulk-support-rows input').click()");await b.sleep(50);
  await click('Vérifier avant soumission');await b.sleep(50);
  await b.evaluate("(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Soumettre la requête');b.click();b.click();})()");
  await b.waitFor("document.body.textContent.includes('Requête créée et supports validés')");
  assert.equal(await b.evaluate("fixture.calls.filter(c=>c.name==='createMultiSupportClientRequest').length"),1);
  records.push({role,requestSubmit:'PASS',doubleClickOneRequest:'PASS'});
 }
 const dashboards=[];
 for(const role of ['Administrateur','Client','Client-Admin']){
  await b.evaluate(`mountDashboard(${JSON.stringify(role)})`);await b.sleep(100);await b.waitFor("document.querySelector('[data-dashboard-state]')?.dataset.dashboardState==='ready'");
  dashboards.push(await b.evaluate("[...document.querySelectorAll('.executive-kpi')].map(x=>({key:x.dataset.kpi,label:x.querySelector('span').textContent,value:x.querySelector('strong').textContent}))"));
 }
 assert.deepEqual(dashboards[1],dashboards[0]);assert.deepEqual(dashboards[2],dashboards[0]);records.push({dashboardCategories:'PASS',extraCategories:0,labels:'PASS',kpis:'PASS'});
 assert.deepEqual(b.exceptions,[]);assert.deepEqual(b.consoleErrors,[]);
},{realServices:['roleVisibilityService.js','mapService.js']});
fs.mkdirSync('docs/client-business-parity',{recursive:true});fs.writeFileSync('docs/client-business-parity/browser.json',JSON.stringify({at:new Date().toISOString(),records},null,2));
console.log('Canonical business browser parity PASS');
