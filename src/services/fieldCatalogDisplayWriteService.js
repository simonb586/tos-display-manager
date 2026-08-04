import { supabase, supabaseConfigured } from '../lib/supabaseClient.js';
import { displayDraftRpcPayload } from '../lib/fieldCatalogDisplayDraft.js';
import { validateFieldDisplayDraft } from './fieldCatalogDisplayValidationService.js';

export async function saveFieldDisplayDraft({ field, draft, role }) {
  const validation = validateFieldDisplayDraft(field, draft, role);
  if (!validation.valid) {
    const error = new Error(Object.values(validation.errors)[0]);
    error.validationErrors = validation.errors;
    throw error;
  }
  if (!supabaseConfigured || !supabase) {
    throw new Error('Supabase n’est pas configuré.');
  }

  const { data, error } = await supabase.rpc(
    'save_relation_field_display_draft_v0131a42',
    displayDraftRpcPayload(field, validation.normalized)
  );
  if (error) throw error;
  return data;
}
