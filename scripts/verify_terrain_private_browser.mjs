import assert from 'node:assert/strict';import fs from 'node:fs';import {offlineBrowser} from './lib/offlineBrowser.mjs';
import JSZip from 'jszip';
const records=[];const pass=name=>records.push({name,result:'PASS_LOCAL'});
await offlineBrowser('scripts/fixtures/private-photo-entry.jsx',async({evaluate,waitFor,exceptions,consoleErrors})=>{
 const run=async expression=>{await evaluate('run('+JSON.stringify(expression)+')');await waitFor('result!==null');return evaluate('result')};
 const old='https://fixture.invalid/storage/v1/object/public/terrain-photos/EXO-2/photo%20terrain.jpg';
 for(const photo of [old,{photo_url:old},{thumbnail_url:old},{storage_path:old},{photo_principale_url:old},{photo_miniature_url:old},'terrain-photos/EXO-2/photo terrain.jpg',{storage_bucket:'terrain-photos',storage_path:'EXO-2/photo terrain.jpg'},{storage_bucket:'support-photos',storage_path:'EXO-2/photo terrain.jpg',photo_url:'terrain-photos/EXO-2/photo terrain.jpg'}]){
  await evaluate('access.clearSignedPhotoUrlCache();mount('+JSON.stringify(photo)+')');await waitFor('Boolean(document.querySelector("img"))');
  assert.equal(await evaluate('photoFixture.calls.at(-1).bucket'),'terrain-photos');assert.equal(await evaluate('photoFixture.calls.at(-1).path'),'EXO-2/photo terrain.jpg');
  assert.equal(await evaluate('document.querySelector("img").src.includes("/public/")'),false);pass('legacy/canonical '+JSON.stringify(photo));
 }
 for(const purpose of ['preview','download','report']){
  const r=await run(`access.getSignedPhotoUrl('terrain-photos/EXO-2/ttl.jpg',{purpose:'${purpose}',force:true})`);assert.ok(r.value);assert.equal(await evaluate('photoFixture.calls.at(-1).ttl'),{preview:300,download:120,report:900}[purpose]);pass('TTL '+purpose);
 }
 await run("access.getSignedPhotoUrl('terrain-photos/EXO-2/cache.jpg')");const count=await evaluate('photoFixture.calls.length');await run("access.getSignedPhotoUrl('terrain-photos/EXO-2/cache.jpg')");assert.equal(await evaluate('photoFixture.calls.length'),count);pass('cache reused before expiry');
 await evaluate('photoFixture.offset=301000');await run("access.getSignedPhotoUrl('terrain-photos/EXO-2/cache.jpg')");assert.equal(await evaluate('photoFixture.calls.length'),count+1);pass('expired cache renewed');
 for(const ref of ['terrain-photos/EXO-2/../B.jpg','terrain-photos/EXO-2/%2e%2e/B.jpg','https://untrusted.invalid/raw.jpg','other-bucket/a.jpg']){
  const r=await run('access.getSignedPhotoUrl('+JSON.stringify(ref)+')');
  // An unprefixed relative path belongs to the historical support bucket, never another bucket.
  if(ref==='other-bucket/a.jpg')assert.equal(await evaluate('photoFixture.calls.at(-1).bucket'),'support-photos');else assert.ok(r.error);pass('path guard '+ref);
 }
 await evaluate("photoFixture.deny=true;access.clearSignedPhotoUrlCache();mount('terrain-photos/EXO-2/denied.jpg')");await waitFor('!document.querySelector("img")');pass('denied image has no public fallback');
 await evaluate('photoFixture.deny=false;window.dispatchEvent(new Event("online"))');await waitFor('Boolean(document.querySelector("img"))');pass('online recovery');
 await evaluate('photoFixture.deny=true;photoFixture.offset+=301000;window.dispatchEvent(new Event("focus"))');await waitFor('!document.querySelector("img")');pass('failed renewal hides expired image');
 await evaluate('photoFixture.deny=false;photoFixture.hold=true');await evaluate("run(\"access.getSignedPhotoUrl('terrain-photos/EXO-2/race.jpg',{force:true})\")");await waitFor('photoFixture.pending.length>0');await evaluate('access.clearSignedPhotoUrlCache();photoFixture.hold=false;photoFixture.pending.splice(0).forEach(resolve=>resolve())');await waitFor('result!==null');assert.match(await evaluate('result.error'),/Session photo/);pass('session/client race discarded');
 const photo={id:1,support_id:'EXO-2',storage_bucket:'terrain-photos',storage_path:'EXO-2/scoped.jpg',signed_thumbnail_url:'transient-marker'};
 await evaluate('mount('+JSON.stringify(photo)+',"preview")');await waitFor('Boolean(document.querySelector(".support-gallery img"))');assert.equal(await evaluate('photoFixture.calls.at(-1).path'),'EXO-2/scoped.jpg');pass('Admin preview 360 uses only target rows, no internal loader');
 const uploaded=await run("uploadPhoto(new File(['x'],'photo.jpg',{type:'image/jpeg'}),{supportId:'EXO-2',type:'inspection'},'terrain-photos')");assert.ok(uploaded.value.storageReference.startsWith('terrain-photos/supports/EXO-2/'));assert.equal(uploaded.value.publicUrl,undefined);pass('upload persists canonical reference');
 const row=await evaluate('photoHistoryRow('+JSON.stringify(uploaded.value)+',{supportId:"EXO-2"})');assert.equal(row.photo_url,null);assert.equal(row.thumbnail_url,null);assert.equal(row.storage_bucket,'terrain-photos');pass('metadata contains no temporary URL');
 const xlsx=await run('exportXlsx("private.xlsx",[{support_id:"EXO-2",photo_principale_url:'+JSON.stringify(old)+'}],["support_id"])');assert.equal(xlsx.error,undefined);
 await evaluate('window.fileBytes=null;photoFiles.at(-1).arrayBuffer().then(buffer=>fileBytes=btoa(String.fromCharCode(...new Uint8Array(buffer))))');await waitFor('fileBytes!==null');
 const workbook=await JSZip.loadAsync(Buffer.from(await evaluate('fileBytes'),'base64'));assert.ok(Object.keys(workbook.files).some(name=>name.startsWith('xl/media/image')));pass('actual XLSX embeds signed Terrain image from legacy URL');
 await evaluate('photoFiles=[];mountExport({id:1,support_id:"EXO-2",nom_fichier:"terrain.png",photo_url:'+JSON.stringify(old)+'})');await waitFor('[...document.querySelectorAll("button")].some(b=>b.textContent.includes("Télécharger le ZIP autorisé"))');
 await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent.includes("Télécharger le ZIP autorisé")).click()');await waitFor('photoFiles.length>0');
 await evaluate('fileBytes=null;photoFiles.at(-1).arrayBuffer().then(buffer=>fileBytes=btoa(String.fromCharCode(...new Uint8Array(buffer))))');await waitFor('fileBytes!==null');
 const zip=await JSZip.loadAsync(Buffer.from(await evaluate('fileBytes'),'base64'));assert.ok(Object.keys(zip.files).some(name=>name.endsWith('terrain.png')));assert.equal(await evaluate('photoFixture.calls.at(-1).ttl'),120);pass('actual ZIP signs URL-only legacy row before download');
 const pdf=await run('generatePhotoPdf({support_id:"EXO-2",photo_url:'+JSON.stringify(old)+'})');
 assert.equal(pdf.error,undefined);assert.match(pdf.value,/\/Subtype \/Image/);assert.equal(await evaluate('photoFixture.calls.at(-1).ttl'),900);pass('actual EDT PDF embeds signed Terrain image');
 await evaluate('photoFixture.deny=true;access.clearSignedPhotoUrlCache()');
 const deniedPdf=await run('generatePhotoPdf({support_id:"EXO-2",photo_url:'+JSON.stringify(old)+'})');
 assert.match(deniedPdf.error,/Access denied/);pass('EDT PDF refuses inaccessible photo without public fallback');
 assert.deepEqual(exceptions,[]);assert.deepEqual(consoleErrors,[]);
},{realServices:['photoAccessService.js','photoWorkflowService.js','finalReportService.js'],supabaseSource:`export const supabaseConfigured=true;export const supabase={storage:{from:bucket=>({createSignedUrl:(...args)=>window.signPhoto(bucket,...args),list:async()=>({data:[]}),upload:async()=>({error:null})})}};`});
fs.writeFileSync('docs/stabilization-local/certification/remote/photo-private/browser-local.json',JSON.stringify({records,total:records.length},null,2));console.log(records.length+' private photo browser cases PASS');
