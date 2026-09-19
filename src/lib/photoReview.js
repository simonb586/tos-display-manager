const key = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\s-]+/g, '_');
export const isImportedPhoto = photo => photo.source === 'mass_import';
export function photoReviewState(photo) {
  if (photo.import_finalized_at) return 'validated';
  if (key(photo.review_status) === 'ignored') return 'ignored';
  // Imported originals remain pending until the canonical finalization transaction succeeds.
  if (isImportedPhoto(photo)) return 'pending';
  if (['validee','valide','validated','approved','manually_validated'].includes(key(photo.statut_validation)) || key(photo.review_status) === 'manually_validated') return 'validated';
  if (['rejetee','rejected'].includes(key(photo.statut_validation))) return 'ignored';
  return 'pending';
}
export function isPhotoReviewItem(photo) {
  return !photo.deleted_at && (isImportedPhoto(photo) || Boolean(photo.review_status) || photoReviewState(photo) === 'pending');
}
