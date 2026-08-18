import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const files = [
  'package.json',
  'scripts/verify_official_workspace.mjs',
  'scripts/verify_workspace_policy.mjs',
  'scripts/verify_terrain_issue_reporting_p0.mjs',
  'scripts/verify_terrain_p0_regression.mjs',
  'src/components/TerrainApp.jsx',
  'src/features/terrain/terrain-issue-reporting-p0.css'
];
const forbidden = [
  ['one', 'drive'].join(''),
  ['tos-display-manager', 'stable'].join('-'),
  ['c:', 'users', 'sim-0'].join('\\')
];

for (const file of files) {
  const source = readFileSync(file, 'utf8').toLowerCase();
  for (const fragment of forbidden) assert.ok(!source.includes(fragment), `${file} dépend d’un ancien chemin interdit.`);
}

console.log(`Politique workspace : ${files.length} sources actives indépendantes de l’ancien arbre.`);
