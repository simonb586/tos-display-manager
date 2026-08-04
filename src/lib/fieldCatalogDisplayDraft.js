import {
  normalizeFieldContract,
  validateFieldContract
} from '../features/v13/field-contracts/index.js';

export const DISPLAY_DRAFT_CONTRACT_NAME = 'DisplayConfig';
export const DISPLAY_DRAFT_CONTRACT_VERSION = '1.0.0';

export const DISPLAY_DRAFT_RPC_PARAMETERS = Object.freeze({
  showInGrid: 'p_show_in_grid',
  showInForm: 'p_show_in_form',
  showIn360: 'p_show_in_360',
  displayOrder: 'p_display_order',
  readonlyOverride: 'p_readonly_override'
});

const PROTECTED_DISPLAY_FIELD_NAMES = new Set([
  'id',
  'support_id',
  'created_at',
  'updated_at',
  'deleted_at',
  'auth_user_id',
  'photo_principale_url',
  'photo_miniature_url',
  'visuel_actuel_cadre'
]);

export function normalizeDisplayDraft(candidate = {}) {
  return normalizeFieldContract(DISPLAY_DRAFT_CONTRACT_NAME, candidate);
}

export function validateDisplayDraftContract(candidate) {
  return validateFieldContract(DISPLAY_DRAFT_CONTRACT_NAME, candidate);
}

export function isProtectedDisplayDraftField(field) {
  const name = String(field?.technicalName || field?.field_name || '').toLowerCase();
  return Boolean(
    field?.system ||
    field?.primaryKey ||
    field?.foreignKey ||
    field?.generated ||
    field?.physical?.identity ||
    field?.physical_is_primary_key ||
    field?.physical_is_foreign_key ||
    field?.physical_is_generated ||
    field?.physical_is_identity ||
    PROTECTED_DISPLAY_FIELD_NAMES.has(name) ||
    name.endsWith('_id')
  );
}

export function displayDraftFromField(field) {
  return normalizeDisplayDraft({
    schemaVersion: DISPLAY_DRAFT_CONTRACT_VERSION,
    showInGrid: field?.show_in_grid ?? null,
    showInForm: field?.show_in_form ?? null,
    showIn360: field?.show_in_360 ?? null,
    displayOrder: field?.display_order ?? null,
    readonlyOverride: field?.readonly_override ?? null
  });
}

export function displayDraftChanged(initial, candidate) {
  const before = normalizeDisplayDraft(initial);
  const after = normalizeDisplayDraft(candidate);
  return Object.keys(DISPLAY_DRAFT_RPC_PARAMETERS)
    .some(key => before[key] !== after[key]);
}

export function displayDraftChangeSummary(initial, candidate) {
  const before = normalizeDisplayDraft(initial);
  const after = normalizeDisplayDraft(candidate);
  const changedProperties = Object.keys(DISPLAY_DRAFT_RPC_PARAMETERS)
    .filter(key => before[key] !== after[key]);
  return {
    changed: changedProperties.length > 0,
    status: changedProperties.length > 0 ? 'draft_saved' : 'no_change',
    changedProperties
  };
}

export function displayDraftRpcPayload(field, candidate) {
  const draft = normalizeDisplayDraft(candidate);
  return {
    p_table_name: field?.tableName || field?.table_name || '',
    p_field_name: field?.technicalName || field?.field_name || '',
    p_contract_version: draft.schemaVersion,
    p_show_in_grid: draft.showInGrid,
    p_show_in_form: draft.showInForm,
    p_show_in_360: draft.showIn360,
    p_display_order: draft.displayOrder,
    p_readonly_override: draft.readonlyOverride
  };
}
