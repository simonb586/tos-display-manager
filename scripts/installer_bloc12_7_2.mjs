import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [
  ['src/main.jsx', ['v0.12.7.2']],
  ['src/components/TerrainApp.jsx', [
    'messageType',
    'Échec de l’intervention',
    'Installation confirmée'
  ]],
  ['supabase/V0_12_7_2_AMBIGUITE_CORRIGEE.sql', [
    'v_reference',
    'v_diag_id',
    'where d.id = v_diag_id',
    "'ok', false"
  ]],
  ['src/features/v12/installer-terrain-shell.css', [
    '.terrain-message.error',
    '.terrain-message.success'
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
console.log('✅ v0.12.7.2 — Ambiguïté SQL corrigée.');
