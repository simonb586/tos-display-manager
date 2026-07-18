import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const checks = [
  ['src/main.jsx', ['GlobalButtonFeedback', 'sidebar-logout', 'logoutFromPortal']],
  ['src/components/RelationsStudio.jsx', [
    'Synchroniser toutes les tables',
    'Créer une relation',
    'Table source',
    'Champ destination'
  ]],
  ['src/services/relationService.js', [
    'loadCompleteRelationCatalog',
    'synchronizeRelationCatalog'
  ]],
  ['src/components/InteractiveMap.jsx', [
    'DEFAULT_ZOOM',
    'MapResizeGuard',
    'map-empty-card'
  ]],
  ['src/components/GlobalButtonFeedback.jsx', ['tdm-click-feedback']],
  ['src/features/v11/correctifs-urgence.css', [
    'sidebar-logout',
    'map-empty-card',
    'relations-rule-builder'
  ]],
  ['supabase/V0_11_1_CORRECTIFS_URGENCE.sql', [
    'list_public_schema_fields',
    'diagnostic_correctifs_v0111'
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

  if (!failed) console.log(`✅ ${relative}`);
}

if (failed) process.exit(1);

console.log('');
console.log('✅ Correctifs urgents v0.11.1 installés.');
console.log('Étapes suivantes :');
console.log('1. Exécuter supabase/V0_11_1_CORRECTIFS_URGENCE.sql');
console.log('2. Exécuter supabase/VERIFIER_V0_11_1.sql');
console.log('3. npm run build');
console.log('4. npm run dev');
