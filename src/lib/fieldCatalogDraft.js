export const FIELD_CATALOG_FUNCTIONAL_TYPES = Object.freeze([
  'short_text', 'long_text', 'number', 'currency', 'date', 'datetime',
  'boolean', 'single_select', 'multi_select', 'photo', 'file',
  'relation', 'calculated'
]);

const PROTECTED_FIELD_NAMES = new Set([
  'support_id', 'id', 'created_at', 'updated_at', 'deleted_at', 'auth_user_id',
  'photo_principale_url', 'photo_miniature_url', 'visuel_actuel_cadre'
]);

export function isProtectedCatalogField(field) {
  const name = String(field?.technicalName || field?.field_name || '').toLowerCase();
  const table = String(field?.tableName || field?.table_name || '').toLowerCase();
  return Boolean(
    field?.system ||
    field?.primaryKey ||
    field?.generated ||
    field?.physical?.identity ||
    PROTECTED_FIELD_NAMES.has(name) ||
    name.endsWith('_id') ||
    (table === 'infrastructures' && PROTECTED_FIELD_NAMES.has(name))
  );
}

export function fieldGeneralDraft(field) {
  return {
    tableName: field?.tableName || '',
    technicalName: field?.technicalName || '',
    fieldLabel: field?.label || '',
    fieldType: FIELD_CATALOG_FUNCTIONAL_TYPES.includes(field?.field_type) ? field.field_type : '',
    helpText: field?.help_text || '',
    displayOrder: field?.display_order ?? ''
  };
}

export function fieldDraftChanged(initial, current) {
  return ['fieldLabel', 'fieldType', 'helpText', 'displayOrder']
    .some(key => String(initial?.[key] ?? '') !== String(current?.[key] ?? ''));
}
