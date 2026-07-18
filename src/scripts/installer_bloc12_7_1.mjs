import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const checks = [
  ['src/main.jsx', [
    'v0.12.7.1',
    'const [loading, setLoading] = useState(false)',
    'profileLoading || (session && loading)'
  ]],
  ['src/services/dataService.js', [
    'json-dev-fallback',
    'VITE_ALLOW_JSON_FALLBACK',
    'Lecture Supabase impossible'
  ]],
  ['src/services/terrainService.js', [
    'finaliser_installation_terrain_v0127'
  ]],
  ['src/components/TerrainApp.jsx', [
    'Installation confirmée',
    'Référence :'
  ]],
  ['supabase/V0_12_7_SYNC_DIAGNOSTIC.sql', [
    'finaliser_installation_terrain_v0127'
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
console.log('✅ v0.12.7.1 — Chargement et synchronisation installés correctement.');
