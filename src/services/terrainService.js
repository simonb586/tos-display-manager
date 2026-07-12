import { supabase, supabaseConfigured } from '../lib/supabaseClient';

const QUEUE_KEY = 'tos-terrain-offline-queue-v2';

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
  items.push({
    ...payload,
    queued_at: new Date().toISOString(),
    local_id: crypto.randomUUID()
  });
  setOfflineQueue(items);
}

function pad(value) {
  return String(value).padStart(2, '0');
}

export function buildTerrainPhotoName(supportId, action = 'inspection', sequence = 1, file = null) {
  const now = new Date();
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const safeSupport = String(supportId || 'SUPPORT').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeAction = String(action || 'PHOTO').toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
  const extension = file?.name?.split('.').pop()?.toLowerCase() || 'jpg';
  return `${safeSupport}_${date}_${safeAction}_${String(sequence).padStart(3, '0')}.${extension}`;
}

export async function listPublishedCampaigns() {
  if (!supabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from('campagnes_maitres')
    .select('*')
    .eq('publiee_terrain', true)
    .not('statut', 'in', '("Annulée","Archivée")')
    .order('nom_campagne', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function uploadTerrainPhoto(file, supportId, action = 'inspection') {
  if (!supabaseConfigured || !supabase) {
    throw new Error('Supabase n’est pas configuré.');
  }

  const safeSupport = String(supportId || 'support')
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = buildTerrainPhotoName(supportId, action, 1, file);
  const path = `${safeSupport}/${filename}`;

  const { error: uploadError } = await supabase.storage
    .from('terrain-photos')
    .upload(path, file, { cacheControl: '3600', upsert: false });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('terrain-photos').getPublicUrl(path);
  return {
    path,
    filename,
    publicUrl: data?.publicUrl || ''
  };
}

async function propagateCampaign(payload, photo) {
  if (!payload.campagne_id || !payload.support_id) return null;

  const { data, error } = await supabase.rpc('appliquer_campagne_support', {
    p_support_id: payload.support_id,
    p_campagne_id: Number(payload.campagne_id),
    p_utilisateur: payload.utilisateur_courriel || null,
    p_photo_url: photo?.publicUrl || null,
    p_photo_path: photo?.path || null
  });

  if (error) throw error;
  return data;
}

export async function saveInspection(payload, file = null) {
  if (!supabaseConfigured || !supabase || !navigator.onLine) {
    queueInspection({
      ...payload,
      photo_pending: Boolean(file),
      photo_name: file?.name || null
    });
    return { queued: true };
  }

  let photo = null;
  if (file) {
    photo = await uploadTerrainPhoto(
      file,
      payload.support_id || payload.no_arret,
      payload.action
    );
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

  if (error) throw error;

  const propagation = await propagateCampaign(payload, photo);

  return {
    queued: false,
    data,
    photo,
    propagation
  };
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
      const {
        local_id,
        queued_at,
        photo_pending,
        photo_name,
        ...payload
      } = item;

      const { error } = await supabase
        .from('inspections_terrain')
        .insert({
          ...payload,
          created_at: payload.created_at || queued_at || new Date().toISOString(),
          sync_note: photo_pending
            ? `Photo non jointe lors de la synchronisation hors ligne: ${photo_name || ''}`
            : 'Synchronisé depuis la file hors ligne'
        });

      if (error) throw error;

      if (payload.campagne_id && payload.support_id) {
        await propagateCampaign(payload, null);
      }

      synced += 1;
    } catch (error) {
      console.error('[TDM] Synchronisation terrain échouée', error);
      remaining.push(item);
    }
  }

  setOfflineQueue(remaining);
  return { synced, remaining: remaining.length };
}
