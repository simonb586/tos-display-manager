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

function candidateNpmCommands() {
  const candidates = [];

  if (process.env.npm_execpath && fs.existsSync(process.env.npm_execpath)) {
    candidates.push({
      command: process.execPath,
      prefixArgs: [process.env.npm_execpath],
      label: 'npm via npm_execpath'
    });
  }

  if (process.platform === 'win32') {
    candidates.push(
      { command: 'npm.cmd', prefixArgs: [], label: 'npm.cmd' },
      { command: 'npm.exe', prefixArgs: [], label: 'npm.exe' },
      { command: 'cmd.exe', prefixArgs: ['/d', '/s', '/c', 'npm'], label: 'cmd.exe /c npm' },
      { command: 'powershell.exe', prefixArgs: ['-NoProfile', '-Command', 'npm'], label: 'PowerShell npm' }
    );

    const programFiles = [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean);

    for (const base of programFiles) {
      const npmCmd = path.join(base, 'nodejs', 'npm.cmd');
      if (fs.existsSync(npmCmd)) {
        candidates.unshift({ command: npmCmd, prefixArgs: [], label: npmCmd });
      }
    }

    const appDataNpm = process.env.APPDATA
      ? path.join(process.env.APPDATA, 'npm', 'npm.cmd')
      : null;

    if (appDataNpm && fs.existsSync(appDataNpm)) {
      candidates.unshift({ command: appDataNpm, prefixArgs: [], label: appDataNpm });
    }
  } else {
    candidates.push(
      { command: 'npm', prefixArgs: [], label: 'npm' },
      { command: '/usr/local/bin/npm', prefixArgs: [], label: '/usr/local/bin/npm' },
      { command: '/usr/bin/npm', prefixArgs: [], label: '/usr/bin/npm' }
    );
  }

  return candidates;
}

function canRunNpm(candidate) {
  const result = spawnSync(
    candidate.command,
    [...candidate.prefixArgs, '--version'],
    {
      cwd: root,
      encoding: 'utf8',
      shell: false,
      windowsHide: true
    }
  );

  return result.status === 0;
}

function findWorkingNpm() {
  for (const candidate of candidateNpmCommands()) {
    if (canRunNpm(candidate)) {
      console.log(`✅ npm détecté : ${candidate.label}`);
      return candidate;
    }
  }
  return null;
}

function runNpmInstall(candidate, packages) {
  const installArgs = [
    'install',
    ...packages,
    '--save',
    '--legacy-peer-deps',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund'
  ];

  let args;

  if (candidate.label === 'cmd.exe /c npm') {
    args = [...candidate.prefixArgs, ...installArgs];
  } else if (candidate.label === 'PowerShell npm') {
    args = [
      '-NoProfile',
      '-Command',
      `npm ${installArgs.map(value => `\"${String(value).replaceAll('\"', '`"')}\"`).join(' ')}`
    ];
  } else {
    args = [...candidate.prefixArgs, ...installArgs];
  }

  console.log(`Installation npm : ${packages.join(', ')}`);

  const result = spawnSync(candidate.command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    windowsHide: true
  });

  return result.status === 0;
}

if (!fs.existsSync(packageFile)) {
  fail('package.json introuvable. Lance ce script à la racine du projet.');
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
  const npm = findWorkingNpm();

  if (!npm) {
    console.warn('⚠️ npm n’a pas pu être lancé automatiquement depuis Node.');
    console.warn('⚠️ Le Bloc 8 reste copié, mais les dépendances manquantes doivent être installées manuellement.');
    console.warn('');
    console.warn('Commande manuelle :');
    console.warn('npm install leaflet@1.9.4 react-leaflet@4.2.1 --legacy-peer-deps --ignore-scripts');
    console.warn('');
  } else {
    const ok = runNpmInstall(
      npm,
      missing.map(item => `${item.name}@${item.version}`)
    );

    if (!ok) {
      console.warn('⚠️ L’installation automatique npm a échoué.');
      console.warn('⚠️ Le Bloc 8 reste installé. Exécute manuellement :');
      console.warn('npm install leaflet@1.9.4 react-leaflet@4.2.1 --legacy-peer-deps --ignore-scripts');
      console.warn('');
    }

    pkg = readPackageJson();
  }
} else {
  console.log('✅ Leaflet et React-Leaflet sont déjà installés.');
}

for (const item of required) {
  const declared = dependencyDeclared(pkg, item.name);
  const resolvable = resolvePackage(item.name);

  if (declared && resolvable) {
    console.log(`✅ ${item.name}`);
  } else {
    console.warn(`⚠️ ${item.name} reste à installer manuellement.`);
  }
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
console.log('✅ Bloc 8 robuste final installé correctement.');
console.log('✅ L’installateur ne bloque plus si npm ne peut pas être lancé automatiquement.');
console.log('');
console.log('Étapes suivantes :');
console.log('1. Exécuter le contenu de supabase/BLOC_8_CARTE_INTERACTIVE.sql dans Supabase.');
console.log('2. Exécuter npm run build.');
console.log('3. Exécuter npm run dev.');
