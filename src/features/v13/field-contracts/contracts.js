export const FIELD_CONTRACT_VERSION = '1.0.0';

const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

const contract = (name, defaults, allowedKeys) => freeze({
  name,
  version: FIELD_CONTRACT_VERSION,
  defaults: { schemaVersion: FIELD_CONTRACT_VERSION, ...defaults },
  allowedKeys: ['schemaVersion', ...allowedKeys]
});

export const TECHNICALLY_PROTECTED_FIELD_POLICY = freeze({
  version: FIELD_CONTRACT_VERSION,
  exactNames: ['support_id'],
  technicalNameSuffixes: ['_id'],
  physicalCharacteristics: [
    'primaryKey',
    'foreignKey',
    'generated',
    'identity'
  ],
  configurableProperties: []
});

export const READONLY_OVERRIDE_SCOPE = freeze({
  surfaces: ['grid', 'form', '360'],
  excludedSurfaces: ['terrain', 'import', 'export'],
  serverAuthorityPreserved: true,
  nullMeansHistoricalBehavior: true
});

export const DISPLAY_CONFIG = contract('DisplayConfig', {
  showInGrid: null,
  showInForm: null,
  showIn360: null,
  displayOrder: null,
  readonlyOverride: null
}, ['showInGrid', 'showInForm', 'showIn360', 'displayOrder', 'readonlyOverride']);

export const VALIDATION_CONFIG = contract('ValidationConfig', {
  requiredOverride: null,
  minimumLength: null,
  maximumLength: null,
  minimumValue: null,
  maximumValue: null,
  allowedValues: null,
  errorMessages: null
}, [
  'requiredOverride', 'minimumLength', 'maximumLength', 'minimumValue',
  'maximumValue', 'allowedValues', 'errorMessages'
]);

export const PERMISSION_CONFIG = contract('PermissionConfig', {
  generalRule: null,
  roleRules: null,
  priorityStrategy: 'deny-wins',
  conservativeDeny: true
}, ['generalRule', 'roleRules', 'priorityStrategy', 'conservativeDeny']);

export const TERRAIN_CRITICAL_FIELDS = freeze([
  'support_id',
  'photo_principale_url',
  'photo_miniature_url',
  'visuel_actuel_cadre'
]);

export const TERRAIN_CONFIG = contract('TerrainConfig', {
  visibleOnTerrain: null,
  readonlyOnTerrain: null,
  terrainRoles: null,
  terrainSection: null,
  terrainDisplayOrder: null,
  criticalFields: TERRAIN_CRITICAL_FIELDS
}, [
  'visibleOnTerrain', 'readonlyOnTerrain', 'terrainRoles', 'terrainSection',
  'terrainDisplayOrder', 'criticalFields'
]);

export const IMPORT_EXPORT_CONFIG = contract('ImportExportConfig', {
  availableInImport: null,
  availableInExport: null,
  importColumnName: null,
  exportColumnName: null,
  importAliases: null,
  exportAliases: null,
  defaultValue: null,
  exchangeContractVersion: FIELD_CONTRACT_VERSION
}, [
  'availableInImport', 'availableInExport', 'importColumnName',
  'exportColumnName', 'importAliases', 'exportAliases', 'defaultValue',
  'exchangeContractVersion'
]);

export const RELATION_CONFIG = contract('RelationConfig', {
  physicalRelation: null,
  functionalRelation: null,
  sourceTable: null,
  sourceField: null,
  targetTable: null,
  targetField: null,
  cardinality: null,
  status: 'draft',
  relationRulesCompatibility: 'legacy-authoritative'
}, [
  'physicalRelation', 'functionalRelation', 'sourceTable', 'sourceField',
  'targetTable', 'targetField', 'cardinality', 'status',
  'relationRulesCompatibility'
]);

export const CALCULATION_CONFIG = contract('CalculationConfig', {
  calculationType: null,
  dependencies: null,
  expression: null,
  nullHandling: null,
  cycleDetection: 'required'
}, [
  'calculationType', 'dependencies', 'expression', 'nullHandling',
  'cycleDetection'
]);

export const ACTIVATION_CONFIG = contract('ActivationConfig', {
  status: 'draft',
  activeVersion: null,
  previousVersion: null,
  changedAt: null,
  changedBy: null,
  activationScope: null
}, [
  'status', 'activeVersion', 'previousVersion', 'changedAt', 'changedBy',
  'activationScope'
]);

export const ACTIVATION_SCOPE_POLICY = freeze({
  supportedScopes: ['field', 'table', 'module', 'global'],
  authorizedPilotScopes: ['field', 'table'],
  requiresExplicitAction: true,
  requiresAtomicOperation: true,
  requiresAudit: true,
  requiresRollback: true,
  requiresSnapshot: true,
  mayChangeBusinessData: false
});

export const FIELD_CONTRACTS = freeze({
  DisplayConfig: DISPLAY_CONFIG,
  ValidationConfig: VALIDATION_CONFIG,
  PermissionConfig: PERMISSION_CONFIG,
  TerrainConfig: TERRAIN_CONFIG,
  ImportExportConfig: IMPORT_EXPORT_CONFIG,
  RelationConfig: RELATION_CONFIG,
  CalculationConfig: CALCULATION_CONFIG,
  ActivationConfig: ACTIVATION_CONFIG
});
