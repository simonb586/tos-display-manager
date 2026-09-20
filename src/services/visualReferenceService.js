import {supabase} from '../lib/supabaseClient';
import {referenceFileFeatures} from './visualReferenceRecognitionService';

const bucket='visual-references';
export async function addVisualReference(visual,file){
  const extensions={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'};
  if(!extensions[file.type]||file.size>25*1024*1024)throw Error('Choisissez une photo JPG, PNG, WebP ou un PDF de 25 Mo maximum.');
  if(!visual.id||!visual.client_id)throw Error('Enregistrez le visuel et son client avant d’ajouter une référence.');
  const pages=await referenceFileFeatures(file),id=crypto.randomUUID();
  const path=`${visual.client_id}/${visual.id}/${id}.${extensions[file.type]}`;
  const {error:uploadError}=await supabase.storage.from(bucket).upload(path,file,{upsert:false,contentType:file.type});
  if(uploadError)throw uploadError;
  const asset={id,storage_path:path,name:file.name,mime_type:file.type,pages,created_at:new Date().toISOString()};
  const {data,error}=await supabase.rpc('add_visual_reference',{p_visual_id:visual.id,p_asset:asset});
  // Keep an uploaded original if an ambiguous network error occurs. Never delete a
  // potentially committed reference as a client-side rollback.
  if(error)throw Error('Original conservé ; association non confirmée. '+error.message);
  window.dispatchEvent(new Event('tos-visual-references-updated'));
  return data;
}
export async function visualReferenceUrl(asset){
  const {data,error}=await supabase.storage.from(bucket).createSignedUrl(asset.storage_path,300);
  if(error)throw error;return data.signedUrl;
}
export async function listReferenceVisuals(previewTargetId=null){
  async function all(table,fields){
    const rows=[];for(let offset=0;;offset+=500){
      const {data,error}=await (previewTargetId?supabase.rpc('admin_preview_assignment_source',{p_target_user_id:previewTargetId,p_table:table,p_offset:offset,p_limit:500}):supabase.from(table).select(fields).order('id').range(offset,offset+499));
      if(error)throw error;rows.push(...data);if(data.length<500)return rows;
    }
  }
  const [visuals,campaigns]=await Promise.all([all('campagne_visuels_formats','id,client_id,campagne_id,nom_visuel,format_support,reference_assets'),all('campagnes_maitres','id,client_id,nom_campagne,business_context')]);
  return visuals.map(v=>({...v,campagne:campaigns.find(c=>c.id===v.campagne_id&&c.client_id===v.client_id)}));
}
