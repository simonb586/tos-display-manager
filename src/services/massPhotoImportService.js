import {readExifGps} from '../lib/exifGps';
import { clampImportOptions, manifestItem, readExifDate, sha256File } from '../lib/massPhotoImport.js';
import { uploadUnmatchedPhoto } from './photoReviewService.js';
import {importContextForPhoto,savePhotoImportContext} from './photoImportContextService';
import {recognizeVisualReferences} from './visualReferenceRecognitionService';
import {readFrameIdentifier} from './frameIdentifierOcrService';

const DB_NAME='tos-mass-photo-import', STORE='manifests';
export const saveImportManifest = manifest => new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,1);request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'id'});request.onerror=()=>reject(request.error);request.onsuccess=()=>{const tx=request.result.transaction(STORE,'readwrite');tx.objectStore(STORE).put({...manifest,items:manifest.items.map(manifestItem),updatedAt:new Date().toISOString()});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)}});
export const loadImportManifest = id => new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,1);request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'id'});request.onerror=()=>reject(request.error);request.onsuccess=()=>{const get=request.result.transaction(STORE).objectStore(STORE).get(id);get.onsuccess=()=>resolve(get.result||null);get.onerror=()=>reject(get.error)}});
export const listImportManifests = () => new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,1);request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'id'});request.onerror=()=>reject(request.error);request.onsuccess=()=>{const get=request.result.transaction(STORE).objectStore(STORE).getAll();get.onsuccess=()=>resolve((get.result||[]).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))));get.onerror=()=>reject(get.error)}});

export async function analyzePhotoItem(item, context={}) {
  let next={...item,status:'validating',error:''};
  if(!/^image\/(jpeg|png|webp|heic|heif)$/i.test(next.mimeType||'')) return {...next,status:'failed',error:'FORMAT_INVALID'};
  try{const exif=await readExifDate(next.file);if(exif)next={...next,capturedAt:exif.capturedAt,capturedAtSource:'EXIF',exifTag:exif.tag};}catch{next.exifWarning='EXIF illisible : original conservé, date à confirmer.';}
  next.gps=await readExifGps(next.file)||next.gps;
  try{
   next.hash=await sha256File(next.file);
   if(!next.manual?.support){
    try{
     const ocr=await readFrameIdentifier(next.file,context.catalog?.supports||[]);
     next={...next,ocrVerifiedSupport:ocr.supportId,ocrText:ocr.supportId||ocr.observations.map(o=>o.text).join('\n'),
      ocrConfidence:ocr.supportId?ocr.candidates.find(c=>c.support_id===ocr.supportId).confidence:Math.max(0,...ocr.candidates.map(c=>c.confidence)),
      suggestions:ocr.candidates,ocrRegion:ocr.supportId?ocr.candidates.find(c=>c.support_id===ocr.supportId).region:null};
    }catch(error){next.ocrWarning='Identifiant non lu : attribuez le support manuellement.';}
   }
   try{
    const preliminary=importContextForPhoto(next,context.catalog,next.manual||{});
    const support=context.catalog?.supports.find(s=>s.support_id===preliminary.recognition.values.support);
    const visuals=(context.catalog?.visuals||[]).filter(v=>!support||String(v.client_id)===String(support.client_id));
    next.visualReferenceMatches=await recognizeVisualReferences(next.file,visuals);
   }catch(error){next.referenceWarning='Reconnaissance des visuels indisponible : choisissez une référence manuellement.';}
   const import_context=importContextForPhoto(next,context.catalog,next.manual||{});
   return {...next,import_context,recognition:import_context.recognition,status:import_context.recognition.ready?'ready':'requires_review',reviewStatus:import_context.recognition.classification};
  }catch(error){return {...next,status:'failed',error:error.message||'VALIDATION_FAILED'}}
}

export async function uploadPhotoItem(item, context={}) {
  // Every original is persisted as a draft before any business mutation.
  const row=item.resultId?{id:item.resultId,storage_path:item.storagePath}:await uploadUnmatchedPhoto(item,context);
  let error='';try{if(item.import_context)await savePhotoImportContext(row.id,item.import_context);}catch(e){error=e.message;}
  return {...item,status:'completed',reviewStatus:item.recognition?.classification||'unmatched',storagePath:row.storage_path,resultId:row.id,error,file:null};
}

export async function runControlledQueue(items, worker, options={}, callbacks={}) {
  const {concurrency,batchSize}=clampImportOptions(options);let paused=false,cancelled=false,index=0;
  const control={pause:()=>{paused=true},resume:()=>{paused=false;callbacks.onResume?.()},cancel:()=>{cancelled=true;for(let i=index;i<items.length;i++)if(['queued','ready','requires_review','failed'].includes(items[i].status))items[i]={...items[i],status:'cancelled',error:'CANCELLED'}},get paused(){return paused}};
  const run=(async()=>{for(let start=0;start<items.length&&!cancelled;start+=batchSize){const batch=items.slice(start,start+batchSize);index=start;
    const lanes=Array.from({length:Math.min(concurrency,batch.length)},async()=>{while(index<start+batch.length&&!cancelled){while(paused&&!cancelled)await new Promise(resolve=>setTimeout(resolve,100));const current=index++;if(cancelled)break;await worker(items[current],current)}});await Promise.all(lanes);callbacks.onBatch?.(items)}return items})();
  return {control,run};
}
