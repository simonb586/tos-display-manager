import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync('src/main.jsx', 'utf8');
const map = fs.readFileSync('src/components/InteractiveMap.jsx', 'utf8');
const automation = fs.readFileSync('src/features/v13/automation-assistant.css', 'utf8');

for (const field of ['sourceView', 'page', 'pageSize', 'filters', 'search', 'sort', 'visibleColumns', 'scrollY', 'supportId']) {
  assert.ok(main.includes(field), `Contexte manquant: ${field}`);
}
assert.match(main, /initialGridContext=\{active==='Infrastructures'\?navigationContext:null\}/);
assert.match(main, /window\.scrollTo\(\{ top: restoredContext\.scrollY/);
assert.match(main, /window\.history\.pushState/);
assert.match(main, /addEventListener\('popstate'/);
assert.match(map, /Retour aux infrastructures/);
assert.match(map, /hasInfrastructureContext \? 'Retour aux infrastructures' : 'Infrastructures'/);
assert.match(automation, /width:180px!important;min-width:180px!important;max-width:180px!important/);
assert.match(automation, /-webkit-line-clamp:2/);
assert.match(automation, /automation-compact-actions/);

console.log('Retour contextuel Infrastructures et grille Automatisations: PASS');
