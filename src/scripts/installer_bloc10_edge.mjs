import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const root = process.cwd();
const require = createRequire(import.meta.url);

function exists(relative) {
  return fs.existsSync(path.join(root, relative));
}

function resolvePackage(name) {
  try {
    require.resolve(name, { paths: [root] });
    return true;
  } catch {
    return false;
  }
}

const requiredFiles = [
  'src/main.jsx',
  'src/components/EditableField.jsx',
  'src/components/ChangeHistoryPanel.jsx',
  'src/components/PhotoInventoryCenter.jsx',
  'src/services/universalEditorService.js',
  'src/services/photoInventoryService.js',
  'src/services/userProvisioningService.js',
  'src/features/v10/bloc-10-editor.css',
  'supabase/BLOC_10_EDITION_PHOTOS_INVENTAIRE.sql',
  'supabase/functions/invite-user/index.ts'
];

let failed = false;

for (const file of requiredFiles) {
  if (exists(file)) console.log(`✅ ${file}`);
  else {
    console.error(`❌ Fichier absent : ${file}`);
    failed = true;
  }
}

const dependencies = ['react', '@supabase/supabase-js'];
for (const dependency of dependencies) {
  if (resolvePackage(dependency)) console.log(`✅ ${dependency}`);
  else {
    console.error(`❌ Dépendance absente : ${dependency}`);
    failed = true;
  }
}

if (failed) process.exit(1);

console.log('');
console.log('✅ Bloc 10 et correctif Edge installés.');
console.log('Étapes suivantes :');
console.log('1. Exécuter supabase/BLOC_10_EDITION_PHOTOS_INVENTAIRE.sql');
console.log('2. Exécuter scripts/deployer_edge_functions.ps1');
console.log('3. npm run build');
console.log('4. npm run dev');
