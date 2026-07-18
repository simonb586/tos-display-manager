import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [
  ['src/main.jsx', [
    'InstallerTerrainShell',
    "role === 'Installateur'",
    'v0.12.4'
  ]],
  ['src/components/InstallerTerrainShell.jsx', [
    'Application installateur',
    'TerrainApp',
    'Déconnexion'
  ]],
  ['src/features/v12/installer-terrain-shell.css', [
    '.installer-shell',
    '.installer-shell-header',
    '@media(max-width:720px)'
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
console.log('✅ v0.12.4 — Interface Terrain plein écran installée correctement.');
