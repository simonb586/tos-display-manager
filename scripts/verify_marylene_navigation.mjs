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
let actor;
try{
 actor=await existingSession(await serverAccess(),3);
 const record=await productionBrowser(actor.session,async b=>{
  const click=text=>b.evaluate(`[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(text)}).click()`);
  await b.waitFor("document.querySelector('[data-dashboard-state]')?.dataset.dashboardState==='ready'",60);
  const palette=selector=>b.evaluate(`(()=>{const node=document.querySelector(${JSON.stringify(selector)}),style=getComputedStyle(node),active=getComputedStyle(node.querySelector('button.active'));return {background:style.backgroundImage,color:style.color,activeBackground:active.backgroundColor,activeText:active.color,body:getComputedStyle(document.body).backgroundColor}})()`);
  const adminPalette=await palette('.app > aside');
  await click('Voir en tant que');await b.waitFor("!!document.querySelector('.ca-preview select option[value=\"25\"]')");
  await b.evaluate("(()=>{const s=document.querySelector('.ca-preview select');s.value='25';s.dispatchEvent(new Event('change',{bubbles:true}));})()");await b.pause(100);await click('Ouvrir sa vue réelle');
  await b.waitFor("!!document.querySelector('.client-portal') && document.querySelector('[data-dashboard-state]')?.dataset.dashboardState==='ready'",60);
  const clientPalette=await palette('.client-body > aside');
  await click('Infrastructures');await b.waitFor("!!document.querySelector('.tablePage tbody tr')",90);
  const before=await b.evaluate("document.querySelector('.grid-pagination-summary')?.textContent");
  await click('Infrastructures');await b.pause(250);
  const retained=await b.evaluate("!!document.querySelector('.tablePage tbody tr')");
  const menuMap=await b.evaluate("[...document.querySelectorAll('.client-body > aside button')].some(x=>x.textContent.trim()==='Carte interactive')");
  if(!diagnose){
   assert(retained,'Repeated navigation erased infrastructures');assert(menuMap,'Map missing in sidebar');assert(before.replace(/\s/g,'').includes('6619'));
   assert.deepEqual(clientPalette,adminPalette,'Admin and client shell palettes differ');
   await click('Carte interactive');await b.waitFor("!!document.querySelector('.leaflet-container')",60);
   await click('Infrastructures');await b.waitFor("!document.querySelector('.leaflet-container') && !!document.querySelector('.tablePage tbody tr')",60);
   assert.equal(await b.evaluate("document.querySelector('.grid-pagination-summary')?.textContent"),before);
   await click('Sommaire');await click('Carte interactive');await b.waitFor("!!document.querySelector('.leaflet-container')",90);
   await click('Tableau');await b.waitFor("!!document.querySelector('.tablePage tbody tr')",90);
   await click('Revenir à ma vue Admin');await b.waitFor("!!document.querySelector('.app > aside') && !document.querySelector('.ca-preview-banner')",60);
   assert.deepEqual(b.errors,[]);
   assert.deepEqual(b.responses.filter(r=>r.status>=400&&!r.url.includes('tile.openstreetmap')).map(({url,status})=>({url,status})),[]);
  }
  return {at:new Date().toISOString(),mode:production?'production':'local',profile:25,client:2,before,repeatedNavigationRetainsRows:retained,mapInSidebar:menuMap,adminPalette,clientPalette,status:diagnose?'DIAGNOSIS':'PASS'};
 });
 fs.writeFileSync(`docs/client-business-parity/marylene-navigation-${diagnose?'before':production?'production':'local'}.json`,JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record));
}finally{if(actor)await actor.client.auth.signOut({scope:'local'});server?.close();delete process.env.TDM_TEST_PORTAL_ORIGIN;}
