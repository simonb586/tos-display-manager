import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fieldCatalogId } from '../src/lib/fieldCatalog.js';
import { buildFieldCatalogLoadResult } from '../src/lib/fieldCatalogLoadResult.js';
import { FIELD_CATALOG_FUTURE_SERVICE_CONTRACTS } from '../src/services/fieldCatalogContracts.js';

assert.notEqual(fieldCatalogId('a.b', 'c'), fieldCatalogId('a', 'b.c'));
assert.equal(fieldCatalogId('infrastructures', 'support_id'), '["infrastructures","support_id"]');

const catalogRow = { table_name: 'infrastructures', field_name: 'support_id', field_label: 'Numéro du support' };
const schema = { infrastructures: [{ tableName: 'infrastructures', columnName: 'support_id', dataType: 'text' }] };
const available = buildFieldCatalogLoadResult({ catalogRows: [catalogRow], schema });
assert.equal(available.data.fields.length, 1);
assert.equal(available.data.fields[0].fieldId, fieldCatalogId('infrastructures', 'support_id'));
assert.equal(available.capabilities.catalogRead, true);
assert.equal(available.capabilities.physicalMetadataRead, true);
assert.equal(available.migrationState.status, 'available');
assert.equal(available.catalogState, 'available');
assert.deepEqual(available.errors, []);

const missingMigration = buildFieldCatalogLoadResult({
  catalogRows: [catalogRow],
  metadataError: { code: 'PGRST202', message: 'function missing' }
});
assert.equal(missingMigration.migrationState.status, 'missing');
assert.equal(missingMigration.warnings[0].code, 'migration_missing');
assert.deepEqual(missingMigration.errors, []);

const emptyCatalog = buildFieldCatalogLoadResult({ catalogRows: [], schema });
assert.equal(emptyCatalog.catalogState, 'empty');
assert.equal(emptyCatalog.data.fields.length, 1, 'Les champs physiques restent consultables si relation_fields est vide.');

const missingMetadata = buildFieldCatalogLoadResult({ catalogRows: [catalogRow], schema: {} });
assert.equal(missingMetadata.migrationState.status, 'available');
assert.equal(missingMetadata.capabilities.physicalMetadataRead, false);
assert.equal(missingMetadata.warnings[0].code, 'physical_metadata_missing');

const realError = buildFieldCatalogLoadResult({
  catalogError: { code: 'XX000', message: 'network failure' },
  metadataError: { code: 'XX001', message: 'metadata failure' }
});
assert.equal(realError.catalogState, 'error');
assert.equal(realError.migrationState.status, 'unknown');
assert.equal(realError.errors.length, 2);

for (const contract of Object.values(FIELD_CATALOG_FUTURE_SERVICE_CONTRACTS)) {
  assert.equal(contract.active, false);
  assert.equal(typeof contract.responsibility, 'string');
  assert.ok(contract.futureOperations.length > 0);
  assert.ok(Object.values(contract).every(value => typeof value !== 'function'), 'Les contrats futurs ne doivent exposer aucune fonction active.');
}

const manager = await readFile(new URL('../src/components/FieldCatalogManager.jsx', import.meta.url), 'utf8');
const list = await readFile(new URL('../src/components/field-catalog/FieldCatalogList.jsx', import.meta.url), 'utf8');
const drawer = await readFile(new URL('../src/components/field-catalog/FieldCatalogDrawer.jsx', import.meta.url), 'utf8');
const tabs = await readFile(new URL('../src/components/field-catalog/FieldCatalogTabs.jsx', import.meta.url), 'utf8');
const registry = await readFile(new URL('../src/components/field-catalog/tabRegistry.js', import.meta.url), 'utf8');
const hook = await readFile(new URL('../src/hooks/useFieldCatalog.js', import.meta.url), 'utf8');
const service = await readFile(new URL('../src/services/fieldCatalogService.js', import.meta.url), 'utf8');
const combined = [manager, list, drawer, tabs, registry, hook, service].join('\n');

assert.match(manager, /useFieldCatalog/);
assert.match(manager, /FieldCatalogList/);
assert.match(manager, /FieldCatalogDrawer/);
assert.match(list, /FIELD_CATALOG_FILTERS/);
assert.match(drawer, /FieldCatalogTabs/);
assert.match(registry, /id: 'general'/);
assert.match(tabs, /tabs\.length <= 1\) return null/, 'Un seul onglet ne doit pas afficher une navigation inutile.');
assert.match(hook, /invalidateFieldCatalogCache/);
assert.match(service, /CACHE_TTL_MS/);
assert.match(service, /invalidateFieldCatalogCache/);
assert.doesNotMatch(combined, /refresh_relation_field_physical_metadata_v0131a/);
assert.doesNotMatch(combined, /\.(insert|update|upsert|delete)\s*\(/);
for (const forbidden of ['Enregistrer', 'Ajouter', 'Supprimer', 'Activer', 'Synchroniser']) {
  assert.ok(!combined.includes(`>${forbidden}<`), `Action interdite : ${forbidden}`);
}

for (const file of [
  '../src/components/RelationsStudio.jsx', '../src/services/relationService.js',
  '../src/components/EditableField.jsx', '../src/services/universalEditorService.js',
  '../src/components/TerrainApp.jsx', '../src/components/Support360Panel.jsx'
]) {
  const content = await readFile(new URL(file, import.meta.url), 'utf8');
  assert.doesNotMatch(content, /useFieldCatalog|FieldCatalogDrawer|fieldCatalogContracts/);
}

console.log('Phase 13.1-A3.0 : 42 contrôles de consolidation structurelle réussis.');
