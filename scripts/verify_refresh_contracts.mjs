import assert from 'node:assert/strict';
import fs from 'node:fs';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
const modules={AdminPanel:['Administration','reload',['Administrateur']],ChangeHistoryPanel:['Édition — Historique','reload',['Administrateur']],WorkOrdersPanel:['Bons de travail','reload',['Administrateur','Coordonnateur']],UserProvisioningPanel:['Utilisateurs réels','reload',['Administrateur']],ClientsAccessAdmin:['Clients','load',['Administrateur','Coordonnateur']],RoleVisibilityAdmin:['Visibilité par rôle','reload',['Administrateur']],FinalReportsCenter:['Rapports finaux','reloadCommunications',['Administrateur','Coordonnateur']],PhotoInventoryCenter:['Photos et inventaire','reload',['Administrateur','Coordonnateur']],OperationsCenter:['Centre EDT et BT','reload',['Administrateur','Coordonnateur']],TerrainSyncDiagnostics:['Diagnostic terrain','reload',['Administrateur','Coordonnateur']],RelationsStudio:['Automatisations / Studio des relations','reload',['Administrateur']],Module15Reports:['Rapports EDT','reload',['Administrateur','Coordonnateur']]};
const records=[];
await offlineBrowser('scripts/fixtures/refresh-entry.jsx',async({evaluate,waitFor,sleep,exceptions,consoleErrors})=>{
 for(const [component,[view,handler,roles]]of Object.entries(modules))for(const role of roles){
  try{
   await evaluate(`window.mount(${JSON.stringify(component)},${JSON.stringify(role)})`);await waitFor(`document.querySelector('[data-refresh-control="${component}"]')&&!document.querySelector('[data-refresh-control="${component}"]').disabled&&fixture.calls.length>0`);
   const button=`document.querySelector('[data-refresh-control="${component}"]')`;
   // Keep a non-default search when the module provides one. Other controls are
   // snapshotted to ensure that refresh does not clear the current form/context.
   await evaluate(`(()=>{const input=document.querySelector('input[placeholder*="Recher"],.searchbar input');if(input){Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(component==='RelationsStudio'?'infrastructures':'EXO')});input.dispatchEvent(new Event('input',{bubbles:true}))}})()`);await sleep(60);
   await evaluate(`document.querySelector('.sortable-header-trigger')?.click()`);await sleep(40);
   await evaluate(`document.querySelector('.column-sort-actions button')?.click()`);await sleep(40);
   if(component==='TerrainSyncDiagnostics'){
    await evaluate(`document.querySelector('[aria-label="Page suivante"]').click()`);await waitFor(`!${button}.disabled`);
    assert.equal(await evaluate(`document.querySelector('[aria-current="page"]').textContent`),'2');
   }
   const snapshot=()=>evaluate(`JSON.stringify({inputs:[...document.querySelectorAll('input:not([type="checkbox"]),select,textarea')].map(x=>[x.name,x.type,x.value]),sort:[...document.querySelectorAll('th[aria-sort]')].map(x=>x.getAttribute('aria-sort')),page:document.querySelector('[aria-current="page"]')?.textContent,columns:[...document.querySelectorAll('thead th')].map(x=>x.textContent)})`);
   const before=await snapshot();await evaluate(`fixture.holdReads=true;fixture.delay=180;fixture.version='REFRESH';window.tableBefore=document.querySelector('table');${button}.click();${button}.click()`);await sleep(40);
   assert.equal(await evaluate(`${button}.disabled`),true,'refresh loading visible');assert.equal(await evaluate('!tableBefore||tableBefore===document.querySelector("table")'),true,'table stays mounted');await evaluate('fixture.holdReads=false;for(const finish of fixture.pendingReads.splice(0))finish()');await waitFor(`!${button}.disabled`);assert.equal(await snapshot(),before,'search/form/context preserved');
   const firstService=await evaluate('fixture.calls[0].name');
   const countBefore=await evaluate(`fixture.calls.filter(c=>c.name===${JSON.stringify(firstService)}).length`);
   await evaluate(`fixture.delay=80;for(let i=0;i<10;i++)${button}.click()`);await waitFor(`!${button}.disabled`);
   assert.equal(await evaluate(`fixture.calls.filter(c=>c.name===${JSON.stringify(firstService)}).length`),countBefore+1,'ten consecutive clicks start only one load');
   assert.equal(await snapshot(),before,'sort/page/columns/inputs survive repeated refresh');
   // A context-triggered load can supersede the disabled user button. Invoke the
   // actual React handler twice to exercise this path rather than a model copy.
   await evaluate(`(()=>{const b=${button};window.refreshHandler=b[Object.keys(b).find(k=>k.startsWith('__reactProps'))].onClick;fixture.delay=350;fixture.version='STALE';refreshHandler();fixture.delay=20;fixture.version='LATEST';refreshHandler()})()`);
   await waitFor(`!${button}.disabled`);await sleep(400);
   if(component==='RoleVisibilityAdmin')assert.equal(await evaluate(`[...document.querySelectorAll('.role-columns-grid label')].find(x=>x.textContent.trim()==='support_id').querySelector('input').checked`),true,'latest permission response');
   else assert.equal(await evaluate(`document.body.innerText.includes('LATEST')&&!document.body.innerText.includes('STALE')`),true,'latest response rendered; stale response absent');
   await evaluate(`fixture.fail=true;fixture.delay=20;${button}.click()`);await waitFor(`!${button}.disabled`);assert.equal(await evaluate(`document.body.innerText.includes('REFRESH_FIXTURE_ERROR')||document.body.innerText.includes('Impossible')`),true,'visible error');
   await evaluate(`fixture.fail=false;${button}.click()`);await waitFor(`!${button}.disabled`);await sleep(80);const count=await evaluate('fixture.calls.length');await sleep(350);assert.equal(await evaluate('fixture.calls.length'),count,'no fetch loop');
   const services=await evaluate('Array.from(new Set(fixture.calls.map(c=>c.file+":"+c.name)))');
   records.push({ROLE:role,VIEW:view,CONTROL:'Actualiser',STATE:'loaded / double click / competing reads / error / retry',HANDLER:handler,SERVICE:services.join('|'),PERMISSION:'Current role admitted by navigation/component fixture',EXPECTED:'Latest response only; mounted data; preserved inputs; bounded loading; visible error and retry',TEST:'verify_refresh_contracts.mjs:'+component,RESULT:'PASS_LOCAL_BROWSER',SOURCE:`src/components/${component}.jsx`,REMOTE:'RPC/RLS/real service integration separately required'});console.log('PASS refresh '+component+' '+role);
  }catch(error){records.push({ROLE:role,VIEW:view,CONTROL:'Actualiser',RESULT:'FAIL',SOURCE:`src/components/${component}.jsx`,ERROR:error.stack});console.error('FAIL refresh '+component+' '+role+' '+error.message);}
 }
 fs.writeFileSync('docs/stabilization-local/followup/refresh-results.json',JSON.stringify({records,exceptions,consoleErrors},null,2));assert.deepEqual(exceptions,[]);assert.equal(records.filter(r=>r.RESULT==='FAIL').length,0);
});
