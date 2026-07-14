import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [
  ['src/main.jsx', ["'Centre EDT et BT'", "OperationsCenter"]],
  ['src/components/OperationsCenter.jsx', ['Centre EDT et bons de travail']],
  ['src/services/operationsService.js', ['loadOperationsData', 'closeEdt']],
  ['src/features/v11/bloc-11-operations.css', ['operations-page']],
  ['supabase/BLOC_11_EDT_BONS_TRAVAIL.sql', ['diagnostic_bloc11', 'requetes_clients', 'edt_phases']],
  ['supabase/VERIFIER_BLOC_11.sql', ['diagnostic_bloc11']]
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
console.log('✅ Bloc 11 installé correctement.');
console.log('Étapes suivantes :');
console.log('1. Exécuter supabase/BLOC_11_EDT_BONS_TRAVAIL.sql');
console.log('2. Exécuter supabase/VERIFIER_BLOC_11.sql');
console.log('3. npm run build');
console.log('4. npm run dev');
