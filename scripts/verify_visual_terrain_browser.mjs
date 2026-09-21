import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {targetedAccess} from './targeted_remote_access.mjs';
import {fixtureSession} from './targeted_test_accounts.mjs';
import {existingSession} from './targeted_existing_session.mjs';
import {managementQuery} from './targeted_management_access.mjs';
import {preview} from 'vite';
import {productionBrowser} from './targeted_test_browser.mjs';
let previewServer;if(process.argv.includes('--local')){previewServer=await preview({preview:{host:'127.0.0.1',port:5186,strictPort:true}});process.env.TDM_TEST_PORTAL_ORIGIN='http://127.0.0.1:5186';}
const records=[],actors=[],access=await targetedAccess();
const origin=process.env.TDM_TEST_PORTAL_ORIGIN||'https://portail.groupetos.com';
const label=process.env.TDM_TEST_PORTAL_ORIGIN?'local-live':'production';
const file=`.cache/visual-terrain-stock/terrain-${label}.json`;
const evidence={origin,at:new Date().toISOString(),records};
const support='TARGETED-'+crypto.randomUUID().slice(0,8).toUpperCase();let f,admin,installer;
const save=()=>fs.writeFileSync(file,JSON.stringify(evidence,null,2));
const pass=(test,details={})=>{records.push({test,result:'PASS',...details});save();console.log(test+' PASS');};
async function actor(role,clientId,id){const a=await fixtureSession(access,{role,clientId,profileId:id});actors.push(a);return a;}
try{
 admin=await actor('Administrateur',null,-93901);installer=await actor('Installateur',2,-93902);
 const client=await actor('Client',2,-93903),other=await actor('Client',1,-93904),clientAdmin=await actor('Client-Admin',2,-93905);
 f=(await managementQuery(`DO $$DECLARE s bigint;e bigint;e2 bigint;p bigint;p2 bigint;v bigint;item bigint;BEGIN
 perform set_config('request.jwt.claim.sub','${admin.uid}',true);
 insert into infrastructures(support_id,client_id,format_affichage,type_support,site) values('${support}',2,'12,7 x 34,25 Portrait','Cadre','Targeted controlled fixture') returning id into s;
 insert into suivi_des_edt(no_edt,client_id,campagne_id,statut) values('${support}-EDT-1',2,7,'En cours') returning id into e;
 insert into suivi_des_edt(no_edt,client_id,campagne_id,statut) values('${support}-EDT-2',2,7,'En cours') returning id into e2;
 insert into edt_phases(edt_id,client_id,phase_type,nom,statut) values(e,2,'installation','Targeted test','en_cours') returning id into p;
 insert into edt_phases(edt_id,client_id,phase_type,nom,statut) values(e2,2,'installation','Targeted test','en_cours') returning id into p2;
 insert into campagne_visuels_formats(campagne_id,client_id,nom_visuel,format_support,actif,is_out_of_frame) values(7,2,'${support}','12,7 x 34,25',true,false) returning id into v;
 insert into repertoire_des_affiches(client_id,nom_detaille_visuel,format,quantite_entrepot,quantite_expo) values(2,'${support}','12,7 x 34,25',100,50) returning id into item;
 update campagne_visuels_formats set inventory_item_id=item where id=v;
 perform set_config('tdm.targeted.fixture',jsonb_build_object('supportId',s,'edtId',e,'edt2Id',e2,'phaseId',p,'phase2Id',p2,'visualId',v,'itemId',item)::text,true);
 END $$;select current_setting('tdm.targeted.fixture')::jsonb fixture;`))[0].fixture;
 evidence.fixture={support,...f};save();
 for(const links of [[{phase_id:f.phaseId,date_debut:'2026-01-01',date_fin:'2026-01-31'}],[{phase_id:f.phaseId,date_debut:'2026-01-01',date_fin:'2026-01-31'},{phase_id:f.phase2Id,date_debut:'2026-02-01',date_fin:'2026-02-28'}],[{phase_id:f.phase2Id,date_debut:'2026-03-01',date_fin:'2026-03-31'}]]){
  const r=await admin.client.rpc('save_visual_edt_associations',{p_visual_id:f.visualId,p_links:links});assert.ifError(r.error);assert.equal(r.data.ok,true);
  const read=await admin.client.from('visual_edt_associations').select('*').eq('visual_id',f.visualId);assert.ifError(read.error);assert.equal(read.data.length,links.length);
 }
 pass('Real API multi-EDT add, modify dates and remove association');
 await productionBrowser(installer.session,async b=>{
  await b.waitFor("!!document.querySelector('.terrain-inline input')",90);
  const select=async(selector,value)=>{await b.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await b.pause(100);};
  for(const mode of ['normal','without','inspection','enjeu','resolution_enjeu','retrait']){
   await b.evaluate(`(()=>{const e=document.querySelector('.terrain-inline input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(support)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
   await b.waitFor(`Array.from(document.querySelectorAll('.terrain-suggestions button')).some(e=>e.textContent.includes('${support}'))`);
   await b.evaluate(`Array.from(document.querySelectorAll('.terrain-suggestions button')).find(e=>e.textContent.includes('${support}')).click()`);await b.pause(500);
   await select('form select', ['normal','without'].includes(mode)?'installation':mode);
   if(mode==='normal'){
    assert.equal(await b.evaluate("document.querySelector('input[type=checkbox]').checked"),false);
    await b.waitFor(`Array.from(document.querySelectorAll('form select option')).some(o=>o.value==='${f.phase2Id}')`);
    await select('form select:nth-of-type(1)', 'installation');
    await b.evaluate(`Array.from(document.querySelectorAll('form select')).find(s=>Array.from(s.options).some(o=>o.value==='${f.phase2Id}')).setAttribute('data-phase','')`);await select('[data-phase]',f.phase2Id);
   }else if(mode==='without'){await b.evaluate("document.querySelector('input[type=checkbox]').click()");await b.pause(150);}
   if(['normal','without'].includes(mode)){
    await b.waitFor(`Array.from(document.querySelectorAll('form select option')).some(o=>o.value==='${f.visualId}')`);
    await b.evaluate(`Array.from(document.querySelectorAll('form select')).find(s=>Array.from(s.options).some(o=>o.value==='${f.visualId}')).setAttribute('data-visual','')`);await select('[data-visual]',f.visualId);
   }
   if(mode==='resolution_enjeu')await b.waitFor("[...document.querySelectorAll('form select')].some(s=>s.options.length===2&&s.value)");
   if(mode==='enjeu'){
    assert.equal(await b.evaluate("document.body.textContent.includes('Contexte EDT / phase')"),false);
    await b.waitFor("[...document.querySelectorAll('form select')].some(s=>s.options.length===12)");
    await b.evaluate("(()=>{const e=[...document.querySelectorAll('form select')].find(s=>s.options.length===12);Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,e.options[1].value);e.dispatchEvent(new Event('change',{bubbles:true}));})()");
   }
   await b.evaluate(`(()=>{const d=new DataTransfer();d.items.add(new File([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII='),x=>x.charCodeAt(0))],'${mode}.png',{type:'image/png'}));const e=document.querySelector('input[type=file]');e.files=d.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await b.pause(100);
   await b.evaluate("document.querySelector('form button[type=submit]').click()");await b.waitFor("!!document.querySelector('.terrain-message.success,.terrain-message.error')",90);
   assert(await b.evaluate("!!document.querySelector('.terrain-message.success')"),await b.evaluate("document.querySelector('.terrain-message').textContent"));
   pass('Real Terrain browser '+mode);
  }
  assert.deepEqual(b.errors,[]);
 },{mobile:true});
 const photos=await admin.client.from('support_photos').select('*').eq('support_id',support).order('id');assert.ifError(photos.error);assert.equal(photos.data.length,6);
 assert.equal(photos.data[0].edt_id,String(f.edt2Id));assert.equal(photos.data[1].metadata.installation_sans_edt,true);assert.equal(photos.data[1].edt_id,null);
 for(const [name,a] of [['Client',client],['Client-Admin',clientAdmin]]){
  const p=await a.client.from('support_photos').select('*').eq('support_id',support);assert.ifError(p.error);assert.equal(p.data.length,0); const safe=await a.client.rpc('photo_inventory_read',{p_table:'support_photos',p_filters:{support_id:support}});assert.ifError(safe.error);assert.equal(safe.data.total,6);assert(!JSON.stringify(safe.data).includes('@'));
  const mutation=await a.client.from('support_photos').update({nom_fichier:'forbidden'}).eq('id',photos.data[0].id).select();assert(mutation.error||mutation.data.length===0);
  const sign=await a.client.storage.from('terrain-photos').createSignedUrl(photos.data[1].storage_path,60);assert.ifError(sign.error);assert.equal((await fetch(sign.data.signedUrl)).status,200);
  pass(name+' reads scoped private photos and cannot modify them');
 }
 const otherPhotos=await other.client.from('support_photos').select('id').eq('support_id',support);assert.ifError(otherPhotos.error);assert.equal(otherPhotos.data.length,0);
 const denied=await other.client.storage.from('terrain-photos').createSignedUrl(photos.data[1].storage_path,60);assert(denied.error);pass('Client B has zero EXO photos and signing denied');
 for(const [name,a] of [['Marylène',await existingSession(access,25)],['Client',client],['Admin',admin]]){
  try{const summary=await a.client.rpc('portal_dashboard_summary');assert.ifError(summary.error);assert.equal(summary.data.kpis.marketing_active,17);assert.equal(summary.data.kpis.operational_active,6);
  await productionBrowser(a.session,async b=>{
   await b.waitFor("['ready','error'].includes(document.querySelector('[data-dashboard-state]')?.dataset.dashboardState)",90);
   if(await b.evaluate("document.querySelector('[data-dashboard-state]')?.dataset.dashboardState==='error'")){
    evidence.dashboardRetries=(evidence.dashboardRetries||[]).concat(name);save();
    await b.evaluate("Array.from(document.querySelectorAll('button')).find(x=>x.textContent.trim()==='Réessayer').click()");
   }
   await b.waitFor("document.querySelector('[data-dashboard-state]')?.dataset.dashboardState==='ready'",60);
   assert.equal(await b.evaluate("document.querySelector('[data-kpi=marketing_active] strong').textContent"),'17');
   await b.evaluate("Array.from(document.querySelectorAll('aside button')).find(x=>x.textContent.trim().endsWith('Photos et inventaire')).click()");
   await b.waitFor("!!document.querySelector('[aria-label=\"Dossiers photos\"]')",60);
   for(const folder of [support+'-EDT-2','Inspections','Supports avec enjeux','Installation sans EDT']){
    await b.waitFor(`!!document.querySelector('[aria-label="Ouvrir ${folder}"]')`,60);
    await b.evaluate(`document.querySelector('[aria-label="Ouvrir ${folder}"]').click()`);await b.waitFor("document.querySelectorAll('.photo-review-image img').length>0",60);
    await b.waitFor("Array.from(document.querySelectorAll('.photo-review-image img')).some(i=>i.naturalWidth>0)",30);
    assert.equal(await b.evaluate("!!document.querySelector('.photo-review-actions')"),name==='Admin');
    await b.evaluate("Array.from(document.querySelectorAll('button')).find(x=>x.textContent.trim()==='Tous les dossiers').click()");
   }
   if(name==='Admin'){
    await b.evaluate("[...document.querySelectorAll('aside button')].find(e=>e.textContent.trim().endsWith('Infrastructures')).click()");
    await b.waitFor("!!document.querySelector('[aria-label=\"Recherche globale — Infrastructures\"]')",90);
    await b.evaluate(`(()=>{const e=document.querySelector('[aria-label="Recherche globale — Infrastructures"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(support)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await b.waitFor(`[...document.querySelectorAll('.professional-grid tbody tr')].some(r=>r.textContent.includes('${support}'))`);
    await b.evaluate(`[...document.querySelectorAll('.professional-grid tbody tr')].find(r=>r.textContent.includes('${support}')).click()`);
    await b.waitFor("!!document.querySelector('.support360-module')");
    await b.evaluate("[...document.querySelectorAll('.support360-tabs button')].find(e=>e.textContent==='Enjeux et inspections').click()");
    await b.waitFor("document.querySelectorAll('.support360-module article img').length===2",60);
    await b.waitFor("[...document.querySelectorAll('.support360-module article img')].every(i=>i.complete&&i.naturalWidth>0)");
    assert(await b.evaluate("document.querySelector('.support360-module').textContent.includes('Résolu le')"));
    pass('Actual Infrastructure 360: issue and resolution originals displayed, resolved date visible');
   }
   assert.deepEqual(b.errors,[]);
  });pass(name+' actual dashboard, four photo folders, private images and capabilities');
  }finally{if(name==='Marylène')await a.client.auth.signOut({scope:'local'});}
 }
 evidence.result='PASS';
}catch(e){evidence.result='FAIL';evidence.error=e.message;console.error(e.message);process.exitCode=1;}
finally{
 save();
 if(f){
  assert.match(support,/^TARGETED-[A-F0-9]{8}$/);for(const id of Object.values(f))assert(Number.isSafeInteger(id));
  const verified=(await managementQuery('select id from infrastructures where id=$1 and support_id=$2 and site=$3',[f.supportId,support,'Targeted controlled fixture']));assert.equal(verified.length,1);
  const ps=await access.admin.from('support_photos').select('storage_path,storage_bucket').eq('support_id',support);assert.ifError(ps.error);
  const paths=ps.data.map(p=>{assert.equal(p.storage_bucket,'terrain-photos');assert(p.storage_path.startsWith('supports/'+support+'/'));return p.storage_path;});
  if(paths.length){const remove=await access.admin.storage.from('terrain-photos').remove(paths);assert.ifError(remove.error);}
  await managementQuery(`DO $$BEGIN perform set_config('request.jwt.claim.sub','${admin.uid}',true);
  update repertoire_des_affiches set last_movement_id=null where id=${f.itemId};delete from inventory_movements where support_id='${support}';delete from enjeux_terrain where support_id='${support}';delete from inspections_terrain where support_id='${support}';delete from support_photos where support_id='${support}';delete from tdm_private.display_baselines where support_id='${support}';delete from historique_des_campagnes where support_id='${support}';delete from terrain_operations where support_id='${support}';delete from support_photos where support_id='${support}';delete from infrastructures where id=${f.supportId} and support_id='${support}';delete from campagne_visuels_formats where id=${f.visualId} and nom_visuel='${support}';delete from repertoire_des_affiches where id=${f.itemId} and nom_detaille_visuel='${support}';delete from edt_phases where id in (${f.phaseId},${f.phase2Id});delete from suivi_des_edt where id in (${f.edtId},${f.edt2Id});END $$;`);
  evidence.fixtureCleaned=true;
 }
 for(const a of actors.reverse())await a.cleanup();await previewServer?.close();save();
}
