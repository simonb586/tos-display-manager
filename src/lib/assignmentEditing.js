import { BUSINESS_CONTEXT } from './businessContext.js';

export const assignmentViewName = context => context === BUSINESS_CONTEXT.OPERATIONAL
  ? 'Communications opérationnelles par site et supports'
  : 'Campagnes et visuels par site et supports';
export const assignmentViewId = context => context === BUSINESS_CONTEXT.OPERATIONAL ? 'operational_assignments' : 'marketing_assignments';
const fields = {
  campagnes_supports: [['visuel_attendu', 'Visuel attendu'], ['statut', 'Statut'], ['no_edt', 'No EDT']],
  campagnes_visuels_sites_supports: [['nom_campagne', 'Nom campagne'], ['visuel_terrain', 'Visuel terrain'], ['date_debut', 'Date début'], ['date_fin', 'Date fin'], ['statut_campagne', 'Statut'], ['emplacement', 'Infrastructure']],
  communications_operationnelles_sites_supports: [['message', 'Communication'], ['visuel_message', 'Visuel message'], ['visuel_terrain', 'Visuel terrain'], ['date_debut', 'Date début'], ['date_fin', 'Date fin'], ['statut', 'Statut'], ['emplacement', 'Emplacement'], ['no_arret', 'No arrêt'], ['site_ou_arret', 'Site ou arrêt'], ['no_edt', 'No EDT'], ['related_voiture', 'Voiture']]
};
export const assignmentEditableFields = row => fields[row?._assignment_table] || [];
export function assignmentUpdatePayload(row, form) {
  if (!assignmentEditableFields(row).length || row.id == null) throw new Error('Affectation non modifiable.');
  return Object.fromEntries(assignmentEditableFields(row).filter(([key]) => Object.hasOwn(form, key)).map(([key]) => [key, form[key] === '' ? null : form[key]]));
}
