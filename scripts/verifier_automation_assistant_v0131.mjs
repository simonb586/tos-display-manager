import assert from 'node:assert/strict';
import * as catalog from '../src/config/automationCatalog.js';

const catalogs = [
  catalog.automationTriggers,
  catalog.automationLocations,
  catalog.automationModules,
  catalog.automationActions,
  catalog.automationValueSources,
  catalog.automationConditions,
  catalog.automationAfterActions,
  catalog.automationRecipients,
  catalog.automationStatuses,
  catalog.automationPriorities
];

for (const entries of catalogs) {
  const keys = entries.map(([key]) => key);
  assert.equal(new Set(keys).size, keys.length, 'Les clés de catalogue doivent être uniques.');
  assert.ok(entries.every(([, label]) => String(label).trim()), 'Chaque choix doit avoir un libellé.');
}

const empty = catalog.emptyAutomation();
assert.equal(empty.status, 'draft');
assert.equal(empty.priority, 'normal');
assert.deepEqual(empty.definition.triggers, []);
assert.deepEqual(empty.definition.targets, []);

const source = await import('node:fs/promises').then(fs =>
  fs.readFile(new URL('../src/services/automationService.js', import.meta.url), 'utf8')
);
assert.ok(!source.includes('relation_rules'));
assert.ok(!source.includes('executeRelationRule'));
assert.ok(!source.includes('installRelationTriggers'));

console.log(`OK: ${catalogs.length + 7} vérifications de l’Assistant réussies.`);
