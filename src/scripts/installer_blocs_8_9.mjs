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

function npmCandidates() {
  const candidates = [];

  if (process.env.npm_execpath && fs.existsSync(process.env.npm_execpath)) {
    candidates.push({
      command: process.execPath,
      args: [process.env.npm_execpath],
      label: 'npm_execpath'
    });
  }

  if (process.platform === 'win32') {
    candidates.push(
      { command: 'npm.cmd', args: [], label: 'npm.cmd' },
      { command: 'cmd.exe', args: ['/d', '/s', '/c', 'npm'], label: 'cmd /c npm' },
      { command: 'powershell.exe', args: ['-NoProfile', '-Command', 'npm'], label: 'PowerShell npm' }
    );

    for (const base of [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean)) {
      const npmCmd = path.join(base, 'nodejs', 'npm.cmd');
      if (fs.existsSync(npmCmd)) {
        candidates.unshift({ command: npmCmd, args: [], label: npmCmd });
      }
    }
  } else {
    candidates.push({ command: 'npm', args: [], label: 'npm' });
  }

  return candidates;
}

function findNpm() {
  for (const candidate of npmCandidates()) {
    const result = spawnSync(candidate.command, [...candidate.args, '--version'], {
      cwd: root,
      encoding: 'utf8',
      shell: false,
      windowsHide: true
    });

    if (result.status === 0) {
      console.log(`✅ npm détecté : ${candidate.label}`);
      return candidate;
    }
  }

  return null;
}

function installPackages(candidate, packages) {
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

  if (candidate.label === 'cmd /c npm') {
    args = [...candidate.args, ...installArgs];
  } else if (candidate.label === 'PowerShell npm') {
    args = ['-NoProfile', '-Command', `npm ${installArgs.join(' ')}`];
  } else {
    args = [...candidate.args, ...installArgs];
  }

  return spawnSync(candidate.command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    windowsHide: true
  }).status === 0;
}

if (!fs.existsSync(packageFile)) {
  fail('package.json introuvable. Lance le script à la racine du projet.');
}

let pkg = readPackageJson();

const dependencies = [
  { name: 'leaflet', version: '1.9.4' },
  { name: 'react-leaflet', version: '4.2.1' },
  { name: 'jspdf', version: '3.0.1' },
  { name: 'xlsx', version: '0.18.5' }
];

const missing = dependencies.filter(item =>
  !dependencyDeclared(pkg, item.name) || !resolvePackage(item.name)
);

if (missing.length) {
  const npm = findNpm();

  if (!npm) {
    console.warn('⚠️ npm ne peut pas être lancé automatiquement.');
    console.warn('Exécute manuellement :');
    console.warn('npm install leaflet@1.9.4 react-leaflet@4.2.1 jspdf@3.0.1 xlsx@0.18.5 --legacy-peer-deps --ignore-scripts');
  } else {
    const ok = installPackages(
      npm,
      missing.map(item => `${item.name}@${item.version}`)
    );

    if (!ok) {
      console.warn('⚠️ Installation automatique incomplète.');
      console.warn('Exécute manuellement :');
      console.warn('npm install leaflet@1.9.4 react-leaflet@4.2.1 jspdf@3.0.1 xlsx@0.18.5 --legacy-peer-deps --ignore-scripts');
    }
  }

  pkg = readPackageJson();
}

for (const dependency of dependencies) {
  if (dependencyDeclared(pkg, dependency.name) && resolvePackage(dependency.name)) {
    console.log(`✅ ${dependency.name}`);
  } else {
    console.warn(`⚠️ ${dependency.name} reste à installer.`);
  }
}

const checks = [
  ['src/main.jsx', ["'Carte interactive'", "'Rapports finaux'"]],
  ['src/components/InteractiveMap.jsx', ['MapContainer']],
  ['src/components/RoleVisibilityAdmin.jsx', ['Visibilité par rôle']],
  ['src/components/FinalReportsCenter.jsx', ['Clôturer et envoyer']],
  ['src/services/finalReportService.js', ['generateFinalReportPdf', 'closeEdtAndSendFinalReport']],
  ['src/features/v09/bloc-9-reports.css', ['final-report-page']],
  ['supabase/BLOC_8_CARTE_INTERACTIVE.sql', ['diagnostic_carte_v08']],
  ['supabase/BLOC_9_RAPPORTS_FINAUX.sql', ['communications_finales']],
  ['supabase/functions/send-final-report/index.ts', ['RESEND_API_KEY']],
  ['vercel.json', []]
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
console.log('✅ Blocs 8 et 9 combinés installés correctement.');
console.log('');
console.log('Ordre suivant :');
console.log('1. Exécuter BLOC_8_CARTE_INTERACTIVE.sql.');
console.log('2. Exécuter BLOC_9_RAPPORTS_FINAUX.sql.');
console.log('3. Déployer la fonction Supabase send-final-report.');
console.log('4. Configurer RESEND_API_KEY et REPORT_FROM_EMAIL.');
console.log('5. npm run build');
console.log('6. npm run dev');
