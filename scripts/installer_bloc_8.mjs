import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const root = process.cwd();
const require = createRequire(import.meta.url);
const packageFile = path.join(root, 'package.json');

function fail(message, details = '') {
  console.error(`❌ ${message}`);
  if (details) console.error(details);
  process.exit(1);
}

function commandExists(command, args = ['--version']) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    shell: false
  });
  return result.status === 0;
}

function resolvePackage(packageName) {
  try {
    require.resolve(`${packageName}/package.json`, { paths: [root] });
    return true;
  } catch {
    try {
      require.resolve(packageName, { paths: [root] });
      return true;
    } catch {
      return false;
    }
  }
}

function readPackageJson() {
  try {
    return JSON.parse(fs.readFileSync(packageFile, 'utf8'));
  } catch (error) {
    fail('package.json illisible.', error.message);
  }
}

function dependencyDeclared(pkg, name) {
  return Boolean(pkg.dependencies?.[name] || pkg.devDependencies?.[name]);
}

function runNpmInstall(packages) {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const args = [
    'install',
    ...packages,
    '--save',
    '--legacy-peer-deps',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund'
  ];

  console.log(`Installation npm : ${packages.join(', ')}`);
  const result = spawnSync(npmCommand, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false
  });

  if (result.status !== 0) {
    fail(
      'Installation npm échouée.',
      [
        'Commande tentée :',
        `${npmCommand} ${args.join(' ')}`,
        '',
        'Essaie manuellement :',
        'npm install leaflet@1.9.4 react-leaflet@4.2.1 --legacy-peer-deps --ignore-scripts'
      ].join('\n')
    );
  }
}

if (!fs.existsSync(packageFile)) {
  fail('package.json introuvable. Lance ce script à la racine du projet.');
}

if (!commandExists(process.platform === 'win32' ? 'npm.cmd' : 'npm')) {
  fail('npm est introuvable dans le terminal.');
}

console.log('Vérification des dépendances cartographiques...');

let pkg = readPackageJson();
const required = [
  { name: 'leaflet', version: '1.9.4' },
  { name: 'react-leaflet', version: '4.2.1' }
];

const missing = required.filter(item =>
  !dependencyDeclared(pkg, item.name) || !resolvePackage(item.name)
);

if (missing.length) {
  runNpmInstall(missing.map(item => `${item.name}@${item.version}`));
  pkg = readPackageJson();
} else {
  console.log('✅ Leaflet et React-Leaflet sont déjà installés.');
}

for (const item of required) {
  if (!dependencyDeclared(pkg, item.name)) {
    fail(`${item.name} n’est pas déclaré dans package.json après installation.`);
  }
  if (!resolvePackage(item.name)) {
    fail(`${item.name} n’est pas résolvable dans node_modules après installation.`);
  }
  console.log(`✅ ${item.name}`);
}

const checks = [
  ['src/main.jsx', [
    "import InteractiveMap from './components/InteractiveMap';",
    "import RoleVisibilityAdmin from './components/RoleVisibilityAdmin';",
    "'Carte interactive'",
    "'Visibilité par rôle'"
  ]],
  ['src/components/InteractiveMap.jsx', ['MapContainer', 'Carte interactive']],
  ['src/components/RoleVisibilityAdmin.jsx', ['Visibilité par rôle']],
  ['src/services/mapService.js', ['getSupportCoordinates', 'clusterMapPoints']],
  ['src/services/roleVisibilityService.js', ['getRoleVisibility', 'columnsForTable']],
  ['src/features/v08/bloc-8-map.css', ['map-workspace']],
  ['src/features/v08/bloc-8-role-visibility.css', ['role-visibility-page']],
  ['supabase/BLOC_8_CARTE_INTERACTIVE.sql', [
    'diagnostic_carte_v08',
    'role_ui_permissions',
    'sync_infrastructure_photo_thumbnail'
  ]],
  ['vercel.json', []]
];

let failed = false;

for (const [relative, requiredTokens] of checks) {
  const file = path.join(root, relative);

  if (!fs.existsSync(file)) {
    console.error(`❌ Fichier absent : ${relative}`);
    failed = true;
    continue;
  }

  const content = fs.readFileSync(file, 'utf8');

  for (const token of requiredTokens) {
    if (!content.includes(token)) {
      console.error(`❌ Élément absent dans ${relative} : ${token}`);
      failed = true;
    }
  }

  if (!failed) console.log(`✅ ${relative}`);
}

if (failed) process.exit(1);

console.log('');
console.log('✅ Bloc 8 installé correctement.');
console.log('✅ Dépendances vérifiées sans réinstallation inutile.');
console.log('✅ Les scripts npm bloqués sont contournés avec --ignore-scripts.');
console.log('');
console.log('Étapes suivantes :');
console.log('1. Exécuter le contenu de supabase/BLOC_8_CARTE_INTERACTIVE.sql dans Supabase.');
console.log('2. Exécuter npm run build.');
console.log('3. Exécuter npm run dev.');
