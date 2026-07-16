import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [
  ['src/main.jsx', ['v0.12.6', 'tos-terrain-live-sync', 'refreshDataStore']],
  ['src/components/TerrainApp.jsx', ['finalizeTerrainInstallation']],
  ['src/services/terrainService.js', ['finaliser_installation_terrain']],
  ['supabase/V0_12_6_SYNC_TERRAIN_COMPLET.sql', [
    'finaliser_installation_terrain',
    'Installation terrain atomique',
    'diagnostic_sync_terrain_v0126'
  ]]
];

let failed = false;

for (const [relative, tokens] of checks) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) {
    console.error(`❌ Fichier absent : ${relative}`);
    failed = true;
    continue;
  }

  const content = fs.readFileSync(file, 'utf8');
  for (const token of tokens) {
    if (!content.includes(token)) {
      console.error(`❌ Élément absent dans ${relative} : ${token}`);
      failed = true;
    }
  }
  console.log(`✅ ${relative}`);
}

if (failed) process.exit(1);
console.log('');
console.log('✅ v0.12.6 — Synchronisation terrain complète installée.');
