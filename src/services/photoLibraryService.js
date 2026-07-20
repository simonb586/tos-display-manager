import { supabase, supabaseConfigured } from '../lib/supabaseClient';
const ready=()=>{if(!supabaseConfigured||!supabase)throw new Error('Supabase n’est pas configuré.');};
const pad=n=>String(n).padStart(2,'0');
export function detectLegacyPhotoMetadata(name,ids=[]){const base=String(name||'').replace(/\.[^.]+$/,'');const low=base.toLowerCase();const id=[...ids].sort((a,b)=>String(b).length-String(a).length).find(x=>low.includes(String(x).toLowerCase()))||'';const m=base.match(/(20\d{2})[-_ ]?(0[1-9]|1[0-2])?[-_ ]?(0[1-9]|[12]\d|3[01])?/);return{supportId:id,date:m?`${m[1]}-${m[2]||'01'}-${m[3]||'01'}`:'',confidence:id?(m?'Élevée':'Moyenne'):'Faible'};}
export async function importLegacyPhoto({file,supportId,date,userEmail,sequence=1}){ready();const d=date?new Date(`${date}T12:00:00`):new Date(file.lastModified||Date.now());const ext=file.name.split('.').pop()||'jpg';const filename=`${supportId}_${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_HISTORIQUE_${String(sequence).padStart(3,'0')}.${ext}`;const path=`${supportId}/${filename}`;const{error:up}=await supabase.storage.from('support-photos').upload(path,file,{upsert:false});if(up)throw up;const{data:u}=supabase.storage.from('support-photos').getPublicUrl(path);const{error}=await supabase.from('support_photos').insert({support_id:supportId,type_photo:'HISTORIQUE',nom_fichier:filename,storage_path:path,photo_url:u?.publicUrl||'',prise_le:d.toISOString(),utilisateur:userEmail,statut_validation:'Validée'});if(error)throw error;}

export async function listSupportPhotos(supportId){
  ready();
  const { data, error } = await supabase
    .from('support_photos')
    .select('*')
    .eq('support_id', supportId)
    .order('prise_le', { ascending: false });
  if(error) throw error;
  return data || [];
}

function storagePathFromPhoto(photo) {
  if (photo?.storage_path) return photo.storage_path;
  const url = String(photo?.photo_url || '');
  const marker = '/support-photos/';
  const index = url.indexOf(marker);
  return index >= 0 ? decodeURIComponent(url.slice(index + marker.length)) : '';
}

export async function deleteSupportPhoto(photo) {
  ready();
  if (!photo?.id) throw new Error('Photo invalide : identifiant manquant.');

  const storagePath = storagePathFromPhoto(photo);

  // The database row is removed first only after Storage confirms deletion.
  // If the object is already absent, Supabase Storage returns no blocking error.
  if (storagePath) {
    const { error: storageError } = await supabase.storage
      .from('support-photos')
      .remove([storagePath]);
    if (storageError) throw storageError;
  }

  const { error: rowError } = await supabase
    .from('support_photos')
    .delete()
    .eq('id', photo.id);

  if (rowError) throw rowError;

  // Clear Infrastructure primary-photo references when this photo was primary.
  if (photo.support_id) {
    const { data: infra, error: infraReadError } = await supabase
      .from('infrastructures')
      .select('support_id,photo_principale_url,photo_miniature_url')
      .eq('support_id', photo.support_id)
      .maybeSingle();

    if (infraReadError) throw infraReadError;

    const removedUrls = new Set([photo.photo_url, photo.thumbnail_url].filter(Boolean));
    if (infra && (removedUrls.has(infra.photo_principale_url) || removedUrls.has(infra.photo_miniature_url))) {
      const remaining = await listSupportPhotos(photo.support_id);
      const replacement = remaining[0] || null;
      const { error: infraUpdateError } = await supabase
        .from('infrastructures')
        .update({
          photo_principale_url: replacement?.photo_url || null,
          photo_miniature_url: replacement?.thumbnail_url || replacement?.photo_url || null
        })
        .eq('support_id', photo.support_id);
      if (infraUpdateError) throw infraUpdateError;
    }
  }

  return { ok: true, id: photo.id };
}

