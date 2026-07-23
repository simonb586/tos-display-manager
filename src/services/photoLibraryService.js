import JSZip from 'jszip';
import { supabase, supabaseConfigured } from '../lib/supabaseClient';
import { friendlyError } from '../config/businessLanguage';
import { normalizeStoragePath, storagePathFromPhotoRecord } from '../lib/photoDeletion';

const ready = () => {
  if (!supabaseConfigured || !supabase) throw new Error('Supabase n’est pas configuré.');
};
const pad = n => String(n).padStart(2, '0');

export function detectLegacyPhotoMetadata(name, ids = []) {
  const base = String(name || '').replace(/\.[^.]+$/, '');
  const low = base.toLowerCase();
  const id = [...ids].sort((a,b)=>String(b).length-String(a).length)
    .find(x => low.includes(String(x).toLowerCase())) || '';
  const m = base.match(/(20\d{2})[-_ ]?(0[1-9]|1[0-2])?[-_ ]?(0[1-9]|[12]\d|3[01])?/);
  return { supportId:id, date:m?`${m[1]}-${m[2]||'01'}-${m[3]||'01'}`:'', confidence:id?(m?'Élevée':'Moyenne'):'Faible' };
}

export async function importLegacyPhoto({file,supportId,date,userEmail,sequence=1}) {
  ready();
  const d=date?new Date(`${date}T12:00:00`):new Date(file.lastModified||Date.now());
  const ext=file.name.split('.').pop()||'jpg';
  const filename=`${supportId}_${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_HISTORIQUE_${String(sequence).padStart(3,'0')}.${ext}`;
  const path=`${supportId}/${filename}`;
  const {error:up}=await supabase.storage.from('support-photos').upload(path,file,{upsert:false});
  if(up)throw up;
  const {data:u}=supabase.storage.from('support-photos').getPublicUrl(path);
  const {error}=await supabase.from('support_photos').insert({
    support_id:supportId,type_photo:'HISTORIQUE',nom_fichier:filename,storage_path:path,
    photo_url:u?.publicUrl||'',prise_le:d.toISOString(),utilisateur:userEmail,statut_validation:'Validée'
  });
  if(error)throw error;
}

export async function listSupportPhotos(supportId) {
  ready();
  const { data, error } = await supabase.from('support_photos').select('*')
    .eq('support_id', supportId).order('prise_le', { ascending: false });
  if(error) throw error;
  return data || [];
}

export function storagePathFromPhoto(photo) {
  return storagePathFromPhotoRecord(photo);
}

export { normalizeStoragePath };

function splitStoragePath(path) {
  const normalized = normalizeStoragePath(path);
  const parts = normalized.split('/').filter(Boolean);
  return { path:normalized, folder:parts.slice(0,-1).join('/'), fileName:parts.at(-1) || '' };
}

async function ensureStoragePathIsUnique(photo, path) {
  if (!path) return;
  const { data, error } = await supabase.from('support_photos')
    .select('id,storage_path,photo_url').neq('id', photo.id);
  if (error) throw error;
  const duplicates = (data || []).filter(row => storagePathFromPhoto(row) === path);
  if (duplicates.length) {
    throw new Error('Plusieurs photos utilisent le même fichier. Une vérification administrative est nécessaire.');
  }
}

async function storageObjectExists(path) {
  if (!path) return false;
  const location = splitStoragePath(path);
  if (!location.fileName) return false;
  const { data, error } = await supabase.storage.from('support-photos')
    .list(location.folder, { limit:100, search:location.fileName });
  if (error) throw error;
  return (data || []).some(item => item.name === location.fileName);
}

async function recordStillExists(id) {
  const { data, error } = await supabase.from('support_photos')
    .select('id').eq('id', id).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function verifyPhotoDeletion(photo, path) {
  const [recordExists, fileExists] = await Promise.all([
    recordStillExists(photo.id),
    storageObjectExists(path)
  ]);
  if (recordExists || fileExists) {
    throw new Error('La photo n’a pas pu être supprimée complètement. Une vérification administrative est nécessaire.');
  }
  const remaining = photo.support_id ? await listSupportPhotos(photo.support_id) : [];
  if (remaining.some(item => String(item.id) === String(photo.id))) {
    throw new Error('La photo demeure présente après actualisation. Une vérification administrative est nécessaire.');
  }
  return remaining;
}

async function setInfrastructurePrimary(supportId, photo) {
  const { error } = await supabase.from('infrastructures').update({
    photo_principale_url: photo?.photo_url || null,
    photo_miniature_url: photo?.thumbnail_url || photo?.photo_url || null
  }).eq('support_id', supportId);
  if (error) throw error;
}

export async function makeSupportPhotoPrimary(photo) {
  ready();
  if (!photo?.support_id || !photo?.id) throw new Error('Photo invalide.');
  const { error: clearError } = await supabase.from('support_photos')
    .update({ est_principale: false }).eq('support_id', photo.support_id);
  if (clearError && clearError.code !== '42703') throw clearError;
  const { error: setError } = await supabase.from('support_photos')
    .update({ est_principale: true }).eq('id', photo.id);
  if (setError && setError.code !== '42703') throw setError;
  await setInfrastructurePrimary(photo.support_id, photo);
  return { ok:true };
}

async function logPhotoAction(action, photo, details={}) {
  try {
    const { error } = await supabase.from('photo_action_log').insert({
      action, photo_id: photo?.id || null, support_id: photo?.support_id || null,
      nom_fichier: photo?.nom_fichier || null, details
    });
    if (error) throw error;
  } catch (_) {
    // The log must never make the main operation fail.
  }
}

function notifyPhotoDeletion(photo) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('tos-photo-deleted', {
    detail: { photoId: photo?.id, supportId: photo?.support_id }
  }));
  window.dispatchEvent(new CustomEvent('tos-terrain-data-updated'));
}

export async function deleteSupportPhoto(photo) {
  ready();
  if (!photo?.id) throw new Error('Photo invalide : identifiant manquant.');
  const originalPath = storagePathFromPhoto(photo);
  if (!originalPath && photo?.photo_url) {
    throw new Error('Le chemin de cette ancienne photo est incomplet. Une vérification administrative est nécessaire.');
  }
  await ensureStoragePathIsUnique(photo, originalPath);
  if (!(await recordStillExists(photo.id))) {
    if (originalPath && await storageObjectExists(originalPath)) {
      const { error } = await supabase.storage.from('support-photos').remove([originalPath]);
      if (error) throw error;
    }
    await verifyPhotoDeletion(photo, originalPath);
    notifyPhotoDeletion(photo);
    return { ok:true, id:photo.id, supportId:photo.support_id, verified:true, alreadyAbsent:true };
  }

  // Prefer the database RPC because it validates permissions and updates the primary-photo references.
  const { data: rpcData, error: rpcError } = await supabase.rpc('supprimer_photo_support_v0129_lot3', {
    p_photo_id: photo.id
  });
  if (!rpcError) {
    if (rpcData?.ok === false) throw new Error('La suppression n’a pas été confirmée.');
    const path = normalizeStoragePath(rpcData?.storage_path || originalPath);
    if (path) {
      const { error: storageError } = await supabase.storage.from('support-photos').remove([path]);
      if (storageError) throw storageError;
    }
    const remaining = await verifyPhotoDeletion(photo, path);
    await setInfrastructurePrimary(photo.support_id, remaining[0] || null);
    notifyPhotoDeletion(photo);
    return { ok:true, id:photo.id, supportId:photo.support_id, verified:true };
  }

  // Compatibility fallback when the migration has not yet been installed.
  if (!['42883','PGRST202'].includes(rpcError.code)) throw rpcError;
  const storagePath = originalPath;
  if (storagePath) {
    const { error: storageError } = await supabase.storage.from('support-photos').remove([storagePath]);
    if (storageError) throw storageError;
  }
  const { error: rowError } = await supabase.from('support_photos').delete().eq('id', photo.id);
  if (rowError) throw rowError;

  const remaining = photo.support_id ? await listSupportPhotos(photo.support_id) : [];
  await setInfrastructurePrimary(photo.support_id, remaining[0] || null);
  await logPhotoAction('SUPPRESSION', photo, {
    mode:'fallback', type_photo:photo.type_photo || null,
    utilisateur:photo.utilisateur || null, resultat:'CONFIRMEE'
  });
  await verifyPhotoDeletion(photo, storagePath);
  notifyPhotoDeletion(photo);
  return { ok:true, id:photo.id, supportId:photo.support_id, verified:true };
}

export async function deleteSupportPhotos(photos, onProgress=()=>{}) {
  const results=[];
  for (let i=0;i<photos.length;i+=1) {
    const photo=photos[i];
    try {
      await deleteSupportPhoto(photo);
      results.push({id:photo.id,ok:true});
    } catch (error) {
      results.push({id:photo.id,ok:false,error:friendlyError(error, 'Impossible de supprimer cette photo.')});
    }
    onProgress(i+1, photos.length);
  }
  const failed=results.filter(x=>!x.ok);
  if (failed.length) throw new Error(`${failed.length} photo(s) n’ont pas pu être supprimée(s).`);
  return results;
}

function safeFileName(value) {
  return String(value || 'photo').replace(/[\\/:*?"<>|]+/g, '_');
}

export async function downloadPhoto(photo) {
  const url=photo?.photo_url;
  if (!url) throw new Error('Adresse de photo absente.');
  const response=await fetch(url);
  if (!response.ok) throw new Error(`Téléchargement impossible (${response.status}).`);
  const blob=await response.blob();
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=safeFileName(photo.nom_fichier || `photo-${photo.id}.jpg`);
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(a.href);
}

export async function downloadPhotosZip(photos, supportId, onProgress=()=>{}) {
  if (!photos.length) throw new Error('Aucune photo à exporter.');
  const zip=new JSZip();
  for (let i=0;i<photos.length;i+=1) {
    const photo=photos[i];
    const response=await fetch(photo.photo_url);
    if (!response.ok) throw new Error(`Impossible de télécharger ${photo.nom_fichier || photo.id}.`);
    zip.file(safeFileName(photo.nom_fichier || `photo-${photo.id}.jpg`), await response.blob());
    onProgress(i+1, photos.length);
  }
  const blob=await zip.generateAsync({type:'blob'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`Support_${safeFileName(supportId)}_Photos.zip`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(a.href);
}
