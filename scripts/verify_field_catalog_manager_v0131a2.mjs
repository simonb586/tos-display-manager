import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FIELD_CATALOG_FILTERS, filterCatalogFields, mergeFieldCatalog } from '../src/lib/fieldCatalog.js';

const schema = { infrastructures: [
  { tableName: 'infrastructures', columnName: 'id', dataType: 'uuid', primaryKey: true, unique: true, generated: false, ordinalPosition: 1 },
  { tableName: 'infrastructures', columnName: 'support_id', dataType: 'text', unique: true, ordinalPosition: 2 },
  { tableName: 'infrastructures', columnName: 'client_id', dataType: 'uuid', foreignKey: true, foreignTable: 'clients', foreignColumn: 'id', ordinalPosition: 3 },
  { tableName: 'infrastructures', columnName: 'search_vector', dataType: 'tsvector', generated: true, ordinalPosition: 4 }
] };
const rows = [
  { id: '1', table_name: 'infrastructures', field_name: 'support_id', field_label: 'Numéro du support', field_type: 'texte', configuration_status: 'active', readonly_override: true },
  { id: '2', table_name: 'infrastructures', field_name: 'created_at', field_label: 'Créé le', field_type: 'date_heure', configuration_status: 'draft', is_system: true, physical_data_type: 'timestamptz' }
];
const fields = mergeFieldCatalog(rows, schema);

assert.equal(fields.length, 5);
assert.equal(fields.find(field => field.technicalName === 'id').primaryKey, true);
assert.equal(fields.find(field => field.technicalName === 'support_id').functionalType, 'texte');
assert.equal(fields.find(field => field.technicalName === 'client_id').foreignKey, true);
assert.equal(filterCatalogFields(fields, { query: 'numéro' }).length, 1);
assert.equal(filterCatalogFields(fields, { filter: 'configured' }).length, 2);
assert.equal(filterCatalogFields(fields, { filter: 'unconfigured' }).length, 3);
assert.equal(filterCatalogFields(fields, { filter: 'system' }).length, 2);
assert.equal(filterCatalogFields(fields, { filter: 'primary' }).length, 1);
assert.equal(filterCatalogFields(fields, { filter: 'unique' }).length, 2);
assert.equal(filterCatalogFields(fields, { filter: 'relations' }).length, 1);
assert.equal(filterCatalogFields(fields, { filter: 'generated' }).length, 1);
assert.deepEqual(FIELD_CATALOG_FILTERS.map(item => item[0]), ['all','configured','unconfigured','system','primary','unique','relations','generated']);

const componentFiles = [
  '../src/components/FieldCatalogManager.jsx',
  '../src/components/field-catalog/FieldCatalogList.jsx',
  '../src/components/field-catalog/FieldCatalogDrawer.jsx',
  '../src/components/field-catalog/FieldCatalogGeneralTab.jsx'
];
const component = (await Promise.all(componentFiles.map(file => readFile(new URL(file, import.meta.url), 'utf8')))).join('\n');
assert.match(component, /role === 'Administrateur'/);
assert.match(component, /Accès réservé/);
assert.match(component, /readOnly aria-readonly="true"/);
for (const forbidden of ['Enregistrer', 'Ajouter', 'Supprimer', 'Activer', 'Synchroniser']) {
  assert.ok(!component.includes(`>${forbidden}<`), `Action interdite : ${forbidden}`);
}

const service = await readFile(new URL('../src/services/fieldCatalogService.js', import.meta.url), 'utf8');
const loadResult = await readFile(new URL('../src/lib/fieldCatalogLoadResult.js', import.meta.url), 'utf8');
assert.match(service, /\.select\('\*'\)/);
assert.match(service, /Promise\.allSettled/);
assert.match(loadResult, /13\.1-A1 n’est pas encore disponible/);
assert.doesNotMatch(service, /\.(insert|update|upsert|delete)\s*\(/);
assert.doesNotMatch(service, /refresh_relation_field_physical_metadata_v0131a/);

const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');
assert.match(main, /role === 'Administrateur'[\s\S]*Gestionnaire des champs/);
assert.match(main, /active === 'Gestionnaire des champs'/);

for (const file of [
  '../src/components/EditableField.jsx', '../src/services/universalEditorService.js',
  '../src/components/TerrainApp.jsx', '../src/components/RelationsStudio.jsx'
]) {
  const content = await readFile(new URL(file, import.meta.url), 'utf8');
  assert.doesNotMatch(content, /FieldCatalogManager|fieldCatalogService/);
}

console.log('Phase 13.1-A2 : 30 contrôles du Gestionnaire des champs réussis.');
