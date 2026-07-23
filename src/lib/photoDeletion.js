export function normalizeStoragePath(value) {
  let path = String(value || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
  try { path = decodeURIComponent(path); } catch { /* Conserver le chemin original s'il est mal encodé. */ }
  return path.replace(/^support-photos\//i, '').replace(/\/+/g, '/');
}

export function storageLocationFromPhotoRecord(photo, fallbackBucket='support-photos') {
  const url = String(photo?.photo_url || photo?.thumbnail_url || '').trim();
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

  let path = normalizeStoragePath(photo?.storage_path);
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
