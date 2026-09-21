import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {targetedAccess} from './targeted_remote_access.mjs';
import {existingSession} from './targeted_existing_session.mjs';
import {productionBrowser} from './targeted_test_browser.mjs';
import {preview} from 'vite';
let server;if(process.argv.includes('--local')){server=await preview({preview:{host:'127.0.0.1',port:5184,strictPort:true}});process.env.TDM_TEST_PORTAL_ORIGIN='http://127.0.0.1:5184';}
const access=await targetedAccess(),actor=await existingSession(access,1),clientAdmin=await existingSession(access,25),prefix='review/workflow-'+crypto.randomUUID(),ids=[];
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=','base64');
async function remove(chosen){if(!chosen.length)return;const begin=await actor.client.rpc('delete_review_photos',{p_ids:chosen,p_finish:false});assert.ifError(begin.error);assert.equal(begin.data.length,chosen.length);assert(begin.data.every(p=>p.storage_bucket==='support-photos'&&p.storage_path.startsWith(prefix+'/')));const storage=await actor.client.storage.from('support-photos').remove(begin.data.map(p=>p.storage_path));assert.ifError(storage.error);const finish=await actor.client.rpc('delete_review_photos',{p_ids:chosen,p_finish:true});assert.ifError(finish.error);}
try{
 for(let n=0;n<20;n++){const path=prefix+'/'+n+'.png',name=prefix.split('/')[1]+'-'+n+'.png';const uploaded=await actor.client.storage.from('support-photos').upload(path,png,{contentType:'image/png'});assert.ifError(uploaded.error);const row=await actor.client.from('support_photos').insert({source:'mass_import',statut_validation:'À valider',review_status:'unmatched',storage_bucket:'support-photos',storage_path:path,nom_fichier:name,original_filename:name}).select('id').single();assert.ifError(row.error);ids.push(row.data.id);}
 const denied=await clientAdmin.client.rpc('delete_review_photos',{p_ids:ids.slice(0,1),p_finish:false});assert(denied.error);
 if(process.argv.includes('--browser'))await productionBrowser(actor.session,async b=>{
  await b.waitFor("[...document.querySelectorAll('aside button')].some(e=>e.textContent.trim().endsWith('Photos et inventaire'))",90);
  await b.evaluate("[...document.querySelectorAll('aside button')].find(e=>e.textContent.trim().endsWith('Photos et inventaire')).click()");
  await b.waitFor("[...document.querySelectorAll('.editor-tabs button')].some(e=>e.textContent.includes('Photos à valider'))");
  await b.evaluate("[...document.querySelectorAll('.editor-tabs button')].find(e=>e.textContent.includes('Photos à valider')).click()");
  await b.waitFor("!!document.querySelector('.review-toolbar input:not([type=checkbox])')");
  await b.evaluate(`(()=>{const e=document.querySelector('.review-toolbar input:not([type=checkbox])');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(prefix.split('/')[1])});e.dispatchEvent(new Event('input',{bubbles:true}));const s=[...document.querySelectorAll('.review-toolbar select')].find(e=>[...e.options].some(o=>o.value==='oldest'));Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'oldest');s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await b.waitFor("document.querySelector('[aria-label=\"Actions sur la sélection\"]').textContent.includes('(20)')",90);
  await b.evaluate("document.querySelector('[aria-label=\"Tout sélectionner\"]').click()");await b.waitFor("document.querySelector('[aria-label=\"Actions sur la sélection\"]').textContent.includes('20 sélectionnée(s)')");await b.evaluate("document.querySelector('[aria-label=\"Tout sélectionner\"]').click()");
  for(const id of ids.slice(0,5))await b.evaluate(`document.querySelector('[data-photo-id="${id}"] input[type=checkbox]').click()`);
  await b.evaluate("window.confirm=message=>{window.confirmation=message;return false};[...document.querySelectorAll('button')].find(e=>e.textContent==='Supprimer les photos sélectionnées').click()");assert.equal(await b.evaluate('window.confirmation'),'Supprimer 5 photos sélectionnées ?');
  const unchanged=await actor.client.from('support_photos').select('id').in('id',ids);assert.ifError(unchanged.error);assert.equal(unchanged.data.length,20);
  await b.evaluate("window.confirm=()=>true;const e=[...document.querySelectorAll('button')].find(e=>e.textContent==='Supprimer les photos sélectionnées');e.click();e.click()");
  await b.waitFor("document.querySelector('.photo-review-queue').textContent.includes('5 photos supprimées')",90);assert.deepEqual(b.errors,[]);
 });else await remove(ids.slice(0,5));
 const rows=await actor.client.from('support_photos').select('id').in('id',ids);assert.ifError(rows.error);assert.deepEqual(rows.data.map(r=>r.id).sort((a,b)=>a-b),ids.slice(5));const storage=await access.admin.storage.from('support-photos').list(prefix);assert.ifError(storage.error);assert.equal(storage.data.length,15);assert(storage.data.every(p=>Number(p.name.split('.')[0])>=5));
 const protectedIds=JSON.parse(fs.readFileSync('.cache/visual-terrain-stock/requested-review-cleanup-selection.json')).ids;const originals=await access.admin.from('support_photos').select('id',{count:'exact',head:true}).in('id',protectedIds);assert.ifError(originals.error);assert.equal(originals.count,204);
 fs.writeFileSync('.cache/visual-terrain-stock/storage-batch.json',JSON.stringify({result:'PASS',created:20,selectedDeleted:5,remaining:15,clientAdminDenied:true,originalsPreserved:204,at:new Date().toISOString()},null,2));console.log('PASS: 20 originals de test, 5 suppressions DB + Storage, 15 conservés, refus Client-Admin et 204 photos utilisateur intactes');
}finally{const rows=await access.admin.from('support_photos').select('id').in('id',ids);assert.ifError(rows.error);await remove(rows.data.map(r=>r.id));await actor.client.auth.signOut({scope:'local'});await clientAdmin.client.auth.signOut({scope:'local'});await server?.close();}
