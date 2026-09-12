import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {serverAccess,existingSession} from './lib/businessParityRemote.mjs';
import {productionBrowser} from './lib/businessParityBrowser.mjs';
const production=process.argv.includes('--production'),diagnose=process.argv.includes('--diagnose');
let server;
if(!production){
 const root=path.resolve('dist');
 server=http.createServer((req,res)=>{
  const target=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname));
  if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  const file=fs.existsSync(target)&&fs.statSync(target).isFile()?target:path.join(root,'index.html');
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'text/html');res.end(fs.readFileSync(file));
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));process.env.TDM_TEST_PORTAL_ORIGIN='http://127.0.0.1:'+server.address().port;
}

const records=[];let actor;
try{
 const access=await serverAccess();
 for(const profileId of [25,33]){
  actor=await existingSession(access,profileId);
  records.push(await productionBrowser(actor.session,async b=>{
   await b.waitFor("document.querySelector('[data-dashboard-state]')?.dataset.dashboardState==='ready'",60);
   const menus=await b.evaluate("[...document.querySelectorAll('.client-body aside button')].map(x=>x.textContent.trim())");
   assert(menus.includes('Carte interactive'));
   const views=[];
   for(const label of ['Campagnes et visuels par site et supports','Communications opérationnelles par site et supports']){
    assert(menus.includes(label));
    await b.evaluate(`[...document.querySelectorAll('.client-body aside button')].find(x=>x.textContent.trim()===${JSON.stringify(label)}).click()`);
    await b.waitFor("!!document.querySelector('.assignment-page tbody tr') && !document.querySelector('.assignment-page .client-loading')",90);
    const edit=await b.evaluate("!!document.querySelector('.assignment-actions [aria-label=Modifier]')");
    assert.equal(edit,profileId===25);
    if(edit){
     await b.evaluate("document.querySelector('.assignment-actions [aria-label=Modifier]').click()");
     await b.waitFor("!!document.querySelector('[aria-label=\"Modifier l’affectation\"] form')");
     assert(await b.evaluate("!!document.querySelector('[aria-label=\"Modifier l’affectation\"] input').value"));
     await b.evaluate("[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Annuler').click()");
    }
    views.push({label,edit,summary:await b.evaluate("document.querySelector('.assignment-page .grid-pagination-summary')?.textContent")});
   }
   assert.deepEqual(b.errors,[]);
   assert.deepEqual(b.responses.filter(r=>r.status>=400&&!r.url.includes('tile.openstreetmap')).map(({url,status})=>({url,status})),[]);
   return {profileId,views,status:'PASS'};
  }));
  await actor.client.auth.signOut({scope:'local'});actor=null;
 }
 const result={at:new Date().toISOString(),mode:production?'production':'local-build-real-backend',records};
 fs.writeFileSync('docs/client-business-parity/assignment-application-'+(production?'production':'local')+'.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{if(actor)await actor.client.auth.signOut({scope:'local'});server?.close();delete process.env.TDM_TEST_PORTAL_ORIGIN;}
