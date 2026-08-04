import { supabase, supabaseConfigured } from '../lib/supabaseClient';
import { prepareAndUploadPhoto, rollbackUploadedPhoto } from './photoWorkflowService';

const QUEUE_KEY = 'tos-terrain-offline-queue-v1';

export function getOfflineQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function setOfflineQueue(items) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('tos-terrain-queue-change'));
}

export function queueInspection(payload) {
  const items = getOfflineQueue();
  items.push({ ...payload, queued_at: new Date().toISOString(), local_id: crypto.randomUUID() });
  setOfflineQueue(items);
}

async function uploadTerrainPhotoLegacy(file, supportId, action = 'inspection') {
  if (!supabaseConfigured || !supabase) {
    throw new Error('Supabase n’est pas configuré.');
  }

  const safeSupport = String(supportId || 'support')
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const ext = file.name?.split('.').pop() || 'jpg';
  const path = `${safeSupport}/${new Date().toISOString().replace(/[:.]/g, '-')}_${action}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('terrain-photos')
    .upload(path, file, { cacheControl: '3600', upsert: false });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('terrain-photos').getPublicUrl(path);
  return { path, publicUrl: data?.publicUrl || '' };
}

export async function uploadTerrainPhoto(file, supportId, action = 'inspection', context = {}) {
  const uploaded = await prepareAndUploadPhoto(file, {
    supportId, type:action === 'photo' ? 'autre' : action,
    campaignCode:context.campaignCode || 'NONE', edt:context.edt || 'NONE',
    capturedAt:context.capturedAt, source:context.source || 'terrain'
  }, 'terrain-photos');
  return { ...uploaded, path:uploaded.storagePath };
}

export { rollbackUploadedPhoto };


export async function registerTerrainSupportPhoto({
  supportId,
  campagneId = null,
  visuelId = null,
  action = 'inspection',
  fileName,
  storagePath,
  photoUrl,
  userEmail = ''
}) {
  if (!supabaseConfigured || !supabase) {
    throw new Error('Supabase n’est pas configuré.');
  }

  if (!supportId || !storagePath || !fileName) {
    throw new Error('Support ID, fichier et chemin de stockage sont obligatoires.');
  }

  const normalizedAction = String(action || '').toLowerCase();
  const isInstallation = normalizedAction === 'installation';
  const isInspection = normalizedAction === 'inspection';

  const row = {
    support_id: String(supportId),
    campagne_id: campagneId ? Number(campagneId) : null,
    visuel_id: visuelId ? Number(visuelId) : null,
    type_photo: isInstallation
      ? 'Installation'
      : isInspection
        ? 'Inspection'
        : normalizedAction === 'enjeu'
          ? 'Enjeu'
          : 'Photo',
    nom_fichier: fileName,
    storage_path: storagePath,
    photo_url: photoUrl || null,
    thumbnail_url: photoUrl || null,
    prise_le: new Date().toISOString(),
    utilisateur: userEmail || null,
    statut_validation: (isInstallation || isInspection) ? 'Validée' : 'À valider',
    est_principale: isInstallation
  };

  const { data, error } = await supabase
    .from('support_photos')
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function saveInspection(payload, file = null) {
  if (!supabaseConfigured || !supabase || !navigator.onLine) {
    queueInspection({ ...payload, photo_pending: Boolean(file), photo_name: file?.name || null });
    return { queued: true };
  }

  let photo = null;
  if (file) {
    photo = await uploadTerrainPhoto(file, payload.support_id || payload.no_arret, payload.action);
  }

  const row = {
    ...payload,
    photo_path: photo?.path || null,
    photo_url: photo?.publicUrl || null,
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('inspections_terrain')
    .insert(row)
    .select()
    .single();

  if (error) {
    if (photo) await rollbackUploadedPhoto(photo);
    throw error;
  }
  return { queued: false, data };
}

export async function syncOfflineQueue() {
  if (!supabaseConfigured || !supabase || !navigator.onLine) {
    return { synced: 0, remaining: getOfflineQueue().length };
  }

  const items = getOfflineQueue();
  const remaining = [];
  let synced = 0;

  for (const item of items) {
    try {
      const { local_id, queued_at, photo_pending, photo_name, ...payload } = item;
      const { error } = await supabase.from('inspections_terrain').insert({
        ...payload,
        created_at: payload.created_at || queued_at || new Date().toISOString(),
        sync_note: photo_pending
          ? `Photo non jointe lors de la synchronisation hors ligne: ${photo_name || ''}`
          : 'Synchronisé depuis la file hors ligne'
      });
      if (error) throw error;
      synced++;
    } catch {
      remaining.push(item);
    }
  }

  setOfflineQueue(remaining);
  return { synced, remaining: remaining.length };
}


export async function finalizeTerrainInstallation({
  supportId,
  visualId,
  fileName,
  storagePath,
  photoUrl,
  userEmail = '',
  comments = ''
}) {
  if (!supabaseConfigured || !supabase) {
    throw new Error('Supabase n’est pas configuré.');
  }

  const { data, error } = await supabase.rpc('finaliser_installation_terrain_v01210', {
    p_support_id: String(supportId),
    p_visuel_id: Number(visualId),
    p_nom_fichier: fileName,
    p_storage_path: storagePath,
    p_photo_url: photoUrl || null,
    p_utilisateur: userEmail || null,
    p_commentaires: comments || null,
    p_idempotency_key: `TERRAIN-${String(supportId)}-${String(storagePath)}`
  });

  if (error) throw error;
  if (!data?.ok) throw new Error(data?.message || 'La mise à jour terrain a échoué.');

  window.dispatchEvent(new CustomEvent('tos-terrain-data-updated', {
    detail: data
  }));

  return data;
}


export async function finalizeTerrainIntervention({
  supportId,
  action,
  issueType = '',
  comments = '',
  fileName,
  storagePath,
  photoUrl,
  userEmail = ''
}) {
  if (!supabaseConfigured || !supabase) {
    throw new Error('Supabase n’est pas configuré.');
  }

  const reference = `TERRAIN-${String(action).toUpperCase()}-${String(supportId)}-${String(storagePath)}`;
  const { data, error } = await supabase.rpc('finaliser_intervention_terrain_v01273', {
    p_support_id: String(supportId),
    p_action: String(action),
    p_type_enjeu: issueType || null,
    p_commentaires: comments || null,
    p_nom_fichier: fileName,
    p_storage_path: storagePath,
    p_photo_url: photoUrl || null,
    p_utilisateur: userEmail || null,
    p_idempotency_key: reference
  });

  if (error) throw error;
  if (!data?.ok) throw new Error(data?.message || 'L’intervention terrain a échoué.');

  window.dispatchEvent(new CustomEvent('tos-terrain-data-updated', { detail: data }));
  return data;
}
