import fs from 'node:fs';
import assert from 'node:assert/strict';
import {targetedAccess} from './targeted_remote_access.mjs';
import {fixtureSession} from './targeted_test_accounts.mjs';
import {existingSession} from './targeted_existing_session.mjs';
import {productionBrowser} from './targeted_test_browser.mjs';
const access=await targetedAccess(),results=[];
for(const role of ['Client','Client-Admin','Marylène']){
 const a=role==='Marylène'?await existingSession(access,25):await fixtureSession(access,{role,clientId:2,profileId:-94921});
 try{
  const start=Date.now(),r=await a.client.rpc('portal_dashboard_summary');assert.ifError(r.error);assert.equal(r.data.kpis.marketing_active,17);assert.equal(r.data.kpis.operational_active,6);assert(r.data.kpis.photos>=12);
  const rpcMs=Date.now()-start;console.log(role+' summary '+rpcMs+'ms, server '+r.data.server_ms+'ms');
  await productionBrowser(a.session,async b=>{
   await b.waitFor("document.querySelector('[data-dashboard-state]')?.dataset.dashboardState==='ready'",60);
   await b.evaluate("Array.from(document.querySelectorAll('aside button')).find(e=>e.textContent.trim().endsWith('Photos et inventaire')).click()");
   await b.waitFor("!!document.querySelector('[aria-label=\"Dossiers photos\"]')",60);
   await b.evaluate("Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()==='Inventaire').click()");
   await b.waitFor("!!document.querySelector('[aria-label=\"Rechercher un mouvement\"]')",30);
   assert.equal(await b.evaluate("document.body.innerText.includes('Supprimer le mouvement')"),false);assert.deepEqual(b.errors,[]);
  });results.push({role,result:'PASS',rpcMs,serverMs:r.data.server_ms,photos:r.data.kpis.photos});console.log(role+' real navigation PASS');
 }finally{if(a.cleanup)await a.cleanup();else await a.client.auth.signOut({scope:'local'});}
}
fs.writeFileSync('docs/photo-inventory-mission/portal-navigation-tests.json',JSON.stringify(results,null,2));
