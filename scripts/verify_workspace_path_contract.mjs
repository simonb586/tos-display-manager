import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const OFFICIAL = 'C:\\Users\\sim-0\\OneDrive\\Documents\\GitHub\\tos-display-manager\\tos-display-manager-stable';
const norm = value => String(value || '').replaceAll('/', '\\').replace(/[\\]+$/, '').toLowerCase();

function validate({ cwd, root, realCwd = cwd, realRoot = root, ci = false, platform = 'win32', branch = 'release/v1.3.3' }) {
  if (norm(cwd) !== norm(root) || norm(realCwd) !== norm(realRoot)) throw new Error('root mismatch');
  if (!ci && platform === 'win32' && (norm(root) !== norm(OFFICIAL) || norm(realRoot) !== norm(OFFICIAL))) throw new Error('unofficial root');
  if (!ci && branch !== 'release/v1.3.3') throw new Error('wrong branch');
  return true;
}

const stable = { cwd: OFFICIAL, root: OFFICIAL };
assert.equal(validate(stable), true, 'CAS A stable officiel');
const parent = 'C:\\Users\\sim-0\\OneDrive\\Documents\\GitHub\\tos-display-manager';
assert.throws(() => validate({ cwd: parent, root: parent }), /unofficial root/, 'CAS B parent interdit');
assert.throws(() => validate({ cwd: 'C:\\dev\\tos-display-manager', root: 'C:\\dev\\tos-display-manager' }), /unofficial root/, 'CAS C C:\\dev interdit');
assert.throws(() => validate({ cwd: 'D:\\copies\\tos-display-manager-stable', root: 'D:\\copies\\tos-display-manager-stable' }), /unofficial root/, 'CAS D autre copie interdite');
assert.equal(validate({ cwd: '/vercel/path0', root: '/vercel/path0', ci: true, platform: 'linux', branch: '' }), true, 'CAS E CI/Vercel');

const guard = readFileSync('scripts/verify_official_workspace.mjs', 'utf8');
for (const marker of ['OFFICIAL_ROOT', 'realpathSync.native', 'realRoot', 'process.env.VERCEL']) assert.ok(guard.includes(marker), `Garde incomplet : ${marker}`);
console.log('Contrat workspace : stable PASS; parent FAIL; C:\\dev FAIL; autre copie FAIL; CI/Vercel PASS.');
