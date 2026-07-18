import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [
  ['src/main.jsx', ['v0.12.5']],
  ['src/components/TerrainApp.jsx', [
    'registerTerrainSupportPhoto',
    "action === 'installation'",
    'Photo validée, définie comme principale'
  ]],
  ['src/services/terrainService.js', [
    'registerTerrainSupportPhoto',
    'est_principale',
    "statut_validation: (isInstallation || isInspection) ? 'Validée' : 'À valider'"
  ]],
  ['supabase/V0_12_5_PHOTOS_TERRAIN.sql', [
    'normalize_terrain_photo_rules',
    'sync_infrastructure_photo_thumbnail',
    'diagnostic_photos_terrain_v0125'
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
console.log('✅ v0.12.5 — Photos terrain vers Infrastructure installée correctement.');
