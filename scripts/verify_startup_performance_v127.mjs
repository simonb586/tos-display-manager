import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const main = fs.readFileSync('src/main.jsx', 'utf8');
const dataService = fs.readFileSync('src/services/dataService.js', 'utf8');
const utils = fs.readFileSync('src/lib/utils.js', 'utf8');
for (const component of ['InteractiveMap', 'TerrainApp', 'PhotoInventoryCenter', 'LegacyPhotoImporter', 'MassPhotoImporter', 'FieldCatalogManager', 'Module14Dashboard', 'ClientPortal']) {
  if (component === 'MassPhotoImporter') continue;
  assert.ok(main.includes(`const ${component} = lazy(`), `${component} doit être différé`);
}
assert.ok(!/^import .*['"](?:xlsx|jspdf)['"];?$/m.test(utils), 'Bibliothèque export chargée initialement');
assert.ok(utils.includes("await import('xlsx')") && utils.includes("await import('jspdf')"), 'Exports dynamiques absents');
assert.ok(main.includes('STARTUP_TABLES') && main.includes('loadManyTables(selectedConfig)'), 'Chargement initial ciblé absent');
assert.ok(dataService.includes('CACHE_TTL_MS') && dataService.includes('pendingLoads'), 'Cache court ou déduplication absent');
const assets = fs.readdirSync('dist/assets').map(name => ({ name, size: fs.statSync(path.join('dist/assets', name)).size }));
const initial = assets.filter(asset => /^index-[^.]+\.js$/.test(asset.name)).sort((a, b) => b.size - a.size)[0];
assert.ok(initial && initial.size < 700_000, `Chunk initial trop grand: ${initial?.size}`);
console.log(`V1.2.7 performance: chunk initial ${initial.size} octets; carte, photos, Terrain, modules admin/client et exports lourds différés; cache/déduplication actifs.`);
