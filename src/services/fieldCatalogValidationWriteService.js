import { supabase, supabaseConfigured } from '../lib/supabaseClient.js';
import { normalizeValidationConfig, VALIDATION_CONFIG_VERSION } from '../lib/fieldCatalogValidationDraft.js';

export async function saveFieldValidationDraft({ field, draft, expectedUpdatedAt, role }) {
  if (role !== 'Administrateur') throw new Error('Permission administrateur requise.');
  const validation = normalizeValidationConfig(draft);
  if (!validation.valid) {
    const error = new Error(Object.values(validation.errors)[0]);
    error.validationErrors = validation.errors;
    throw error;
  }
  if (!supabaseConfigured || !supabase) throw new Error('Supabase n’est pas configuré.');
  const { data, error } = await supabase.rpc('save_relation_field_validation_draft_v0131a53', {
    p_table_name: field.tableName,
    p_field_name: field.technicalName,
    p_contract_version: VALIDATION_CONFIG_VERSION,
    p_validation_config: validation.normalized,
    p_expected_updated_at: expectedUpdatedAt
  });
  if (error) {
    try {
      const detail = JSON.parse(error.details || '{}');
      error.code = detail.code || error.code;
      error.field = detail.field;
    } catch {}
    throw error;
  }
  return data;
}
