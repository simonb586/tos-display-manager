const text = value => String(value ?? '').trim();
const SYSTEM_FIELD_NAMES = new Set(['id', 'created_at', 'updated_at', 'deleted_at', 'auth_user_id']);

export { FIELD_CATALOG_FILTERS } from './fieldCatalogPresentation.js';

export function fieldCatalogId(tableName, technicalName) {
  return JSON.stringify([String(tableName || ''), String(technicalName || '')]);
}

export function normalizeCatalogField(catalog = {}, physical = {}) {
  const configurationStatus = catalog.configuration_status ||
    (catalog.is_virtual ? 'unconfigured' : catalog.validation_status ? 'configured' : 'unconfigured');
  return {
    ...catalog,
    fieldId: fieldCatalogId(
      catalog.table_name || physical.tableName,
      catalog.field_name || physical.columnName
    ),
    tableName: catalog.table_name || physical.tableName || '',
    technicalName: catalog.field_name || physical.columnName || '',
    label: catalog.field_label || catalog.field_name || physical.columnName || '',
    functionalType: catalog.field_type || 'non défini',
    configurationStatus,
    system: Boolean(
      catalog.is_system ||
      catalog.system_field ||
      SYSTEM_FIELD_NAMES.has(catalog.field_name || physical.columnName || '')
    ),
    readOnly: Boolean(catalog.readonly_override ?? catalog.terrain_readonly ?? physical.generated ?? physical.identity),
    primaryKey: Boolean(catalog.physical_is_primary_key ?? physical.primaryKey),
    unique: Boolean(catalog.unique_override ?? catalog.physical_is_unique ?? physical.unique),
    foreignKey: Boolean(catalog.physical_is_foreign_key ?? physical.foreignKey),
    generated: Boolean(catalog.physical_is_generated ?? physical.generated),
    physical: {
      dataType: catalog.physical_data_type || physical.dataType || '',
      udtName: catalog.physical_udt_name || physical.udtName || '',
      nullable: catalog.physical_is_nullable ?? physical.nullable ?? null,
      defaultValue: catalog.physical_column_default ?? physical.defaultValue ?? null,
      maximumLength: catalog.physical_maximum_length ?? physical.maximumLength ?? null,
      numericPrecision: catalog.physical_numeric_precision ?? physical.numericPrecision ?? null,
      numericScale: catalog.physical_numeric_scale ?? physical.numericScale ?? null,
      ordinalPosition: catalog.physical_ordinal_position ?? physical.ordinalPosition ?? null,
      foreignTable: catalog.physical_foreign_table || physical.foreignTable || '',
      foreignColumn: catalog.physical_foreign_column || physical.foreignColumn || '',
      generationExpression: catalog.physical_generation_expression || physical.generationExpression || '',
      identity: Boolean(catalog.physical_is_identity ?? physical.identity)
    }
  };
}

export function mergeFieldCatalog(catalogRows = [], schema = {}) {
  const configured = new Map(catalogRows.map(row => [`${row.table_name}.${row.field_name}`, row]));
  const keys = new Set(configured.keys());
  for (const [tableName, fields] of Object.entries(schema)) {
    for (const field of fields) keys.add(`${tableName}.${field.columnName}`);
  }
  return [...keys].map(key => {
    const separator = key.indexOf('.');
    const tableName = key.slice(0, separator);
    const fieldName = key.slice(separator + 1);
    const physical = (schema[tableName] || []).find(field => field.columnName === fieldName) || {};
    const catalog = configured.get(key) || {
      id: `physical:${key}`, table_name: tableName, field_name: fieldName,
      field_label: fieldName, configuration_status: 'unconfigured', is_virtual: true
    };
    return normalizeCatalogField(catalog, physical);
  }).sort((a, b) =>
    a.tableName.localeCompare(b.tableName, 'fr-CA') ||
    (a.physical.ordinalPosition ?? Number.MAX_SAFE_INTEGER) - (b.physical.ordinalPosition ?? Number.MAX_SAFE_INTEGER) ||
    a.technicalName.localeCompare(b.technicalName, 'fr-CA')
  );
}

export function fieldMatchesFilter(field, filter = 'all') {
  const status = text(field.configurationStatus).toLowerCase();
  if (filter === 'configured') return !['unconfigured', 'non configuré'].includes(status);
  if (filter === 'unconfigured') return ['unconfigured', 'non configuré'].includes(status);
  if (filter === 'system') return field.system;
  if (filter === 'primary') return field.primaryKey;
  if (filter === 'unique') return field.unique;
  if (filter === 'relations') return field.foreignKey || Boolean(field.source_table || field.source_field);
  if (filter === 'generated') return field.generated;
  return true;
}

export function filterCatalogFields(fields, { table = '', query = '', filter = 'all' } = {}) {
  const needle = text(query).toLocaleLowerCase('fr-CA');
  return fields.filter(field => {
    if (table && field.tableName !== table) return false;
    if (!fieldMatchesFilter(field, filter)) return false;
    if (!needle) return true;
    return [field.technicalName, field.label, field.functionalType, field.physical.dataType, field.configurationStatus]
      .some(value => text(value).toLocaleLowerCase('fr-CA').includes(needle));
  });
}
