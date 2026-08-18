import { execFileSync } from 'node:child_process';
import { lstatSync, realpathSync } from 'node:fs';
import path from 'node:path';

const OFFICIAL_ROOT = path.win32.normalize('C:\\dev\\tos-display-manager');
const OFFICIAL_BRANCH = 'release/v1.3.3';
const forbiddenFragments = [
  ['one', 'drive'].join(''),
  ['tos-display-manager', 'stable'].join('-')
];
const fail = detail => {
  console.error(`WORKSPACE_ERROR:\nLe développement doit être exécuté depuis ${OFFICIAL_ROOT}.\n${detail}`);
  process.exit(1);
};
const normalize = value => path.win32.normalize(String(value || '').trim()).replace(/[\\/]+$/, '').toLowerCase();
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const isWindowsReparsePoint = root => {
  if (process.platform !== 'win32') return false;
  if (lstatSync(root).isSymbolicLink()) return true;
  try { execFileSync('fsutil', ['reparsepoint', 'query', root], { stdio: 'ignore' }); return true; }
  catch { return false; }
};

let root;
let branch;
try {
  root = git('rev-parse', '--show-toplevel');
  branch = git('branch', '--show-current');
} catch (error) {
  fail(`Git est inaccessible : ${error.message}`);
}

const cwd = normalize(process.cwd());
const normalizedRoot = normalize(root);
const realCwd = normalize(realpathSync.native(process.cwd()));
const realRoot = normalize(realpathSync.native(root));
const forbidden = forbiddenFragments.some(fragment => [cwd, normalizedRoot, realCwd, realRoot].some(value => value.includes(fragment)));
if (forbidden) fail(`Chemin interdit détecté : ${root}`);
if (cwd !== normalizedRoot) fail(`Lancez la commande depuis la racine Git : ${root}`);
if (realCwd !== realRoot) fail(`Résolution physique incohérente : ${realCwd} / ${realRoot}`);
if (isWindowsReparsePoint(root)) fail(`La racine Git est un lien, une jonction ou un reparse point : ${root}`);

const isCI = Boolean(process.env.CI || process.env.GITHUB_ACTIONS || process.env.VERCEL);
if (!isCI && process.platform === 'win32' && realRoot !== normalize(OFFICIAL_ROOT)) {
  fail(`Racine détectée : ${root}`);
}
if (!isCI && branch !== OFFICIAL_BRANCH) fail(`Branche détectée : ${branch || '(HEAD détachée)'}. Branche requise : ${OFFICIAL_BRANCH}.`);

console.log(`Workspace officiel validé : ${root} (${branch || 'CI/HEAD détachée'}).`);
