import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FIELD_CONTRACTS,
  FIELD_CONTRACT_VERSION,
  FIELD_CONTRACT_VERSION_REGISTRY,
  ACTIVATION_SCOPE_POLICY,
  READONLY_OVERRIDE_SCOPE,
  TECHNICALLY_PROTECTED_FIELD_POLICY,
  TERRAIN_CRITICAL_FIELDS,
  normalizeFieldContract,
  stableSerializeFieldContract,
  validateFieldContract
} from '../src/features/v13/field-contracts/index.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const contractsDirectory = join(root, 'src', 'features', 'v13', 'field-contracts');
const contractNames = [
  'DisplayConfig',
  'ValidationConfig',
  'PermissionConfig',
  'TerrainConfig',
  'ImportExportConfig',
  'RelationConfig',
  'CalculationConfig',
  'ActivationConfig'
];

assert.equal(FIELD_CONTRACT_VERSION, '1.0.0');
assert.deepEqual(Object.keys(FIELD_CONTRACTS), contractNames);
assert.ok(FIELD_CONTRACT_VERSION_REGISTRY['1.0.0']);
assert.deepEqual(TECHNICALLY_PROTECTED_FIELD_POLICY.exactNames, ['support_id']);
assert.deepEqual(TECHNICALLY_PROTECTED_FIELD_POLICY.technicalNameSuffixes, ['_id']);
assert.deepEqual(
  TECHNICALLY_PROTECTED_FIELD_POLICY.physicalCharacteristics,
  ['primaryKey', 'foreignKey', 'generated', 'identity']
);
assert.deepEqual(TECHNICALLY_PROTECTED_FIELD_POLICY.configurableProperties, []);
assert.deepEqual(READONLY_OVERRIDE_SCOPE.surfaces, ['grid', 'form', '360']);
assert.deepEqual(READONLY_OVERRIDE_SCOPE.excludedSurfaces, ['terrain', 'import', 'export']);
assert.equal(READONLY_OVERRIDE_SCOPE.serverAuthorityPreserved, true);

for (const name of contractNames) {
  const definition = FIELD_CONTRACTS[name];
  assert.equal(definition.version, '1.0.0', `${name} doit être versionné.`);
  assert.equal(definition.defaults.schemaVersion, '1.0.0');
  assert.equal(validateFieldContract(name, definition.defaults).valid, true, `${name} doit avoir des défauts valides.`);
  assert.deepEqual(
    normalizeFieldContract(name, {}),
    definition.defaults,
    `${name} doit appliquer ses défauts de façon déterministe.`
  );
  assert.equal(
    validateFieldContract(name, { ...definition.defaults, unknownProperty: true }).valid,
    false,
    `${name} doit refuser les propriétés inconnues.`
  );
  assert.equal(
    validateFieldContract(name, { ...definition.defaults, schemaVersion: '99.0.0' }).valid,
    false,
    `${name} doit refuser les versions inconnues.`
  );
  assert.equal(
    stableSerializeFieldContract(name, {}),
    stableSerializeFieldContract(name, { ...definition.defaults }),
    `${name} doit avoir une sérialisation stable.`
  );
}

const display = normalizeFieldContract('DisplayConfig', { showInGrid: null });
assert.equal(display.showInGrid, null);
assert.equal(display.showInForm, null);
assert.equal(display.showIn360, null);
assert.equal(display.displayOrder, null);
assert.equal(display.readonlyOverride, null);

const validation = normalizeFieldContract('ValidationConfig', {});
for (const value of Object.entries(validation).filter(([key]) => key !== 'schemaVersion').map(([, value]) => value)) {
  assert.equal(value, null, 'ValidationConfig doit préserver le comportement historique par défaut.');
}
assert.throws(() => normalizeFieldContract('ValidationConfig', {
  minimumLength: 20,
  maximumLength: 10
}));

const permissions = normalizeFieldContract('PermissionConfig', {});
assert.equal(permissions.generalRule, null);
assert.equal(permissions.roleRules, null);
assert.equal(permissions.priorityStrategy, 'deny-wins');
assert.equal(permissions.conservativeDeny, true);
assert.throws(() => normalizeFieldContract('PermissionConfig', { conservativeDeny: false }));
assert.throws(() => normalizeFieldContract('PermissionConfig', { priorityStrategy: 'specific-first' }));
assert.throws(() => normalizeFieldContract('PermissionConfig', { priorityStrategy: null }));

const terrain = normalizeFieldContract('TerrainConfig', {});
assert.deepEqual(terrain.criticalFields, TERRAIN_CRITICAL_FIELDS);
assert.equal(terrain.visibleOnTerrain, null);
assert.equal(terrain.readonlyOnTerrain, null);
assert.equal(terrain.terrainDisplayOrder, null);

const exchange = normalizeFieldContract('ImportExportConfig', {});
assert.equal(exchange.availableInImport, null);
assert.equal(exchange.availableInExport, null);
assert.equal(exchange.importAliases, null);
assert.equal(exchange.exportAliases, null);
assert.equal(exchange.exchangeContractVersion, '1.0.0');
assert.equal(
  validateFieldContract('ImportExportConfig', {
    ...exchange,
    aliases: ['legacy']
  }).valid,
  false
);

const relation = normalizeFieldContract('RelationConfig', {});
assert.equal(relation.status, 'draft');
assert.equal(relation.relationRulesCompatibility, 'legacy-authoritative');
assert.throws(() => normalizeFieldContract('RelationConfig', { status: 'active' }));

const calculation = normalizeFieldContract('CalculationConfig', {
  calculationType: 'arithmetic',
  dependencies: ['quantity', 'unit_price'],
  expression: {
    kind: 'operation',
    operator: 'multiply',
    operands: [
      { kind: 'field', field: 'quantity' },
      { kind: 'field', field: 'unit_price' }
    ]
  }
});
assert.equal(calculation.expression.operator, 'multiply');
for (const executableExpression of [
  'return row.quantity * row.unit_price',
  'SELECT quantity * unit_price',
  { kind: 'operation', operator: 'eval', operands: [{ kind: 'literal', value: 1 }] }
]) {
  assert.throws(() => normalizeFieldContract('CalculationConfig', { expression: executableExpression }));
}

const activation = normalizeFieldContract('ActivationConfig', {});
assert.equal(activation.status, 'draft');
assert.equal(activation.activeVersion, null);
assert.equal(activation.activationScope, null);
assert.deepEqual(ACTIVATION_SCOPE_POLICY.supportedScopes, ['field', 'table', 'module', 'global']);
assert.deepEqual(ACTIVATION_SCOPE_POLICY.authorizedPilotScopes, ['field', 'table']);
assert.equal(ACTIVATION_SCOPE_POLICY.requiresSnapshot, true);
assert.equal(ACTIVATION_SCOPE_POLICY.mayChangeBusinessData, false);
for (const activationScope of ACTIVATION_SCOPE_POLICY.supportedScopes) {
  assert.equal(
    normalizeFieldContract('ActivationConfig', { activationScope }).activationScope,
    activationScope
  );
}
assert.throws(() => normalizeFieldContract('ActivationConfig', { activationScope: 'application' }));

assert.throws(() => normalizeFieldContract('ImportExportConfig', {
  defaultValue: () => 'interdit'
}));
const circular = {};
circular.self = circular;
assert.throws(() => normalizeFieldContract('ImportExportConfig', {
  defaultValue: circular
}));

const stableA = stableSerializeFieldContract('PermissionConfig', {
  roleRules: { Client: { editable: false, visible: true } },
  generalRule: { visible: null, editable: null }
});
const stableB = stableSerializeFieldContract('PermissionConfig', {
  generalRule: { editable: null, visible: null },
  roleRules: { Client: { visible: true, editable: false } }
});
assert.equal(stableA, stableB);

async function listSources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listSources(path));
    else if (['.js', '.jsx'].includes(extname(entry.name))) files.push(path);
  }
  return files;
}

const contractSources = await Promise.all(
  (await listSources(contractsDirectory)).map(path => readFile(path, 'utf8'))
);
const combinedContracts = contractSources.join('\n');
assert.doesNotMatch(combinedContracts, /supabase|fetch\s*\(|XMLHttpRequest|\.rpc\s*\(|\.from\s*\(/i);
assert.doesNotMatch(combinedContracts, /\basync\s+function\b|\basync\s*\(/i);
assert.doesNotMatch(
  combinedContracts,
  /\bexport\s+(?:async\s+)?function\s+\w*(?:save|write|insert|update|delete|upsert|synchroni[sz]e)\w*/i
);
assert.doesNotMatch(
  combinedContracts,
  /from\s+['"][^.'"][^'"]*['"]/,
  'Le module ne doit importer aucune dépendance applicative ou externe.'
);

const protectedConsumers = [
  'src/components/EditableField.jsx',
  'src/services/universalEditorService.js',
  'src/components/TerrainApp.jsx',
  'src/components/Support360Panel.jsx',
  'src/components/RelationsStudio.jsx',
  'src/services/relationService.js',
  'src/main.jsx'
];
for (const consumer of protectedConsumers) {
  const source = await readFile(join(root, consumer), 'utf8');
  assert.doesNotMatch(source, /field-contracts|DisplayConfig|ActivationConfig/);
}

const allApplicationSources = await listSources(join(root, 'src'));
const authorizedContractAdapters = new Set([
  join(root, 'src', 'lib', 'fieldCatalogDisplayDraft.js'),
  join(root, 'src', 'services', 'fieldCatalogDisplayValidationService.js'),
  join(root, 'src', 'services', 'fieldCatalogDisplayWriteService.js')
]);
for (const path of allApplicationSources) {
  if (path.startsWith(contractsDirectory) || authorizedContractAdapters.has(path)) continue;
  const source = await readFile(path, 'utf8');
  assert.doesNotMatch(
    source,
    /features\/v13\/field-contracts|features\\v13\\field-contracts/,
    `Consommateur non autorisé: ${relative(root, path)}`
  );
}

console.log('Phase 13.1-A3.2 : contrats versionnés, purs et sans consommateur validés.');
