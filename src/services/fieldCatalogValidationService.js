import { FIELD_CATALOG_FUNCTIONAL_TYPES, isProtectedCatalogField } from '../lib/fieldCatalogDraft.js';

export function validateFieldGeneralDraft(field, draft, role) {
  const errors = {};
  if (role !== 'Administrateur') errors.role = 'Cette modification est réservée aux administrateurs.';
  if (!field || field.is_virtual || !field.id || String(field.id).startsWith('physical:')) {
    errors.field = 'Ce champ ne figure pas dans le catalogue relation_fields.';
  }
  if (draft.tableName !== field?.tableName) errors.tableName = 'Le nom de table est immuable.';
  if (draft.technicalName !== field?.technicalName) errors.technicalName = 'Le nom technique est immuable.';
  if (isProtectedCatalogField(field)) errors.protected = 'Ce champ système ou identifiant technique est protégé.';

  const label = String(draft.fieldLabel || '').trim();
  if (!label) errors.fieldLabel = 'Le libellé est obligatoire.';
  else if (label.length > 160) errors.fieldLabel = 'Le libellé ne peut pas dépasser 160 caractères.';

  if (!FIELD_CATALOG_FUNCTIONAL_TYPES.includes(draft.fieldType)) errors.fieldType = 'Sélectionnez un type fonctionnel autorisé.';
  if (String(draft.helpText || '').length > 4000) errors.helpText = 'Le texte d’aide ne peut pas dépasser 4 000 caractères.';
  if (draft.displayOrder !== '') {
    const order = Number(draft.displayOrder);
    if (!Number.isInteger(order) || order < 0 || order > 100000) errors.displayOrder = 'L’ordre doit être un entier entre 0 et 100 000.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
