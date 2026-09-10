export function normalizeStoragePath(value) {
  let path = String(value || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
  try { path = decodeURIComponent(path); } catch { /* Conserver le chemin original s'il est mal encodé. */ }
  return path.replace(/^support-photos\//i, '').replace(/\/+/g, '/');
}

export function storageLocationFromPhotoRecord(photo, fallbackBucket='support-photos') {
  fallbackBucket = photo?.storage_bucket || fallbackBucket;
  const url = String(photo?.photo_url || photo?.thumbnail_url || photo?.photo_principale_url || photo?.photo_miniature_url || photo?.storage_path || '').trim();
  const match = url.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/?#]+)\/([^?#]+)/i);
  if (match) {
    let bucket = match[1];
    let path = match[2];
    try {
      bucket = decodeURIComponent(bucket);
      path = decodeURIComponent(path);
    } catch {
      // Conserver les valeurs originales si l'URL est mal encodée.
    }
    return { bucket, path:normalizeStoragePath(path), source:'url' };
  }

  const durableUrl = url.match(/^(support-photos|terrain-photos)\/(.+)$/i);
  if (durableUrl) return { bucket:durableUrl[1].toLowerCase(), path:normalizeStoragePath(durableUrl[2]), source:'fallback' };
  const reference = String(photo?.storage_path || url).trim();
  const canonical = reference.match(/^(support-photos|terrain-photos)\/(.+)$/i);
  if (canonical) return { bucket:canonical[1].toLowerCase(), path:normalizeStoragePath(canonical[2]), source:'fallback' };
  if (/^[a-z]+:/i.test(reference)) return { bucket:'', path:'', source:'missing' };
  let path = normalizeStoragePath(reference);
  if (!path) return { bucket:'', path:'', source:'missing' };
  const prefixed = path.match(/^([^/]+)\/(.+)$/);
  if (prefixed && prefixed[1].toLowerCase() === String(fallbackBucket).toLowerCase()) {
    path = prefixed[2];
  }
  return { bucket:fallbackBucket, path, source:'fallback' };
}

export function storagePathFromPhotoRecord(photo) {
  return storageLocationFromPhotoRecord(photo).path;
}

export function storageReferenceFromPhotoRecord(photo) {
  const {bucket,path} = storageLocationFromPhotoRecord(photo);
  return bucket && path ? `${bucket}/${path}` : null;
}
