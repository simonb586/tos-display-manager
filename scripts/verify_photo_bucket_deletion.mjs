import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  normalizeStoragePath,
  storageLocationFromPhotoRecord,
  storagePathFromPhotoRecord
} from '../src/lib/photoDeletion.js';

assert.equal(
  normalizeStoragePath(' /terrain-photos/SUP 1/photo%20terrain.jpg '),
  'terrain-photos/SUP 1/photo terrain.jpg'
);

assert.deepEqual(
  storageLocationFromPhotoRecord({
    storage_path:'SUP-4/photo.jpg',
    photo_url:'https://example.test/storage/v1/object/public/terrain-photos/SUP-4/photo.jpg'
  }),
  { bucket:'terrain-photos', path:'SUP-4/photo.jpg', source:'url' }
);

assert.deepEqual(
  storageLocationFromPhotoRecord({
    storage_path:'support-photos/SUP-5/photo.jpg'
  }),
  { bucket:'support-photos', path:'SUP-5/photo.jpg', source:'fallback' }
);

assert.equal(
  storagePathFromPhotoRecord({
    photo_url:'https://example.test/storage/v1/object/public/support-photos/SUP-6/photo%20support.jpg'
  }),
  'SUP-6/photo support.jpg'
);

const service = await readFile(
  new URL('../src/services/photoLibraryService.js', import.meta.url),
  'utf8'
);

for (const required of [
  'ensureStorageLocationIsUnique',
  'storageObjectExists',
  'infrastructureStillReferences',
  'replaceInfrastructurePhotoReferences',
  'verifyPhotoDeletion',
  ".delete().eq('id', photo.id).select('id')",
  'supabase.storage.from(originalLocation.bucket)',
  'verified:true'
]) {
  assert.ok(service.includes(required), `Garde-fou manquant : ${required}`);
}

assert.ok(
  service.indexOf('await verifyPhotoDeletion(photo, location)') <
    service.indexOf('verified:true', service.indexOf('await verifyPhotoDeletion(photo, location)')),
  'Le succès doit être produit après les vérifications finales.'
);

console.log('Suppression photo multi-buckets : 12 contrôles réussis.');
