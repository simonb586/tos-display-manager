import {supabase} from '../lib/supabaseClient';
import {recognizeImportPhoto} from '../lib/photoImportRecognition';
import {compareCampaigns,compareVisuals,compareNatural} from '../lib/gridSorting';
async function catalogRows(table,fields) {
 const rows=[];for(let offset=0;;offset+=500){const {data,error}=await supabase.from(table).select(fields).order('id').range(offset,offset+499);if(error)throw error;rows.push(...data);if(data.length<500)return rows;}
}
export async function loadPhotoImportCatalog() {
 const [supports,edts,phases,links,campaigns,visuals,associations]=await Promise.all([
  catalogRows('infrastructures','id,support_id,client_id,format_affichage,site,emplacement_visibilite'),
  catalogRows('suivi_des_edt','id,no_edt,client_id,campagne_id,date_debut,date_fin,archived_at'),
  catalogRows('edt_phases','id,edt_id,phase_type,date_debut_prevue,date_fin_prevue,date_debut_reelle,date_fin_reelle'),
  catalogRows('edt_supports','id,edt_id,phase_id,support_id,date_cible'),
  catalogRows('campagnes_maitres','id,client_id,nom_campagne,business_context,date_debut,date_fin'),
  catalogRows('campagne_visuels_formats','id,client_id,campagne_id,nom_visuel,format_support,is_out_of_frame'),
  (async()=>{const rows=[];for(let offset=0;;offset+=500){const {data,error}=await supabase.from('visual_edt_associations').select('*').order('visual_id').order('edt_id').range(offset,offset+499);if(error)throw error;rows.push(...data);if(data.length<500)return rows;}})()
 ]);
 const campaignById=new Map(campaigns.map(c=>[String(c.id),c]));
 return {supports,edts:edts.sort((a,b)=>compareNatural(a.no_edt,b.no_edt)),phases,links,campaigns:campaigns.sort(compareCampaigns),visuals:visuals.map(v=>({...v,campaign_name:campaignById.get(String(v.campagne_id))?.nom_campagne})).sort(compareVisuals),associations};
}
export function importContextForPhoto(photo,catalog,manual=photo.import_context?.manual||{}) {
 const input=photo.import_context?.input||{
  originalFilename:photo.originalFilename||photo.original_filename||photo.nom_fichier,
  supportId:photo.supportId||photo.proposed_support_id||'',capturedAt:photo.capturedAt||photo.captured_at||photo.prise_le,
  capturedAtSource:photo.capturedAtSource||photo.metadata?.captured_at_source||'IMPORT_DATE',
  ocrText:photo.ocrText||photo.ocr_text,ocrConfidence:photo.ocrConfidence||photo.ocr_confidence
 };
 return {input,manual,recognition:recognizeImportPhoto(input,catalog,manual)};
}
export async function savePhotoImportContext(photoId,context) {
 const {data,error}=await supabase.rpc('save_photo_import_context',{p_photo_id:Number(photoId),p_context:context});if(error)throw error;return data;
}
export async function finalizeImportPhoto(photoId) {
 const {data,error}=await supabase.rpc('finalize_import_photo',{p_photo_id:Number(photoId)});if(error)throw error;if(!data?.ok)throw new Error('Validation non confirmée.');return data;
}
