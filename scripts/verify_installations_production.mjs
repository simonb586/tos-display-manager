import fs from 'node:fs';
import assert from 'node:assert/strict';
import {targetedAccess} from './targeted_remote_access.mjs';
import {existingSession} from './targeted_existing_session.mjs';
import {productionBrowser} from './lib/businessParityBrowser.mjs';
const access=await targetedAccess(),records=[];
for(const [actor,id] of [['admin',1],['marylene',25],['client',32],['client-b',37]]){
 const login=await existingSession(access,id);
 try{
  const result=await productionBrowser(login.session,async b=>{
   await b.waitFor('document.querySelectorAll("aside button").length>2',90);
   const click=async text=>{await b.waitFor(`[...document.querySelectorAll('aside button')].some(e=>e.textContent.trim().endsWith(${JSON.stringify(text)}))`);await b.evaluate(`[...document.querySelectorAll('aside button')].find(e=>e.textContent.trim().endsWith(${JSON.stringify(text)})).click()`)};
   const views=[];
   for(const [label,expected] of [['Campagnes et visuels par site et supports',2388],['Communications opérationnelles par site et supports',301]]){
    await click(label);
    await b.waitFor(`document.querySelector('.assignment-page h1')?.textContent===${JSON.stringify(label)} && [...document.querySelectorAll('.assignment-page button')].some(e=>e.textContent==='Actualiser'&&!e.disabled)`,90);
    const state=await b.evaluate(`({summary:[...document.querySelectorAll('.assignment-page > .grid-pagination .grid-pagination-summary')].at(-1)?.childNodes[1]?.textContent,unclassified:document.querySelector('.assignment-page details summary')?.textContent,errors:[...document.querySelectorAll('.assignment-page .error')].map(e=>e.textContent),readOnly:![...document.querySelectorAll('.assignment-actions button')].some(e=>e.textContent.includes('Modifier'))})`);
    const count=Number(state.summary?.split('sur')[1]?.replace(/\s/g,''));
    assert.equal(count,actor==='client-b'?0:expected,actor+': '+label+' '+state.summary);
    if(actor==='client'||actor==='client-b')assert(state.readOnly);
    assert.deepEqual(state.errors,[]);
    views.push({label,count,readOnly:state.readOnly});
   }
   if(actor==='admin'){
    await click('Campagnes maîtres');
    await b.waitFor("document.querySelectorAll('.campaign-list article').length>0");
    const names=await b.evaluate("[...document.querySelectorAll('.campaign-list article strong')].map(e=>e.textContent)");
    assert.deepEqual(names,[...names].sort((a,c)=>a.localeCompare(c,'fr',{numeric:true,sensitivity:'base'})));
    assert(await b.evaluate("!!document.querySelector('input[aria-label=\"Rechercher un thème ou une campagne\"]')"));
    await b.evaluate("[...document.querySelectorAll('button')].find(e=>e.textContent==='Fiche du thème').click()");
    await b.waitFor("!!document.querySelector('[role=dialog] .visual-references')");
    assert(await b.evaluate("!!document.querySelector('[role=dialog] input[type=file][accept*=pdf]')"));
   }
   assert.deepEqual(b.errors,[]);
   assert.deepEqual(b.responses.filter(r=>r.status>=400&&r.url.includes('.supabase.co')),[]);
   return {views,result:'PASS'};
  });
  records.push({actor,...result});console.log(actor+': PASS');
 }finally{await login.client.auth.signOut({scope:'local'});}
}
fs.writeFileSync('docs/site-support-installations/production.json',JSON.stringify({at:new Date().toISOString(),origin:process.env.TDM_TEST_PORTAL_ORIGIN||'https://portail.groupetos.com',records},null,2));
