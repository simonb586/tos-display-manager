import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {targetedAccess} from './targeted_remote_access.mjs';
import {fixtureSession} from './targeted_test_accounts.mjs';
import {existingSession} from './targeted_existing_session.mjs';
import {productionBrowser} from './targeted_test_browser.mjs';
const access=await targetedAccess(),actors=[],records=[],label=process.env.TDM_TEST_PORTAL_ORIGIN?'local-live':'production';
const evidence={at:new Date().toISOString(),records},prefix='MISSION-'+crypto.randomUUID().slice(0,8),names=Array.from({length:5},(_,i)=>`${prefix}-${i}.png`);
let visualId,admin;
const save=()=>{fs.mkdirSync('docs/review-edt-mission',{recursive:true});fs.writeFileSync(`docs/review-edt-mission/${label}.json`,JSON.stringify(evidence,null,2));};
if(process.env.TDM_TEST_CLIENTS_ONLY){const prior=JSON.parse(fs.readFileSync(`docs/review-edt-mission/${label}.json`));records.push(...prior.records.filter(r=>!r.name.includes('Maryl?ne')&&!r.name.includes('Client B')));evidence.resumedClientChecks=true;}
const pass=(name,details={})=>{records.push({name,result:'PASS',...details});save();console.log(name+' PASS');};
const actor=async(role,clientId,id)=>{const a=await fixtureSession(access,{role,clientId,profileId:id});actors.push(a);return a;};
async function navigation(b,label){await b.waitFor(`Array.from(document.querySelectorAll('aside button')).some(e=>(e.textContent.trim().endsWith(${JSON.stringify(label)})||(${JSON.stringify(label)}==='Historique des campagnes'&&e.textContent.trim()==='Historique')))`,90);await b.evaluate(`Array.from(document.querySelectorAll('aside button')).find(e=>(e.textContent.trim().endsWith(${JSON.stringify(label)})||(${JSON.stringify(label)}==='Historique des campagnes'&&e.textContent.trim()==='Historique'))).click()`);}
const click=(b,text,selector='button')=>b.evaluate(`Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find(e=>e.textContent.trim()===${JSON.stringify(text)}).click()`);
async function input(b,selector,value){await b.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);await b.pause(70);}
try{
 admin=await actor('Administrateur',null,-94911);
 const initial=await admin.client.rpc('photo_inventory_read',{p_table:'support_photos',p_filters:{deleted_at:null,review_queue:true},p_limit:1000});assert.ifError(initial.error);evidence.initialQueue=initial.data.total;
 const created=await admin.client.rpc('save_campaign_visual_with_edts',{p_visual:{campagne_id:11,nom_visuel:prefix,format_support:'20 x 28'},p_links:[]});assert.ifError(created.error);visualId=created.data.id;
 if(!process.env.TDM_TEST_CLIENTS_ONLY)await productionBrowser(admin.session,async b=>{
  await navigation(b,'Photos et inventaire');await b.waitFor(`!!document.querySelector('.editor-tabs')`);await click(b,'Photos à valider');
  await b.waitFor(`document.querySelectorAll('.review-grid article').length>0`,90);
  const ids=new Set();
  for(let page=0;page<100;page++){
   for(const id of await b.evaluate(`Array.from(document.querySelectorAll('.review-grid article')).map(e=>e.dataset.photoId)`))ids.add(id);
   if(await b.evaluate(`Array.from(document.querySelectorAll('.photo-review-queue button')).find(e=>e.textContent==='Suivant').disabled`))break;
   await click(b,'Suivant','.photo-review-queue button');await b.pause(70);
  }
  assert.equal(ids.size,initial.data.total);pass('Photo database/RPC/UI pagination equality',{rpc:initial.data.total,ui:ids.size});
  await click(b,'Import massif de photos','.editor-tabs button');await b.waitFor(`!!document.querySelector('.mass-photo-import input[type=file]')`);
  await b.evaluate(`(()=>{const d=new DataTransfer();for(const name of ${JSON.stringify(names)})d.items.add(new File([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII='),c=>c.charCodeAt(0))],name,{type:'image/png'}));const e=document.querySelector('.mass-photo-import input[type=file]');e.files=d.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await b.waitFor(`document.querySelectorAll('.mass-photo-import .review-grid article').length===5`);
  await b.evaluate(`Array.from(document.querySelectorAll('.mass-photo-import button')).find(e=>e.textContent.includes('Analyser')).click()`);
  await b.waitFor(`!Array.from(document.querySelectorAll('.mass-photo-import button')).find(e=>e.textContent.includes('Importer')).disabled`,120);
  await b.evaluate(`Array.from(document.querySelectorAll('.mass-photo-import button')).find(e=>e.textContent.includes('Importer')).click()`);
  await b.waitFor(`Array.from(document.querySelectorAll('.mass-photo-import .review-card-body')).every(e=>e.textContent.includes('Original importé'))`,120);
  await click(b,'Photos à valider','.editor-tabs button');await b.waitFor(`document.querySelectorAll('.review-grid article').length>0`,90);
  await input(b,'.review-toolbar input',prefix);await b.waitFor(`document.querySelectorAll('.review-grid article').length===5`);pass('Real five-photo mass import: all originals remain visible');
  await navigation(b,'Campagne — Visuels et formats');await b.waitFor(`Array.from(document.querySelectorAll('.visual-managed-row')).some(e=>e.textContent.includes(${JSON.stringify(prefix)}))`,90);
  await b.evaluate(`Array.from(document.querySelectorAll('.visual-managed-row')).find(e=>e.textContent.includes(${JSON.stringify(prefix)})).querySelector('button').click()`);
  await b.waitFor(`!!document.querySelector('.v74-form')`);
  await click(b,'+ Ajouter un EDT');await b.waitFor(`Array.from(document.querySelectorAll('fieldset select option')).some(e=>e.value==='40')`);
  assert(await b.evaluate(`Array.from(document.querySelectorAll('fieldset select option')).some(e=>e.value==='18'&&e.textContent.includes('EDT-TOS-09'))`));
  await input(b,'fieldset select','18');await click(b,'+ Ajouter un EDT');await input(b,'fieldset .v74-card:nth-of-type(2) select','40');
  await input(b,'fieldset .v74-card:nth-of-type(2) input[type=date]','2026-09-01');await click(b,'Enregistrer les modifications');
  await b.waitFor(`document.querySelector('.v74-msg')?.textContent==='Visuel modifié.'`,45);
  const links=await admin.client.from('visual_edt_associations').select('edt_id,date_debut').eq('visual_id',visualId);assert.ifError(links.error);assert.equal(links.data.length,2);assert(links.data.some(a=>a.edt_id===22&&a.date_debut==='2026-09-01'));
  pass('Real visual edit: EDT-TOS-09, EDT-TOS-22-A, multi-EDT dates persisted');
  for(const route of ['Campagnes maîtres','Communications opérationnelles','Historique des campagnes']){
   await navigation(b,route);await b.waitFor(`!!document.querySelector('.campaign-history-view')`,90);await b.waitFor(`!document.querySelector('.campaign-history-view [role=status]')`,90);
   assert.equal(await b.evaluate(`document.querySelector('.campaign-history-view [role=alert]')?.textContent||''`),'');
   if(route==='Historique des campagnes')assert(await b.evaluate(`document.querySelector('.campaign-history-view').textContent.includes('Nombre de supports')`));
   pass('Actual view: '+route,{rows:await b.evaluate(`document.querySelectorAll('.campaign-history-view tbody tr').length`)});
  }
  assert.deepEqual(b.errors,[]);
 });
 for(const [name,a] of [['Marylène',await existingSession(access,25)],['Client B',await actor('Client',1,-94912)]]){
  try{const rows=await a.client.rpc('photo_inventory_read',{p_table:'support_photos',p_filters:{deleted_at:null},p_limit:1000});assert.ifError(rows.error);if(name==='Client B')assert.equal(rows.data.total,0);
   await productionBrowser(a.session,async b=>{if(name==='Client B'){await b.waitFor(`document.querySelector('[data-dashboard-state]')?.dataset.dashboardState==='ready'`,90);assert.equal(await b.evaluate(`Array.from(document.querySelectorAll('aside button')).some(e=>e.textContent.trim()==='Historique')`),false);const h=await a.client.rpc('portal_business_rows',{p_view:'Historique des campagnes',p_offset:0,p_limit:1000});assert(h.error||h.data.total===0);assert.deepEqual(b.errors,[]);return;}await navigation(b,'Historique des campagnes');await b.waitFor(`!!document.querySelector('.campaign-history-view')`,90);await b.waitFor(`!document.querySelector('.campaign-history-view [role=status]')`,90);assert.equal(await b.evaluate(`document.querySelector('.campaign-history-view [role=alert]')?.textContent||''`),'');assert.equal(await b.evaluate(`document.querySelector('.campaign-history-view').textContent.includes('Modifier')`),false);assert.deepEqual(b.errors,[]);});
   pass(name+' actual scoped history and photo isolation');
  }finally{if(name==='Marylène')await a.client.auth.signOut({scope:'local'});}
 }
 evidence.result='PASS';
}catch(error){evidence.result='FAIL';evidence.error=error.message;console.error(error);process.exitCode=1;}
finally{
 const photos=await access.admin.from('support_photos').select('id,original_filename,storage_bucket,storage_path').in('original_filename',names);assert.ifError(photos.error);
 for(const photo of photos.data){assert(names.includes(photo.original_filename));assert.equal(photo.storage_bucket,'support-photos');assert(photo.storage_path.startsWith('review/'));const r=await access.admin.storage.from('support-photos').remove([photo.storage_path]);assert.ifError(r.error);}
 if(photos.data.length){const r=await access.admin.from('support_photos').delete().in('id',photos.data.map(p=>p.id)).in('original_filename',names);assert.ifError(r.error);}
 if(visualId){const r=await access.admin.from('campagne_visuels_formats').delete().eq('id',visualId).eq('nom_visuel',prefix);assert.ifError(r.error);}
 for(const a of actors.reverse())await a.cleanup();evidence.fixturesCleaned=true;save();
}
