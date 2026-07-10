import { supabase, supabaseConfigured } from '../lib/supabaseClient';

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

export async function uploadTerrainPhoto(file, supportId, action = 'inspection') {
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

  if (error) throw error;
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
