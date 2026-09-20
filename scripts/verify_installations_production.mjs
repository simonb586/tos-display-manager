import fs from 'node:fs';
import assert from 'node:assert/strict';
import {targetedAccess} from './targeted_remote_access.mjs';
import {existingSession} from './targeted_existing_session.mjs';
import {productionBrowser} from './lib/businessParityBrowser.mjs';
import {projectSiteSupportDeployments} from '../src/lib/siteSupportDeployments.js';
const access=await targetedAccess(),records=[];
async function expectedFor(login){
 async function all(table){const rows=[];for(let offset=0;;offset+=500){const {data,error}=await login.client.from(table).select('*').order('id').range(offset,offset+499);if(error)throw error;rows.push(...data);if(data.length<500)return rows;}}
 const [supports,campaigns,visuals]=await Promise.all(['infrastructures','campagnes_maitres','campagne_visuels_formats'].map(all));
 const history=[];let total;do{const {data,error}=await login.client.rpc('portal_business_rows',{p_view:'Historique des campagnes',p_offset:history.length,p_limit:1000});if(error?.code==='42501'&&error.message==='business_view_denied')break;if(error)throw error;history.push(...data.rows);total=data.total;}while(history.length<total);
 if(login.profile.client_id){
  for(const row of [...supports,...campaigns,...visuals])assert.equal(row.client_id,login.profile.client_id,'Client isolation');
  for(const row of history)assert(row.client_id===login.profile.client_id||(row.client_id==null&&supports.some(s=>s.support_id===row.support_id)),'History must belong to the client or an exact scoped support');
 }
 const installed=projectSiteSupportDeployments({supports,campaigns,visuals,history}).filter(r=>r.etat_courant==='Oui');
 return {marketing:installed.filter(r=>r.business_context==='marketing').length,operational:installed.filter(r=>r.business_context==='operational_communication').length,accessibleCampaigns:campaigns.length,accessibleVisuals:visuals.length,supports:supports.length};
}
// Use activated profiles; never complete an invitation or change a password for a test.
for(const [actor,id] of [['admin',1],['marylene',25],['client',33],['client-b',-92501]]){
 const login=await existingSession(access,id);
 try{
  const expectedScope=await expectedFor(login);
  const result=await productionBrowser(login.session,async b=>{
   await b.waitFor('document.querySelectorAll("aside button").length>2',90);
   const click=async text=>{await b.waitFor(`[...document.querySelectorAll('aside button')].some(e=>e.textContent.trim().endsWith(${JSON.stringify(text)}))`);await b.evaluate(`[...document.querySelectorAll('aside button')].find(e=>e.textContent.trim().endsWith(${JSON.stringify(text)})).click()`)};
   const views=[];
   for(const [label,expected] of [['Campagnes et visuels par site et supports',expectedScope.marketing],['Communications opérationnelles par site et supports',expectedScope.operational]]){
    await click(label);
    await b.waitFor(`document.querySelector('.assignment-page h1')?.textContent===${JSON.stringify(label)} && [...document.querySelectorAll('.assignment-page button')].some(e=>e.textContent==='Actualiser'&&!e.disabled)`,90);
    const state=await b.evaluate(`({summary:(()=>{const e=[...document.querySelectorAll('.assignment-page > .grid-pagination .grid-pagination-summary')].at(-1)?.cloneNode(true);e?.querySelectorAll('strong,span').forEach(n=>n.remove());return e?.textContent})(),unclassified:document.querySelector('.assignment-page details summary')?.textContent,errors:[...document.querySelectorAll('.assignment-page .error')].map(e=>e.textContent),readOnly:![...document.querySelectorAll('.assignment-actions button')].some(e=>e.textContent.includes('Modifier'))})`);
    const count=Number(state.summary?.split('sur')[1]?.replace(/\s/g,''));
    assert.equal(count,expected,actor+': '+label+' '+state.summary);
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
   assert.deepEqual(b.responses.filter(r=>r.status>=400&&r.url.includes('.supabase.co')&&!(r.status===403&&r.url.endsWith('/rpc/portal_business_rows'))),[]);
   return {views,expectedScope,result:'PASS'};
  });
  records.push({actor,...result});console.log(actor+': PASS');
 }finally{await login.client.auth.signOut({scope:'local'});}
}
fs.writeFileSync('docs/site-support-installations/production.json',JSON.stringify({at:new Date().toISOString(),origin:process.env.TDM_TEST_PORTAL_ORIGIN||'https://portail.groupetos.com',records},null,2));
