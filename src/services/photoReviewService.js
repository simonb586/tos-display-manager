import {supabase,supabaseConfigured} from '../lib/supabaseClient';
import {realExtension} from '../lib/photoWorkflow';
import {allPhotoProjectionRows} from './photoProjectionService';
import {loadPhotoImportCatalog,importContextForPhoto,savePhotoImportContext,finalizeImportPhoto} from './photoImportContextService';
const ready=()=>{if(!supabaseConfigured||!supabase)throw new Error('Supabase n’est pas configuré.');};

export async function uploadUnmatchedPhoto(item,{batchId}={}) {
 ready();const extension=realExtension(item.originalFilename,item.mimeType),id=item.id||crypto.randomUUID(),path=`review/${batchId||'independent'}/${id}.${extension}`;
 const {error:uploadError}=await supabase.storage.from('support-photos').upload(path,item.file,{cacheControl:'3600',upsert:false});if(uploadError)throw uploadError;
 const row={support_id:null,client_id:null,type_photo:'Photo',nom_fichier:item.originalFilename,original_filename:item.originalFilename,normalized_filename:null,
  storage_bucket:'support-photos',storage_path:path,photo_url:null,thumbnail_url:null,prise_le:item.capturedAt,captured_at:item.capturedAt,
  source:'mass_import',statut_validation:'À valider',review_status:'unmatched',ocr_text:item.ocrText||null,ocr_confidence:item.ocrConfidence,
  ocr_suggestions:item.suggestions||[],import_batch_id:batchId||null,
  metadata:{sha256:item.hash||null,captured_at_source:item.capturedAtSource,exif_tag:item.exifTag||null}};
 const {data,error}=await supabase.from('support_photos').insert(row).select().single();
 if(error){await supabase.storage.from('support-photos').remove([path]);throw error;}return data;
}
export async function listPhotoReviewQueue({status='all',batchId=null}={}) {
 ready();const filters={deleted_at:null,review_status:status==='all'?['auto_matched','needs_review','unmatched','manually_validated','ignored','error']:status};
 if(batchId)filters.import_batch_id=batchId;
 return allPhotoProjectionRows('support_photos',filters);
}
export async function searchSupports(term) {
 ready();const q=String(term||'').trim();if(q.length<2)return[];const pattern=`%${q.replace(/[%_,()]/g,'')}%`;
 const {data,error}=await supabase.from('infrastructures').select('support_id,type_support,format_affichage,emplacement_visibilite,site,client_id').or(`support_id.ilike.${pattern},emplacement_visibilite.ilike.${pattern},site.ilike.${pattern},type_support.ilike.${pattern}`).limit(12);
 if(error)throw error;return data||[];
}
export async function validateReviewPhoto(photo,supportId) {
 const context=importContextForPhoto(photo,await loadPhotoImportCatalog(),{...photo.import_context?.manual,support:supportId});
 await savePhotoImportContext(photo.id,context);
 if(!context.recognition.ready)throw new Error('Informations à confirmer : '+context.recognition.pending.join(', '));
 return finalizeImportPhoto(photo.id);
}
export async function ignoreReviewPhoto(id) {
 const {data,error}=await supabase.rpc('ignore_photo_review_item',{p_photo_id:id});if(error)throw error;return data;
}
