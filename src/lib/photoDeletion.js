export function normalizeStoragePath(value) {
  let path = String(value || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
  try { path = decodeURIComponent(path); } catch { /* Conserver le chemin original s'il est mal encodé. */ }
  return path.replace(/^support-photos\//i, '').replace(/\/+/g, '/');
}

export function storagePathFromPhotoRecord(photo) {
  if (photo?.storage_path) return normalizeStoragePath(photo.storage_path);
  const url = String(photo?.photo_url || '');
  const marker = '/support-photos/';
  const index = url.indexOf(marker);
  return index >= 0 ? normalizeStoragePath(url.slice(index + marker.length).split('?')[0]) : '';
}
