import { supabase } from '../lib/supabaseClient';
import { prepareAndUploadPhoto, insertPhotoWithRollback } from './photoWorkflowService.js';
import { clampImportOptions, manifestItem, prepareImportItem, readExifDate, sha256File } from '../lib/massPhotoImport.js';
import { uploadUnmatchedPhoto } from './photoReviewService.js';

const DB_NAME='tos-mass-photo-import', STORE='manifests';
export const saveImportManifest = manifest => new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,1);request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'id'});request.onerror=()=>reject(request.error);request.onsuccess=()=>{const tx=request.result.transaction(STORE,'readwrite');tx.objectStore(STORE).put({...manifest,items:manifest.items.map(manifestItem),updatedAt:new Date().toISOString()});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)}});
export const loadImportManifest = id => new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,1);request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'id'});request.onerror=()=>reject(request.error);request.onsuccess=()=>{const get=request.result.transaction(STORE).objectStore(STORE).get(id);get.onsuccess=()=>resolve(get.result||null);get.onerror=()=>reject(get.error)}});
export const listImportManifests = () => new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,1);request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'id'});request.onerror=()=>reject(request.error);request.onsuccess=()=>{const get=request.result.transaction(STORE).objectStore(STORE).getAll();get.onsuccess=()=>resolve((get.result||[]).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))));get.onerror=()=>reject(get.error)}});

async function confirmedDuplicate(item) {
  if(!supabase || (!item.hash && !item.storagePath)) return false;
  let query=supabase.from('support_photos').select('id').eq('support_id',item.supportId).limit(1);
  query=item.hash?query.contains('metadata',{sha256:item.hash}):query.eq('storage_path',item.storagePath);
  const {data,error}=await query;if(error)throw error;return Boolean(data?.length);
}

export async function analyzePhotoItem(item, context={}) {
  let next={...item,status:'validating',error:''};
  if(!/^image\/(jpeg|png|webp|heic|heif)$/i.test(next.mimeType||'')) return {...next,status:'failed',error:'FORMAT_INVALID'};
  try{const exif=await readExifDate(next.file);if(exif)next={...next,capturedAt:exif.capturedAt,capturedAtSource:'exif',exifTag:exif.tag};next.hash=await sha256File(next.file);next=prepareImportItem(next,context);if(next.status==='ready'&&await confirmedDuplicate(next))next={...next,status:'duplicate',error:'DUPLICATE_CONFIRMED'};return next}catch(error){return {...next,status:'failed',error:error.message||'VALIDATION_FAILED'}}
}

export async function uploadPhotoItem(item, context={}) {
  if(!item.supportId){const row=await uploadUnmatchedPhoto(item,context);return{...item,status:'completed',reviewStatus:'unmatched',storagePath:row.storage_path,resultId:row.id,error:'',file:null}}
  const uploaded=await prepareAndUploadPhoto(item.file,{...context,supportId:item.supportId,capturedAt:item.capturedAt,explicitType:item.explicitType,
    type:item.type,sequence:item.sequence,campaignId:item.campaignId,edtId:item.edtId,metadata:{sha256:item.hash}},'support-photos');
  const row=await insertPhotoWithRollback(uploaded,{...context,supportId:item.supportId,capturedAt:item.capturedAt,campaignId:item.campaignId,edtId:item.edtId,
    source:'mass_import',metadata:{sha256:item.hash,import_batch_id:context.batchId,captured_at_source:item.capturedAtSource,exif_tag:item.exifTag||null}});
  return {...item,status:'completed',storagePath:uploaded.storagePath,normalizedFilename:uploaded.normalizedFilename,resultId:row.id,error:'',file:null};
}

export async function runControlledQueue(items, worker, options={}, callbacks={}) {
  const {concurrency,batchSize}=clampImportOptions(options);let paused=false,cancelled=false,index=0;
  const control={pause:()=>{paused=true},resume:()=>{paused=false;callbacks.onResume?.()},cancel:()=>{cancelled=true;for(let i=index;i<items.length;i++)if(['queued','ready','failed'].includes(items[i].status))items[i]={...items[i],status:'cancelled',error:'CANCELLED'}},get paused(){return paused}};
  const run=(async()=>{for(let start=0;start<items.length&&!cancelled;start+=batchSize){const batch=items.slice(start,start+batchSize);index=start;
    const lanes=Array.from({length:Math.min(concurrency,batch.length)},async()=>{while(index<start+batch.length&&!cancelled){while(paused&&!cancelled)await new Promise(resolve=>setTimeout(resolve,100));const current=index++;if(cancelled)break;await worker(items[current],current)}});await Promise.all(lanes);callbacks.onBatch?.(items)}return items})();
  return {control,run};
}
