import {
  DISPLAY_DRAFT_CONTRACT_VERSION,
  isProtectedDisplayDraftField,
  normalizeDisplayDraft,
  validateDisplayDraftContract
} from '../lib/fieldCatalogDisplayDraft.js';

export function validateFieldDisplayDraft(field, candidate, role) {
  const errors = {};

  if (role !== 'Administrateur') {
    errors.role = 'Cette modification est réservée aux administrateurs.';
  }
  if (!field || field.is_virtual || !field.id || String(field.id).startsWith('physical:')) {
    errors.field = 'Ce champ ne figure pas dans le catalogue relation_fields.';
  }
  if (isProtectedDisplayDraftField(field)) {
    errors.protected = 'Ce champ système ou identifiant technique est protégé.';
  }

  let normalized = null;
  try {
    const supplied = Object.fromEntries(
      Object.entries(candidate || {}).filter(([, value]) => value !== undefined)
    );
    if (!Object.prototype.hasOwnProperty.call(supplied, 'schemaVersion')) {
      supplied.schemaVersion = DISPLAY_DRAFT_CONTRACT_VERSION;
    }
    const contractValidation = validateDisplayDraftContract(supplied);
    if (!contractValidation.valid) {
      errors.contract = contractValidation.errors.map(item => item.message).join(' ');
    } else {
      normalized = normalizeDisplayDraft(supplied);
    }
  } catch (error) {
    errors.contract = error.message;
  }

  if (candidate?.schemaVersion !== undefined &&
      candidate.schemaVersion !== DISPLAY_DRAFT_CONTRACT_VERSION) {
    errors.schemaVersion = 'Version DisplayConfig non supportée.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    normalized
  };
}
