import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {productionBrowser} from './lib/businessParityBrowser.mjs';
import {serverAccess,existingSession} from './lib/businessParityRemote.mjs';
const mode=process.argv.includes('--production')?'production':'local';
let server;
if(mode==='local'){
 const root=path.resolve('dist');server=http.createServer((req,res)=>{
  const target=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname));
  if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  const file=fs.existsSync(target)&&fs.statSync(target).isFile()?target:path.join(root,'index.html');
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'text/html');res.end(fs.readFileSync(file));
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));process.env.TDM_TEST_PORTAL_ORIGIN='http://127.0.0.1:'+server.address().port;
}
const access=await serverAccess(),records=[];
try{
 for(const id of [25,33,11,3]){
  const actor=await existingSession(access,id);
  try{const record=await productionBrowser(actor.session,async b=>{
   const click=text=>b.evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`);
   if(id===3){
    await b.waitFor("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Voir en tant que')");await click('Voir en tant que');
    await b.waitFor("!!document.querySelector('.ca-preview select option[value=\"25\"]')");
    await b.evaluate("(()=>{const s=document.querySelector('.ca-preview select');s.value='25';s.dispatchEvent(new Event('change',{bubbles:true}));})()");await b.pause(200);await click('Ouvrir sa vue réelle');
    await b.waitFor("!!document.querySelector('.ca-preview-banner') && document.querySelector('[data-dashboard-state]')?.dataset.dashboardState==='ready'",60);
   }else if(id!==11)await b.waitFor("document.querySelector('[data-dashboard-state]')?.dataset.dashboardState==='ready'",60);
   await b.waitFor("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Infrastructures')");await click('Infrastructures');
   await b.waitFor("!!document.querySelector('.tablePage tbody tr')",60);
   assert.equal(await b.evaluate("!!document.querySelector('[data-business-write=update]')"),[25,3].includes(id));
   const rows=await b.evaluate("document.querySelector('.grid-pagination-summary')?.textContent");
   await click('Carte');await b.waitFor("!!document.querySelector('.leaflet-container')",60);
   if(id!==11){await click('Tableau');await b.waitFor("!!document.querySelector('.tablePage tbody tr')");}
   if(id===3){
    await click('Revenir à ma vue Admin');await b.waitFor("!document.querySelector('.ca-preview-banner') && [...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Voir en tant que')",60);
    for(const target of [32,11,1]){
     await click('Voir en tant que');await b.waitFor(`!!document.querySelector('.ca-preview select option[value="${target}"]')`);
     await b.evaluate(`(()=>{const s=document.querySelector('.ca-preview select');s.value='${target}';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);await b.pause(200);await click('Ouvrir sa vue réelle');
     await b.waitFor("!!document.querySelector('.ca-preview-banner')",60);
     if(target===32)await b.waitFor("document.body.textContent.includes('Créer votre mot de passe')",60);
     else if(target===1)await b.waitFor("document.querySelector('[data-dashboard-state]')?.dataset.dashboardState==='ready'",60);
     else await b.waitFor("[...document.querySelectorAll('button')].some(x=>x.textContent.trim()==='Infrastructures')",60);
     await click('Revenir à ma vue Admin');await b.waitFor("!document.querySelector('.ca-preview-banner') && [...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Voir en tant que')",60);
    }
   }
   const views=[];
   if([25,33].includes(id)){
    const labels=await b.evaluate("[...document.querySelectorAll('.client-body aside button')].map(x=>x.textContent.trim()).filter(x=>!['Sommaire','Exports','Infrastructures'].includes(x))");
    for(const label of labels){
     await click(label);await b.pause(4000);
     await b.waitFor("!document.querySelector('.client-loading')",60);
     const alerts=await b.evaluate("[...document.querySelectorAll('.client-notice,.relations-message')].map(x=>x.textContent)");assert.deepEqual(alerts,[],label);
     assert(await b.evaluate("!!document.querySelector('.tablePage,.campaigns-page,.operations-center,.client-request-form,.operations-page')"),label);
     if(id===25&&label==='EDT / Progression'){
      await b.waitFor("[...document.querySelectorAll('.edt-actions button')].some(x=>x.textContent.includes('Modifier'))",60);
      await b.evaluate("[...document.querySelectorAll('.edt-actions button')].find(x=>x.textContent.includes('Modifier')).click()");
      await b.waitFor("document.querySelector('.operations-form')?.textContent.includes('Modifier l’EDT')");
     }
     if(id===25&&label==='Campagnes'){
      await b.waitFor("[...document.querySelectorAll('.campaigns-page button')].some(x=>x.textContent.includes('Modifier'))",60);
      await b.evaluate("[...document.querySelectorAll('.campaigns-page button')].find(x=>x.textContent.includes('Modifier')||x.title==='Modifier').click()");
      await b.waitFor("!!document.querySelector('.campaigns-page form')");
     }
     views.push({view:label,status:'PASS'});
    }
   }
   const failures=b.responses.filter(r=>r.status>=400&&!r.url.includes('tile.openstreetmap')).map(({url,status})=>({url,status}));
   assert.deepEqual(b.errors,[]);assert.deepEqual(failures,[]);
   return {profile:id,role:actor.profile.role,previewTarget:id===3?25:null,previewTargets:id===3?[25,32,11,1]:[],rows,map:'PASS',editVisibility:'PASS',views,returnToAdmin:id===3?'PASS':null};
  });records.push(record);console.log(JSON.stringify(record));}finally{await actor.client.auth.signOut({scope:'local'});}
 }
 fs.writeFileSync('docs/client-business-parity/application-'+mode+'.json',JSON.stringify({at:new Date().toISOString(),status:'PASS',records},null,2));
}finally{server?.close();delete process.env.TDM_TEST_PORTAL_ORIGIN;}
