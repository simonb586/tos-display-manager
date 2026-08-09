import { supabase, supabaseConfigured } from '../lib/supabaseClient';
import { storageLocationFromPhotoRecord } from '../lib/photoDeletion';

export const PHOTO_URL_TTL = Object.freeze({ preview: 300, download: 120, report: 900 });
const CACHE_SAFETY_SECONDS = 30;
const signedUrlCache = new Map();

const ready = () => {
  if (!supabaseConfigured || !supabase) throw new Error('Service photo sécurisé indisponible.');
};

export function photoStorageLocation(photo) {
  const location = storageLocationFromPhotoRecord(photo, photo?.storage_bucket || 'support-photos');
  if (!location.bucket || !location.path) throw new Error('Métadonnées Storage incomplètes.');
  return location;
}

export async function getSignedPhotoUrl(photo, { purpose = 'preview', force = false } = {}) {
  ready();
  const { bucket, path } = photoStorageLocation(photo);
  if (bucket !== 'support-photos') return photo?.photo_url || photo?.thumbnail_url || '';
  const ttl = PHOTO_URL_TTL[purpose] || PHOTO_URL_TTL.preview;
  const key = `${bucket}:${path}:${purpose}`;
  const cached = signedUrlCache.get(key);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.url;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, ttl, {
    download: purpose === 'download' ? (photo?.nom_fichier || true) : false
  });
  if (error || !data?.signedUrl) throw new Error(error?.message || 'Photo privée inaccessible.');
  signedUrlCache.set(key, { url:data.signedUrl, expiresAt:Date.now() + Math.max(1, ttl - CACHE_SAFETY_SECONDS) * 1000 });
  return data.signedUrl;
}

export async function getSignedPhotoUrls(photos, options = {}) {
  return Promise.all((photos || []).map(async photo => {
    try {
      const signedUrl = await getSignedPhotoUrl(photo, options);
      return { ...photo, signed_url:signedUrl, signed_thumbnail_url:signedUrl, photo_access_error:null };
    } catch (error) {
      return { ...photo, signed_url:'', signed_thumbnail_url:'', photo_access_error:error.message || 'Photo inaccessible.' };
    }
  }));
}

export const getSignedDownloadUrl = photo => getSignedPhotoUrl(photo, { purpose:'download', force:true });
export const getSignedReportPhotoUrl = photo => getSignedPhotoUrl(photo, { purpose:'report' });
export const clearSignedPhotoUrlCache = () => signedUrlCache.clear();
