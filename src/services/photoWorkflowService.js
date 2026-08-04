import { supabase, supabaseConfigured } from '../lib/supabaseClient';
import { generatePhotoIdentity } from '../lib/photoWorkflow';

const ready=()=>{if(!supabaseConfigured||!supabase)throw new Error('Supabase n’est pas configuré.');};

async function pathExists(bucket, path) {
  const parts=path.split('/'), name=parts.pop();
  const {data,error}=await supabase.storage.from(bucket).list(parts.join('/'),{search:name,limit:10});
  if(error)throw error;
  return (data||[]).some(item=>item.name===name);
}

export async function prepareAndUploadPhoto(file, context, bucket='support-photos') {
  ready();
  if(!file)throw new Error('Une photo est obligatoire.');
  let sequence=Number(context.sequence)||1, identity;
  do {
    identity=generatePhotoIdentity({...context,sequence,originalFilename:file.name,mimeType:file.type});
    sequence+=1;
  } while(await pathExists(bucket,identity.storagePath));
  const {error}=await supabase.storage.from(bucket).upload(identity.storagePath,file,{cacheControl:'3600',upsert:false});
  if(error)throw error;
  const {data}=supabase.storage.from(bucket).getPublicUrl(identity.storagePath);
  return {...identity,bucket,publicUrl:data?.publicUrl||''};
}

export async function rollbackUploadedPhoto(uploaded) {
  if(!uploaded?.bucket||!uploaded?.storagePath)return;
  const {error}=await supabase.storage.from(uploaded.bucket).remove([uploaded.storagePath]);
  if(error)throw new Error(`Rollback Storage impossible : ${error.message}`);
}

export function photoHistoryRow(uploaded, context={}) {
  return {
    support_id:String(context.supportId), campagne_id:context.campaignId||null, edt_id:context.edtId||null,
    type_photo:uploaded.type, source:context.source||'administration', original_filename:uploaded.originalFilename,
    normalized_filename:uploaded.normalizedFilename, nom_fichier:uploaded.normalizedFilename,
    storage_bucket:uploaded.bucket, storage_path:uploaded.storagePath, photo_url:uploaded.publicUrl||null,
    thumbnail_url:uploaded.publicUrl||null, captured_at:uploaded.capturedAt, prise_le:uploaded.capturedAt,
    uploaded_at:uploaded.uploadedAt, uploaded_by:context.uploadedBy||null, utilisateur:context.userEmail||null,
    intervention_id:context.interventionId||null, inspection_id:context.inspectionId||null,
    issue_id:context.issueId||null, is_current_visual:Boolean(context.isCurrentVisual),
    est_principale:Boolean(context.isCurrentVisual), status:context.status||'active',
    metadata:{original_name:uploaded.originalFilename,normalized_name:uploaded.normalizedFilename,source:context.source||'administration',...(context.metadata||{})}
  };
}

export async function insertPhotoWithRollback(uploaded, context) {
  const row=photoHistoryRow(uploaded,context);
  const {data,error}=await supabase.from('support_photos').insert(row).select().single();
  if(error){await rollbackUploadedPhoto(uploaded);throw error;}
  return data;
}
