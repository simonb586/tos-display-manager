const PROTECTED_NAMES = new Map([
  ['id', 'Identifiant système'],
  ['support_id', 'Identifiant métier protégé'],
  ['created_at', 'Date système'],
  ['updated_at', 'Date système'],
  ['deleted_at', 'Date système'],
  ['auth_user_id', 'Identifiant d’authentification'],
  ['photo_principale_url', 'Référence de photo principale protégée'],
  ['photo_miniature_url', 'Référence de miniature protégée'],
  ['visuel_actuel_cadre', 'Référence de visuel protégée']
]);

export function displayProtectionReasons(field) {
  const name = String(field?.technicalName || field?.field_name || '').toLowerCase();
  const reasons = [];
  if (PROTECTED_NAMES.has(name)) reasons.push(PROTECTED_NAMES.get(name));
  if (name.endsWith('_id')) reasons.push('Nom technique se terminant par _id');
  if (field?.primaryKey || field?.physical_is_primary_key) reasons.push('Clé primaire');
  if (field?.foreignKey || field?.physical_is_foreign_key) reasons.push('Clé étrangère');
  if (field?.generated || field?.physical_is_generated) reasons.push('Colonne générée');
  if (field?.physical?.identity || field?.physical_is_identity) reasons.push('Colonne identity');
  if (field?.system) reasons.push('Champ système');
  if (field?.display_configurable === false) reasons.push('Champ explicitement non configurable');
  return [...new Set(reasons)];
}

export function parseDisplayOrderInput(rawValue) {
  const text = String(rawValue ?? '').trim();
  if (!text) return { valid: true, value: null, error: '' };
  if (!/^[0-9]+$/.test(text)) {
    return {
      valid: false,
      value: null,
      error: 'L’ordre doit être un entier entre 0 et 100000.'
    };
  }
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < 0 || value > 100000) {
    return {
      valid: false,
      value: null,
      error: 'L’ordre doit être un entier entre 0 et 100000.'
    };
  }
  return { valid: true, value, error: '' };
}

export function displayOrderCollision(field, catalogFields, displayOrder) {
  if (displayOrder === null) return null;
  return (catalogFields || []).find(candidate =>
    candidate.fieldId !== field?.fieldId &&
    candidate.tableName === field?.tableName &&
    candidate.display_order === displayOrder
  ) || null;
}
