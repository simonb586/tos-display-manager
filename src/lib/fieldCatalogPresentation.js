export const FIELD_CATALOG_FILTERS = Object.freeze([
  ['all', 'Tous'], ['configured', 'Configurés'], ['unconfigured', 'Non configurés'],
  ['system', 'Système'], ['primary', 'Clés primaires'], ['unique', 'Uniques'],
  ['relations', 'Relations'], ['generated', 'Champs générés']
]);

const STATUS_LABELS = Object.freeze({
  unconfigured: 'Non configuré',
  configured: 'Configuré',
  draft: 'Brouillon',
  active: 'Actif',
  inactive: 'Inactif'
});

export function fieldStatusLabel(value) {
  return STATUS_LABELS[value] || value || STATUS_LABELS.unconfigured;
}

export function booleanDisplayValue(value) {
  return value === null ? 'Non disponible' : value ? 'Oui' : 'Non';
}

export function fieldDisplayValue(value) {
  return value === null || value === undefined || value === '' ? 'Non disponible' : String(value);
}

export function fieldBadges(field) {
  return [
    { id: 'functional', label: field.functionalType, tone: 'functional' },
    { id: 'postgres', label: field.physical.dataType || 'Type SQL inconnu' },
    {
      id: 'status',
      label: fieldStatusLabel(field.configurationStatus),
      tone: field.configurationStatus === 'unconfigured' ? 'muted' : 'status'
    },
    field.system && { id: 'system', label: 'Système' },
    field.readOnly && { id: 'readonly', label: 'Lecture seule' },
    field.unique && { id: 'unique', label: 'Unique' },
    field.primaryKey && { id: 'primary', label: 'Clé primaire' },
    field.foreignKey && { id: 'foreign', label: 'Clé étrangère' },
    field.generated && { id: 'generated', label: 'Généré' }
  ].filter(Boolean);
}
