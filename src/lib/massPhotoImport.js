import { classifyPhotoContext, generatePhotoIdentity, resolvePhotoAssociations } from './photoWorkflow.js';

export const MASS_PHOTO_STATES = Object.freeze(['queued','validating','ready','requires_review','uploading','processing','completed','failed','skipped','duplicate','cancelled']);
export const PHOTO_REVIEW_STATUSES = Object.freeze(['auto_matched','needs_review','unmatched','manually_validated','ignored','error']);
export const PHOTO_MATCH_THRESHOLDS = Object.freeze({automatic:95,review:70});
export const DEFAULT_MASS_PHOTO_OPTIONS = Object.freeze({ concurrency: 6, batchSize: 100 });
export const TERMINAL_PHOTO_STATES = new Set(['completed','failed','skipped','duplicate','cancelled']);

export const clampImportOptions = (options = {}) => ({
  concurrency: Math.min(10, Math.max(1, Number(options.concurrency) || DEFAULT_MASS_PHOTO_OPTIONS.concurrency)),
  batchSize: Math.min(200, Math.max(50, Number(options.batchSize) || DEFAULT_MASS_PHOTO_OPTIONS.batchSize))
});

export const createImportId = () => globalThis.crypto?.randomUUID?.() || `photos-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const createImportItem = (file, index, defaults = {}) => ({
  id: createImportId(), file, originalFilename: file.name, size: file.size, lastModified: file.lastModified,
  mimeType: file.type, supportId: defaults.supportId || '', capturedAt: defaults.capturedAt || new Date(file.lastModified || Date.now()).toISOString(),
  explicitType: defaults.explicitType || '', campaignId:null, edtId:null, selected:false, capturedAtSource:'file', status: 'queued', reviewStatus:null, ocrText:'', ocrConfidence:null, suggestions:[], error: '', hash: '', storagePath: '', resultId: null, sequence: index + 1
});

export const normalizeSupportCandidate=value=>String(value||'').toUpperCase().replace(/[IL|]/g,'1').replace(/[^A-Z0-9]/g,'');
export function supportSimilarity(raw, supportId) {
  const a=normalizeSupportCandidate(raw),b=normalizeSupportCandidate(supportId);if(!a||!b)return 0;
  const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prior=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prior+(a[i-1]===b[j-1]?0:1));prior=old}}
  return Math.max(0,Math.round((1-row[b.length]/Math.max(a.length,b.length))*100));
}
export function suggestSupports(raw, infrastructures=[], limit=3) {return infrastructures.map(row=>({...row,confidence:supportSimilarity(raw,row.support_id)})).filter(row=>row.confidence>0).sort((a,b)=>b.confidence-a.confidence||String(a.support_id).localeCompare(String(b.support_id))).slice(0,limit)}
export function classifyMatch(confidence, unique=true) {const score=Number(confidence)||0;return score>=PHOTO_MATCH_THRESHOLDS.automatic&&unique?'auto_matched':score>=PHOTO_MATCH_THRESHOLDS.review?'needs_review':'unmatched'}

export const virtualWindow = (total, scrollTop=0, {rowHeight=44, viewportHeight=440, overscan=5}={}) => {
  const start=Math.max(0,Math.floor(scrollTop/rowHeight)-overscan), visible=Math.ceil(viewportHeight/rowHeight)+overscan*2;
  return {start,end:Math.min(total,start+visible),offset:start*rowHeight,totalHeight:total*rowHeight};
};

const exifDate=value=>{const match=String(value||'').match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);return match?new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`).toISOString():null};
export async function readExifDate(file, maxBytes=262144) {
  if(!file?.slice||!/^image\/jpe?g$/i.test(file.type||''))return null;
  const bytes=new Uint8Array(await file.slice(0,Math.min(file.size,maxBytes)).arrayBuffer()), view=new DataView(bytes.buffer);
  for(let i=2;i+10<bytes.length;){if(bytes[i]!==0xff)break;const marker=bytes[i+1],length=view.getUint16(i+2);if(marker===0xe1&&String.fromCharCode(...bytes.slice(i+4,i+10))==='Exif\0\0'){
    const tiff=i+10,little=view.getUint16(tiff)===0x4949,get16=o=>view.getUint16(o,little),get32=o=>view.getUint32(o,little),first=tiff+get32(tiff+4);
    const scan=dir=>{if(dir+2>=bytes.length)return null;for(let n=get16(dir),j=0;j<n;j++){const e=dir+2+j*12;if(e+12>bytes.length)break;const tag=get16(e),type=get16(e+2),count=get32(e+4);if((tag===0x9003||tag===0x9004)&&type===2){const p=count<=4?e+8:tiff+get32(e+8);if(p+count<=bytes.length){const value=new TextDecoder().decode(bytes.slice(p,p+count-1));const parsed=exifDate(value);if(parsed)return{capturedAt:parsed,source:'exif',tag:tag===0x9003?'DateTimeOriginal':'CreateDate'}}}if(tag===0x8769){const found=scan(tiff+get32(e+8));if(found)return found}}return null};return scan(first)
  }if(marker===0xda||length<2)break;i+=2+length}return null;
}

export const rematchManifestFiles = async (manifestItems=[], files=[], hash=sha256File) => {
  const pending=manifestItems.filter(item=>!['completed','duplicate','skipped'].includes(item.status)), matches=[];
  for(const file of files){const candidates=pending.filter(item=>item.originalFilename===file.name&&item.size===file.size);if(!candidates.length)continue;const digest=await hash(file);const item=candidates.find(candidate=>!candidate.hash||candidate.hash===digest);if(item)matches.push({...item,file,hash:digest,status:item.status==='cancelled'?'queued':item.status})}
  return matches;
};

export function applyBulkResolution(items, ids, decision={}) {
 const chosen=new Set(ids);return items.map(item=>chosen.has(item.id)?{...item,...decision,status:decision.status||'queued',error:''}:item);
}

export function importSummary(items = []) {
  const count = status => items.filter(item => item.status === status).length;
  const processed = items.filter(item => TERMINAL_PHOTO_STATES.has(item.status)).length;
  return { total:items.length, processed, completed:count('completed'), failed:count('failed'), skipped:count('skipped') + count('cancelled'), duplicate:count('duplicate'), requiresReview:count('requires_review'), remaining:items.length - processed };
}

export async function sha256File(file) {
  if (!file?.arrayBuffer) throw new Error('HASH_UNAVAILABLE');
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

export function prepareImportItem(item, context = {}) {
  const association = resolvePhotoAssociations({ ...context, supportId:item.supportId, type:item.explicitType || 'inspection' });
  if (!association.ok && association.reason==='SUPPORT_REQUIRED') return { ...item, status:'ready', reviewStatus:'unmatched', error:association.reason };
  if (!association.ok) return { ...item, status:'requires_review', reviewStatus:'needs_review', error:association.reason };
  const classification = classifyPhotoContext({ ...context, explicitType:item.explicitType || undefined });
  const identity = generatePhotoIdentity({ supportId:item.supportId, capturedAt:item.capturedAt, type:item.explicitType || classification.type,
    campaignCode:association.campaign?.code_campagne || association.campaign?.id || 'NONE', edt:association.edt?.numero_edt || association.edt?.id || 'NONE',
    sequence:item.sequence, originalFilename:item.originalFilename, mimeType:item.mimeType });
  return { ...item, status:'ready', reviewStatus:'auto_matched', error:'', classification, campaignId:association.campaign?.id || null, edtId:association.edt?.id || null, ...identity };
}

export const manifestItem = item => ({ id:item.id, originalFilename:item.originalFilename, size:item.size, lastModified:item.lastModified,
  mimeType:item.mimeType, supportId:item.supportId, capturedAt:item.capturedAt, status:item.status, error:item.error, hash:item.hash,
  storagePath:item.storagePath, resultId:item.resultId, normalizedFilename:item.normalizedFilename, campaignId:item.campaignId, edtId:item.edtId, capturedAtSource:item.capturedAtSource, classification:item.classification, sequence:item.sequence,reviewStatus:item.reviewStatus,ocrText:item.ocrText,ocrConfidence:item.ocrConfidence,suggestions:item.suggestions });

export function importReport(items=[], meta={}) {const summary=importSummary(items),completed=items.filter(i=>i.status==='completed');return{lot_id:meta.batchId,start:meta.startedAt||null,end:meta.endedAt||null,duration_ms:meta.startedAt&&meta.endedAt?new Date(meta.endedAt)-new Date(meta.startedAt):null,total_selected:items.length,total_analyzed:items.filter(i=>i.hash).length,total_imported:summary.completed,total_failed:summary.failed,total_duplicates:summary.duplicate,total_skipped:summary.skipped,total_requires_review:summary.requiresReview,automatic_inspections:items.filter(i=>i.classification?.reason==='no_active_business_context').length,campaigns_associated:new Set(items.map(i=>i.campaignId).filter(Boolean)).size,edt_associated:new Set(items.map(i=>i.edtId).filter(Boolean)).size,distinct_supports:new Set(items.map(i=>i.supportId).filter(Boolean)).size,total_uploaded_bytes:completed.reduce((n,i)=>n+(i.size||0),0),errors_by_category:Object.fromEntries([...new Set(items.filter(i=>i.error).map(i=>i.error))].map(error=>[error,items.filter(i=>i.error===error).length]))}}
export const summaryCsv = report => Object.entries(report).map(([key,value])=>`"${key}","${String(typeof value==='object'?JSON.stringify(value):value??'').replaceAll('"','""')}"`).join('\r\n');

export const errorCsv = items => ['fichier,support,statut,erreur', ...items.filter(item => ['failed','requires_review'].includes(item.status)).map(item =>
  [item.originalFilename,item.supportId,item.status,item.error].map(value => `"${String(value || '').replaceAll('"','""')}"`).join(','))].join('\r\n');
