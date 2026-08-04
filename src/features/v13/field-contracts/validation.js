import { FIELD_CONTRACTS, FIELD_CONTRACT_VERSION } from './contracts.js';
import { getFieldContract, isSupportedFieldContractVersion } from './registry.js';

const plainObject = value =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

const booleanOrNull = value => value === null || typeof value === 'boolean';
const integerOrNull = value => value === null || Number.isInteger(value);
const finiteNumberOrNull = value =>
  value === null || (typeof value === 'number' && Number.isFinite(value));
const stringOrNull = value => value === null || typeof value === 'string';
const stringArrayOrNull = value =>
  value === null || (
    Array.isArray(value) &&
    value.every(item => typeof item === 'string')
  );

function addError(errors, condition, path, message) {
  if (!condition) errors.push({ path, message });
}

function validateRule(value, path, errors) {
  addError(errors, value === null || plainObject(value), path, 'La règle doit être un objet ou NULL.');
  if (value === null || !plainObject(value)) return;
  const unknown = Object.keys(value).filter(key => !['visible', 'editable'].includes(key));
  addError(errors, unknown.length === 0, path, `Propriétés inconnues: ${unknown.join(', ')}`);
  addError(errors, booleanOrNull(value.visible ?? null), `${path}.visible`, 'Valeur booléenne ou NULL attendue.');
  addError(errors, booleanOrNull(value.editable ?? null), `${path}.editable`, 'Valeur booléenne ou NULL attendue.');
}

function validateExpression(node, path, errors, depth = 0) {
  if (node === null) return;
  addError(errors, depth <= 20, path, 'Expression déclarative trop profonde.');
  if (depth > 20) return;
  addError(errors, plainObject(node), path, 'Une expression doit être un arbre déclaratif JSON.');
  if (!plainObject(node)) return;

  const kind = node.kind;
  addError(errors, ['literal', 'field', 'operation'].includes(kind), `${path}.kind`, 'Type de nœud invalide.');
  if (kind === 'literal') {
    const unknown = Object.keys(node).filter(key => !['kind', 'value'].includes(key));
    addError(errors, unknown.length === 0, path, `Propriétés inconnues: ${unknown.join(', ')}`);
    addError(
      errors,
      node.value === null || ['string', 'number', 'boolean'].includes(typeof node.value),
      `${path}.value`,
      'Littéral JSON primitif attendu.'
    );
  } else if (kind === 'field') {
    const unknown = Object.keys(node).filter(key => !['kind', 'field'].includes(key));
    addError(errors, unknown.length === 0, path, `Propriétés inconnues: ${unknown.join(', ')}`);
    addError(errors, typeof node.field === 'string' && node.field.length > 0, `${path}.field`, 'Nom de champ requis.');
  } else if (kind === 'operation') {
    const unknown = Object.keys(node).filter(key => !['kind', 'operator', 'operands'].includes(key));
    addError(errors, unknown.length === 0, path, `Propriétés inconnues: ${unknown.join(', ')}`);
    addError(
      errors,
      ['add', 'subtract', 'multiply', 'divide', 'concat', 'coalesce'].includes(node.operator),
      `${path}.operator`,
      'Opérateur déclaratif non autorisé.'
    );
    addError(errors, Array.isArray(node.operands) && node.operands.length > 0, `${path}.operands`, 'Opérandes requises.');
    if (Array.isArray(node.operands)) {
      node.operands.forEach((operand, index) =>
        validateExpression(operand, `${path}.operands[${index}]`, errors, depth + 1)
      );
    }
  }
}

const validators = {
  DisplayConfig(config, errors) {
    for (const key of ['showInGrid', 'showInForm', 'showIn360', 'readonlyOverride']) {
      addError(errors, booleanOrNull(config[key]), key, 'Valeur booléenne ou NULL attendue.');
    }
    addError(errors, integerOrNull(config.displayOrder), 'displayOrder', 'Entier ou NULL attendu.');
    if (config.displayOrder !== null) {
      addError(errors, config.displayOrder >= 0 && config.displayOrder <= 100000, 'displayOrder', 'Valeur hors limites.');
    }
  },
  ValidationConfig(config, errors) {
    addError(errors, booleanOrNull(config.requiredOverride), 'requiredOverride', 'Valeur booléenne ou NULL attendue.');
    for (const key of ['minimumLength', 'maximumLength']) {
      addError(errors, integerOrNull(config[key]), key, 'Entier ou NULL attendu.');
      if (config[key] !== null) addError(errors, config[key] >= 0, key, 'Valeur négative interdite.');
    }
    for (const key of ['minimumValue', 'maximumValue']) {
      addError(errors, finiteNumberOrNull(config[key]), key, 'Nombre fini ou NULL attendu.');
    }
    addError(
      errors,
      config.allowedValues === null || (
        Array.isArray(config.allowedValues) &&
        config.allowedValues.every(value =>
          value === null || ['string', 'number', 'boolean'].includes(typeof value)
        )
      ),
      'allowedValues',
      'Liste de valeurs JSON primitives ou NULL attendue.'
    );
    addError(errors, config.errorMessages === null || plainObject(config.errorMessages), 'errorMessages', 'Objet ou NULL attendu.');
    if (plainObject(config.errorMessages)) {
      addError(
        errors,
        Object.values(config.errorMessages).every(message => typeof message === 'string'),
        'errorMessages',
        'Tous les messages doivent être textuels.'
      );
    }
    if (config.minimumLength !== null && config.maximumLength !== null) {
      addError(errors, config.minimumLength <= config.maximumLength, 'maximumLength', 'Maximum inférieur au minimum.');
    }
    if (config.minimumValue !== null && config.maximumValue !== null) {
      addError(errors, config.minimumValue <= config.maximumValue, 'maximumValue', 'Maximum inférieur au minimum.');
    }
  },
  PermissionConfig(config, errors) {
    validateRule(config.generalRule, 'generalRule', errors);
    addError(errors, config.roleRules === null || plainObject(config.roleRules), 'roleRules', 'Objet par rôle ou NULL attendu.');
    if (plainObject(config.roleRules)) {
      Object.entries(config.roleRules).forEach(([role, rule]) => validateRule(rule, `roleRules.${role}`, errors));
    }
    addError(
      errors,
      config.priorityStrategy === 'deny-wins',
      'priorityStrategy',
      'Stratégie de priorité non supportée.'
    );
    addError(errors, config.conservativeDeny === true, 'conservativeDeny', 'Le refus conservateur doit rester actif.');
  },
  TerrainConfig(config, errors) {
    addError(errors, booleanOrNull(config.visibleOnTerrain), 'visibleOnTerrain', 'Valeur booléenne ou NULL attendue.');
    addError(errors, booleanOrNull(config.readonlyOnTerrain), 'readonlyOnTerrain', 'Valeur booléenne ou NULL attendue.');
    addError(errors, stringArrayOrNull(config.terrainRoles), 'terrainRoles', 'Liste de rôles ou NULL attendue.');
    addError(errors, stringOrNull(config.terrainSection), 'terrainSection', 'Texte ou NULL attendu.');
    addError(errors, integerOrNull(config.terrainDisplayOrder), 'terrainDisplayOrder', 'Entier ou NULL attendu.');
    addError(
      errors,
      Array.isArray(config.criticalFields) &&
        config.criticalFields.every(field => typeof field === 'string'),
      'criticalFields',
      'Liste de champs critiques attendue.'
    );
  },
  ImportExportConfig(config, errors) {
    addError(errors, booleanOrNull(config.availableInImport), 'availableInImport', 'Valeur booléenne ou NULL attendue.');
    addError(errors, booleanOrNull(config.availableInExport), 'availableInExport', 'Valeur booléenne ou NULL attendue.');
    addError(errors, stringOrNull(config.importColumnName), 'importColumnName', 'Texte ou NULL attendu.');
    addError(errors, stringOrNull(config.exportColumnName), 'exportColumnName', 'Texte ou NULL attendu.');
    addError(errors, stringArrayOrNull(config.importAliases), 'importAliases', 'Liste d’alias d’import ou NULL attendue.');
    addError(errors, stringArrayOrNull(config.exportAliases), 'exportAliases', 'Liste d’alias d’export ou NULL attendue.');
    addError(errors, config.exchangeContractVersion === FIELD_CONTRACT_VERSION, 'exchangeContractVersion', 'Version d’échange non supportée.');
  },
  RelationConfig(config, errors) {
    addError(errors, booleanOrNull(config.physicalRelation), 'physicalRelation', 'Valeur booléenne ou NULL attendue.');
    addError(errors, booleanOrNull(config.functionalRelation), 'functionalRelation', 'Valeur booléenne ou NULL attendue.');
    for (const key of ['sourceTable', 'sourceField', 'targetTable', 'targetField']) {
      addError(errors, stringOrNull(config[key]), key, 'Texte ou NULL attendu.');
    }
    addError(
      errors,
      config.cardinality === null || ['one-to-one', 'one-to-many', 'many-to-one', 'many-to-many'].includes(config.cardinality),
      'cardinality',
      'Cardinalité non supportée.'
    );
    addError(errors, config.status === 'draft', 'status', 'Seul le statut draft est autorisé en A3.2.');
    addError(
      errors,
      config.relationRulesCompatibility === 'legacy-authoritative',
      'relationRulesCompatibility',
      'relation_rules doit demeurer l’autorité historique.'
    );
  },
  CalculationConfig(config, errors) {
    addError(
      errors,
      config.calculationType === null || ['arithmetic', 'concat', 'coalesce'].includes(config.calculationType),
      'calculationType',
      'Type de calcul non supporté.'
    );
    addError(errors, stringArrayOrNull(config.dependencies), 'dependencies', 'Liste de dépendances ou NULL attendue.');
    validateExpression(config.expression, 'expression', errors);
    addError(
      errors,
      config.nullHandling === null || ['preserve', 'coalesce', 'reject'].includes(config.nullHandling),
      'nullHandling',
      'Gestion des valeurs NULL non supportée.'
    );
    addError(errors, config.cycleDetection === 'required', 'cycleDetection', 'La détection des cycles est obligatoire.');
  },
  ActivationConfig(config, errors) {
    addError(
      errors,
      ['draft', 'validated', 'active', 'inactive', 'replaced'].includes(config.status),
      'status',
      'Statut d’activation invalide.'
    );
    for (const key of ['activeVersion', 'previousVersion', 'changedAt', 'changedBy']) {
      addError(errors, stringOrNull(config[key]), key, 'Texte ou NULL attendu.');
    }
    addError(
      errors,
      config.activationScope === null ||
        ['field', 'table', 'module', 'global'].includes(config.activationScope),
      'activationScope',
      'Portée d’activation non supportée.'
    );
  }
};

function assertJsonValue(value, path = '$', seen = new Set()) {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (typeof value !== 'object') throw new TypeError(`${path}: valeur non sérialisable en JSON.`);
  if (seen.has(value)) throw new TypeError(`${path}: référence circulaire interdite.`);
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonValue(item, `${path}[${index}]`, seen));
  } else {
    if (!plainObject(value)) throw new TypeError(`${path}: objet JSON simple attendu.`);
    Object.entries(value).forEach(([key, item]) => assertJsonValue(item, `${path}.${key}`, seen));
  }
  seen.delete(value);
}

export function validateFieldContract(name, candidate) {
  const errors = [];
  if (!plainObject(candidate)) return { valid: false, errors: [{ path: '$', message: 'Objet de contrat attendu.' }] };
  const version = candidate.schemaVersion;
  if (!isSupportedFieldContractVersion(version)) {
    return { valid: false, errors: [{ path: 'schemaVersion', message: 'Version non supportée.' }] };
  }
  const definition = getFieldContract(name, version);
  if (!definition) return { valid: false, errors: [{ path: '$', message: 'Contrat inconnu.' }] };

  const unknown = Object.keys(candidate).filter(key => !definition.allowedKeys.includes(key));
  if (unknown.length) errors.push({ path: '$', message: `Propriétés inconnues: ${unknown.join(', ')}` });
  try {
    assertJsonValue(candidate);
  } catch (error) {
    errors.push({ path: '$', message: error.message });
  }
  validators[name]?.(candidate, errors);
  return { valid: errors.length === 0, errors };
}

export function normalizeFieldContract(name, candidate = {}) {
  const definition = FIELD_CONTRACTS[name];
  if (!definition) throw new TypeError(`Contrat inconnu: ${name}`);
  if (!plainObject(candidate)) throw new TypeError(`${name}: objet attendu.`);

  const normalized = Object.fromEntries(
    definition.allowedKeys.map(key => [
      key,
      candidate[key] === undefined ? definition.defaults[key] : candidate[key]
    ])
  );
  const validation = validateFieldContract(name, normalized);
  if (!validation.valid) {
    const error = new TypeError(`${name}: ${validation.errors.map(item => `${item.path} ${item.message}`).join('; ')}`);
    error.validationErrors = validation.errors;
    throw error;
  }
  return normalized;
}

export function stableSerializeFieldContract(name, candidate = {}) {
  const normalized = normalizeFieldContract(name, candidate);
  const sort = value => {
    if (Array.isArray(value)) return value.map(sort);
    if (!plainObject(value)) return value;
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, sort(value[key])]));
  };
  return JSON.stringify(sort(normalized));
}
