import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {preview,createServer} from 'vite';
import {targetedAccess} from './targeted_remote_access.mjs';
import {fixtureSession} from './targeted_test_accounts.mjs';
import {existingSession} from './targeted_existing_session.mjs';
import {managementQuery} from './targeted_management_access.mjs';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
import {productionBrowser} from './targeted_test_browser.mjs';
import {createImportItem} from '../src/lib/massPhotoImport.js';
import {recognizeImportPhoto,importRecognitionCounts} from '../src/lib/photoImportRecognition.js';
let previewServer;if(process.argv.includes('--local')){previewServer=await preview({preview:{host:'127.0.0.1',port:5186,strictPort:true}});process.env.TDM_TEST_PORTAL_ORIGIN='http://127.0.0.1:5186';}
const access=await targetedAccess(),actors=[],prefix='MISSION-'+crypto.randomUUID().slice(0,8).toUpperCase(),photos=[],records=[];
const evidence={at:new Date().toISOString(),prefix,records,origin:process.env.TDM_TEST_PORTAL_ORIGIN||'https://portail.groupetos.com'};
const output='.cache/visual-terrain-stock/external-'+(process.env.TDM_TEST_PORTAL_ORIGIN?'local-live':'production-live')+'.json';
const save=()=>fs.writeFileSync(output,JSON.stringify(evidence,null,2));
const pass=(test,details={})=>{records.push({test,result:'PASS',...details});save();console.log(test+' PASS');};
const actor=async(role,clientId,id)=>{const a=await fixtureSession(access,{role,clientId,profileId:id});actors.push(a);return a;};
let admin,f,vite,appClient;
const rpc=async(client,name,args)=>{const r=await client.rpc(name,args);assert.ifError(r.error);return r.data;};
try{
 admin=await actor('Administrateur',null,-94901);
 const client=await actor('Client',2,-94902),clientAdmin=await actor('Client-Admin',2,-94903),other=await actor('Client',1,-94904);
 f=(await managementQuery(`DO $$DECLARE e bigint;pi bigint;pr bigint;a bigint;b bigint;c bigint;item bigint;v record;BEGIN
 PERFORM set_config('request.jwt.claim.sub','${admin.uid}',true);
 INSERT INTO infrastructures(support_id,client_id,format_affichage,site) VALUES('${prefix}-A',2,'910 x 911','Photo mission controlled fixture'),('${prefix}-B',2,'920 x 921','Photo mission controlled fixture');
 INSERT INTO suivi_des_edt(no_edt,client_id,campagne_id,statut) VALUES('${prefix}-EDT',2,7,'En cours') RETURNING id INTO e;
 INSERT INTO edt_phases(edt_id,client_id,phase_type,nom,date_debut_prevue) VALUES(e,2,'installation','Photo mission','2026-06-01') RETURNING id INTO pi;
 INSERT INTO edt_phases(edt_id,client_id,phase_type,nom,date_debut_prevue) VALUES(e,2,'retrait','Photo mission','2026-06-15') RETURNING id INTO pr;
 INSERT INTO edt_supports(edt_id,phase_id,support_id) VALUES(e,pi,'${prefix}-A'),(e,pr,'${prefix}-A'),(e,pi,'${prefix}-B'),(e,pr,'${prefix}-B');
 INSERT INTO campagne_visuels_formats(campagne_id,client_id,nom_visuel,format_support,actif) VALUES(7,2,'${prefix}-VA','910 x 911',true) RETURNING id INTO a;
 INSERT INTO campagne_visuels_formats(campagne_id,client_id,nom_visuel,format_support,actif) VALUES(7,2,'${prefix}-VB','920 x 921',true) RETURNING id INTO b;
 INSERT INTO campagne_visuels_formats(campagne_id,client_id,nom_visuel,format_support,actif) VALUES(7,2,'${prefix}-VC','920 x 921',true) RETURNING id INTO c;
 FOR v IN SELECT id,nom_visuel,format_support FROM campagne_visuels_formats WHERE id IN (a,b,c) LOOP INSERT INTO repertoire_des_affiches(client_id,nom_detaille_visuel,format,quantite_entrepot,quantite_expo) VALUES(2,v.nom_visuel,v.format_support,100,50) RETURNING id INTO item;UPDATE campagne_visuels_formats SET inventory_item_id=item WHERE id=v.id;END LOOP;
 PERFORM set_config('tdm.photo_fixture',jsonb_build_object('edt',e,'installation',pi,'removal',pr,'visualA',a,'visualB',b,'visualC',c)::text,true);
 END $$;SELECT current_setting('tdm.photo_fixture')::jsonb fixture;`))[0].fixture;evidence.fixture=f;save();
 process.env.VITE_SUPABASE_URL=admin.client.supabaseUrl;process.env.VITE_SUPABASE_ANON_KEY=admin.client.supabaseKey;process.env.VITE_SUPABASE_PUBLISHABLE_KEY=admin.client.supabaseKey;
 vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
 appClient=(await vite.ssrLoadModule('/src/lib/supabaseClient.js')).supabase;
 assert.ifError((await appClient.auth.setSession(admin.session)).error);
 const service=await vite.ssrLoadModule('/src/services/massPhotoImportService.js'),contextService=await vite.ssrLoadModule('/src/services/photoImportContextService.js');
 const catalog=await contextService.loadPhotoImportCatalog();assert(catalog.supports.some(s=>s.support_id===prefix+'-B'));
 const jpeg=Buffer.from(await offlineBrowser('scripts/fixtures/photo-inventory-mission-entry.jsx',async b=>b.evaluate("(()=>{const c=document.createElement('canvas');c.width=16;c.height=16;c.getContext('2d').fillRect(0,0,16,16);return c.toDataURL('image/jpeg').split(',')[1]})()")),'base64');
 function exifPhoto(date,index){const t=Buffer.alloc(64);t.write('II');t.writeUInt16LE(42,2);t.writeUInt32LE(8,4);t.writeUInt16LE(1,8);t.writeUInt16LE(0x8769,10);t.writeUInt16LE(4,12);t.writeUInt32LE(1,14);t.writeUInt32LE(26,18);t.writeUInt16LE(1,26);t.writeUInt16LE(0x9003,28);t.writeUInt16LE(2,30);t.writeUInt32LE(20,32);t.writeUInt32LE(44,36);t.write(date+' 12:00:'+String(index).padStart(2,'0')+'\0',44);const payload=Buffer.concat([Buffer.from('Exif\0\0'),t]),header=Buffer.alloc(4);header.writeUInt16BE(0xffe1);header.writeUInt16BE(payload.length+2,2);return Buffer.concat([jpeg.subarray(0,2),header,payload,jpeg.subarray(2)]);}
 const before=(await access.admin.from('infrastructures').select('support_id,visuel_id,photo_principale_url').in('support_id',[prefix+'-A',prefix+'-B'])).data;
 for(let i=0;i<48;i++){
  const variant=i%6,date=variant===1?'2026:08:01':variant===5?'2026:06:15':'2026:06:01';
  const support=variant===0?'unknown':variant===2||variant===4?'B':'A';
  const bytes=exifPhoto(date,i),file=new File([bytes],`${prefix}-${support}_${i}.jpg`,{type:'image/jpeg',lastModified:Date.now()});
  let item=createImportItem(file,i);if(variant===4)item.manual={type:'inspection'};
  item=await service.analyzePhotoItem(item,{catalog});assert.equal(item.capturedAtSource,'EXIF');assert(item.recognition);
  item=await service.uploadPhotoItem(item,{batchId:prefix});assert(item.resultId);assert.equal(item.error,'');photos.push({...item,variant,bytes});
 }
 evidence.initialCounts=importRecognitionCounts(photos);assert.deepEqual(evidence.initialCounts,{imported:48,automatic:0,ready:8,review:40,unidentified:8,validated:0,errors:0});
 const staged=await rpc(admin.client,'photo_inventory_read',{p_table:'support_photos',p_filters:{import_batch_id:prefix}});assert.equal(staged.total,48);assert(staged.rows.every(p=>p.normalized_filename===null));
 const after=(await access.admin.from('infrastructures').select('support_id,visuel_id,photo_principale_url').in('support_id',[prefix+'-A',prefix+'-B'])).data;assert.deepEqual(after,before);
 for(const p of photos){const original=await admin.client.storage.from('support-photos').download(p.storagePath);assert.ifError(original.error);assert.deepEqual(Buffer.from(await original.data.arrayBuffer()),p.bytes);}
 pass('48 real JPEG originals imported through application services; EXIF, zero byte loss, no draft infrastructure mutation',evidence.initialCounts);
 // Without a generic visual reference, a unique catalog entry still requires confirmation.
 for(const p of photos.filter(p=>[3,5].includes(p.variant))){const manual={visual:f.visualA};const ctx={...p.import_context,manual,recognition:recognizeImportPhoto(p.import_context.input,catalog,manual)};assert(ctx.recognition.ready);await contextService.savePhotoImportContext(p.resultId,ctx);p.recognition=ctx.recognition;}
 for(const p of photos.filter(p=>p.recognition.ready))await contextService.finalizeImportPhoto(p.resultId);
 let movements=await rpc(admin.client,'list_display_movements',{p_support:prefix+'-A'});assert.equal(movements.total,2);assert(movements.rows.every(m=>m.photos.length===8));
 assert.equal((await rpc(admin.client,'list_display_movements',{p_support:prefix+'-B'})).total,0);
 const ambiguous=photos.find(p=>p.variant===2);assert((await admin.client.rpc('finalize_import_photo',{p_photo_id:ambiguous.resultId})).error);
 const unknown=photos[0],manual={support:prefix+'-B',withoutEdt:true,campaign:7,visual:f.visualB};
 const corrected={...unknown.import_context,manual,recognition:recognizeImportPhoto(unknown.import_context.input,catalog,manual)};
 assert(corrected.recognition.ready);await contextService.savePhotoImportContext(unknown.resultId,corrected);await contextService.finalizeImportPhoto(unknown.resultId);
 for(const p of photos.filter(p=>p.variant===2||p.variant===1)){const manual=p.variant===2?{visual:f.visualB}:{type:'inspection'};const ctx={...p.import_context,manual,recognition:recognizeImportPhoto(p.import_context.input,catalog,manual)};assert(ctx.recognition.ready);await contextService.savePhotoImportContext(p.resultId,ctx);await contextService.finalizeImportPhoto(p.resultId);}
 pass('24 initial confirmations, ambiguous rejection, manual support correction and batch confirmation; N photos share one movement');
 const removal=movements.rows.find(m=>m.movement_kind==='retrait');
 await rpc(admin.client,'cancel_display_movement',{p_history_id:removal.history_id,p_kind:'retrait',p_reason:'Controlled test'});
 assert.equal((await rpc(admin.client,'display_current_state',{p_support:prefix+'-A'})).visuel_id,f.visualA);
 assert.equal((await rpc(admin.client,'cancel_display_movement',{p_history_id:removal.history_id,p_kind:'retrait'})).already_cancelled,true);
 const final=await rpc(admin.client,'photo_inventory_read',{p_table:'support_photos',p_filters:{import_batch_id:prefix}});assert.equal(final.total,48);assert.equal(final.rows.filter(p=>p.import_finalized_at).length,41);
 pass('Cancellation replays current state and is idempotent; all 48 photo rows retained',{validated:41,remaining:7});
 for(const [name,a] of [['Client',client],['Client-Admin',clientAdmin]]){
  const raw=await a.client.from('support_photos').select('*').eq('import_batch_id',prefix);assert.ifError(raw.error);assert.equal(raw.data.length,0);
  const projection=await rpc(a.client,'photo_inventory_read',{p_filters:{import_batch_id:prefix}});assert.equal(projection.total,41);assert(!JSON.stringify(projection).includes('@'));
  const inventory=await rpc(a.client,'list_display_movements',{p_support:prefix+'-A',p_cancelled:true});assert(!JSON.stringify(inventory).includes('@'));
  assert((await a.client.rpc('cancel_display_movement',{p_history_id:removal.history_id,p_kind:'retrait'})).error);
  assert((await a.client.rpc('finalize_import_photo',{p_photo_id:unknown.resultId})).error);
  const mutation=await a.client.from('historique_des_campagnes').update({visuel:'FORBIDDEN'}).eq('id',removal.history_id).select();assert(mutation.error||mutation.data.length===0);
  const signature=await a.client.storage.from('support-photos').createSignedUrl(photos[3].storagePath,60);assert.ifError(signature.error);assert.equal((await fetch(signature.data.signedUrl)).status,200);
  pass(name+' raw identity blocked, safe photos/movements, mutations refused, scoped signed original accessible');
 }
 assert.equal((await rpc(other.client,'photo_inventory_read',{p_filters:{import_batch_id:prefix}})).total,0);
 assert.equal((await rpc(other.client,'list_display_movements',{p_support:prefix+'-A'})).total,0);
 assert((await other.client.storage.from('support-photos').createSignedUrl(photos[3].storagePath,60)).error);pass('Client B: zero EXO fixture photos/movements and signed URL denied');
 const marylene=await existingSession(access,25);
 try{const read=await rpc(marylene.client,'photo_inventory_read',{p_filters:{import_batch_id:prefix}});assert.equal(read.total,41);assert(!JSON.stringify(read).includes('@'));pass('Marylène real session: scoped projection without internal author');}finally{await marylene.client.auth.signOut({scope:'local'});}
 const headers={apikey:admin.client.supabaseKey,Authorization:'Bearer '+admin.session.access_token,'Content-Type':'application/json','x-tos-preview-user':'25'};
 const preview=await fetch(admin.client.supabaseUrl+'/rest/v1/rpc/photo_inventory_read',{method:'POST',headers,body:JSON.stringify({p_filters:{import_batch_id:prefix}})});assert.equal(preview.status,200);const previewRows=await preview.json();assert.equal(previewRows.total,41);assert(!JSON.stringify(previewRows).includes('@'));
 const deniedPreview=await fetch(admin.client.supabaseUrl+'/rest/v1/rpc/cancel_display_movement',{method:'POST',headers,body:JSON.stringify({p_history_id:removal.history_id,p_kind:'retrait'})});assert.equal(deniedPreview.status,403);pass('Actual Admin preview header: client projection and write denial');
 for(const [name,a] of [['Admin',admin],['Client',client],['Client-Admin',clientAdmin]])await productionBrowser(a.session,async b=>{
  await b.waitFor("Array.from(document.querySelectorAll('aside button')).some(e=>e.textContent.trim().endsWith('Photos et inventaire')) || document.querySelector('[data-dashboard-state]')?.dataset.dashboardState==='error'",60);
  if(await b.evaluate("document.querySelector('[data-dashboard-state]')?.dataset.dashboardState==='error'")){
   evidence.dashboardRetries=(evidence.dashboardRetries||[]).concat(name);save();
   await b.evaluate("Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()==='Réessayer').click()");
  }
  await b.waitFor("Array.from(document.querySelectorAll('aside button')).some(e=>e.textContent.trim().endsWith('Photos et inventaire'))",90);
  await b.evaluate("Array.from(document.querySelectorAll('aside button')).find(e=>e.textContent.trim().endsWith('Photos et inventaire')).click()");
  await b.waitFor("!!document.querySelector('[aria-label=\"Dossiers photos\"]')",60);
  await b.evaluate("Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()==='Inventaire').click()");
  await b.waitFor("!!document.querySelector('[aria-label=\"Rechercher un mouvement\"]')",30);
  await b.evaluate(`(()=>{const e=document.querySelector('[aria-label="Rechercher un mouvement"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(prefix)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await b.pause(100);
  await b.evaluate("document.querySelector('[aria-label=\"Mouvements d’affiches\"] form button').click()");await b.waitFor(`document.body.innerText.includes('${prefix}-A')`,60);
  assert.equal(await b.evaluate("Array.from(document.querySelectorAll('button')).some(e=>e.textContent==='Supprimer le mouvement')"),name==='Admin');
  assert.deepEqual(b.errors,[]);pass(name+' actual portal inventory, search, role capability');
 });
 evidence.result='PASS';
}catch(error){evidence.result='FAIL';evidence.error=error.message;process.exitCode=1;console.error(error.message);}
finally{
 save();if(appClient)await appClient.auth.signOut({scope:'local'});if(vite)await vite.close();
 if(f){assert.match(prefix,/^MISSION-[A-F0-9]{8}$/);for(const id of Object.values(f))assert(Number.isSafeInteger(id));
  const rows=await access.admin.from('support_photos').select('storage_path').eq('import_batch_id',prefix);assert.ifError(rows.error);
  const paths=rows.data.map(p=>{assert(p.storage_path.startsWith('review/'+prefix+'/'));return p.storage_path;});if(paths.length)assert.ifError((await access.admin.storage.from('support-photos').remove(paths)).error);
  await managementQuery(`DO $$BEGIN PERFORM set_config('request.jwt.claim.sub','${admin.uid}',true);
   UPDATE repertoire_des_affiches SET last_movement_id=null WHERE nom_detaille_visuel LIKE '${prefix}-%';DELETE FROM inventory_movements WHERE support_id IN ('${prefix}-A','${prefix}-B');DELETE FROM support_photos WHERE import_batch_id='${prefix}';DELETE FROM historique_des_campagnes WHERE support_id IN ('${prefix}-A','${prefix}-B');DELETE FROM tdm_private.display_baselines WHERE support_id IN ('${prefix}-A','${prefix}-B');DELETE FROM edt_supports WHERE edt_id=${f.edt};DELETE FROM infrastructures WHERE support_id IN ('${prefix}-A','${prefix}-B') AND site='Photo mission controlled fixture';DELETE FROM campagne_visuels_formats WHERE id IN (${f.visualA},${f.visualB},${f.visualC}) AND nom_visuel LIKE '${prefix}-%';DELETE FROM repertoire_des_affiches WHERE nom_detaille_visuel LIKE '${prefix}-%';DELETE FROM edt_phases WHERE id IN (${f.installation},${f.removal});DELETE FROM suivi_des_edt WHERE id=${f.edt} AND no_edt='${prefix}-EDT';END $$;`);evidence.fixtureCleaned=true;
 }
 for(const a of actors.reverse())await a.cleanup();await previewServer?.close();save();
}
