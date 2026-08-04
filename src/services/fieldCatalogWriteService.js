import { supabase, supabaseConfigured } from '../lib/supabaseClient.js';
import { validateFieldGeneralDraft } from './fieldCatalogValidationService.js';

export async function saveFieldGeneralDraft({ field, draft, role }) {
  const validation = validateFieldGeneralDraft(field, draft, role);
  if (!validation.valid) {
    const error = new Error(Object.values(validation.errors)[0]);
    error.validationErrors = validation.errors;
    throw error;
  }
  if (!supabaseConfigured || !supabase) throw new Error('Supabase n’est pas configuré.');

  const { data, error } = await supabase.rpc('save_relation_field_general_draft_v0131a3', {
    p_table_name: field.tableName,
    p_field_name: field.technicalName,
    p_field_label: draft.fieldLabel.trim(),
    p_field_type: draft.fieldType,
    p_help_text: draft.helpText.trim() || null,
    p_display_order: draft.displayOrder === '' ? null : Number(draft.displayOrder)
  });
  if (error) throw error;
  return data;
}
