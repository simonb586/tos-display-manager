export const automationTriggers = [
  ['support_selected', 'Sélectionne un support'],
  ['visual_selected', 'Sélectionne un visuel'],
  ['campaign_selected', 'Sélectionne une campagne'],
  ['photo_taken', 'Prends une photo'],
  ['installation_completed', 'Termine une installation'],
  ['inspection_completed', 'Réalise une inspection'],
  ['issue_reported', 'Déclare un enjeu'],
  ['edt_started', 'Commence un EDT'],
  ['edt_completed', 'Termine un EDT'],
  ['work_order_created', 'Crée un bon de travail'],
  ['data_updated', 'Modifie une donnée'],
  ['data_removed', 'Supprime ou retire une donnée'],
  ['excel_imported', 'Importe un fichier Excel'],
  ['other', 'Autre']
];

export const automationLocations = [
  ['terrain_app', 'Application terrain'],
  ['admin_portal', 'Portail administrateur'],
  ['client_portal', 'Portail client'],
  ['excel_import', 'Import Excel'],
  ['api', 'API'],
  ['other', 'Autre']
];

export const automationModules = [
  ['infrastructures', 'Infrastructures', 'infrastructures'],
  ['campaigns', 'Campagnes', 'campagnes_maitres'],
  ['visuals', 'Visuels', 'campagne_visuels_formats'],
  ['campaign_history', 'Historique des campagnes', 'historique_des_campagnes'],
  ['poster_inventory', 'Répertoire des affiches / Inventaire', 'repertoire_des_affiches'],
  ['photos', 'Photos', 'support_photos'],
  ['inspections', 'Inspections', 'inspections_terrain'],
  ['issues', 'Enjeux', 'enjeux_terrain'],
  ['edt', 'EDT', 'suivi_des_edt'],
  ['work_orders', 'Bons de travail', 'bons_de_travail'],
  ['dashboard', 'Tableau de bord', null],
  ['reports', 'Rapports', null],
  ['notifications', 'Notifications', null],
  ['other', 'Autre', null]
];

export const automationActions = [
  ['copy', 'Copier la valeur'],
  ['replace', 'Remplacer la valeur'],
  ['append', 'Ajouter une valeur'],
  ['clear', 'Vider la valeur'],
  ['calculate', 'Calculer la valeur'],
  ['insert_row', 'Ajouter une nouvelle ligne'],
  ['keep_history', 'Conserver dans l’historique'],
  ['none', 'Aucune modification']
];

export const automationValueSources = [
  ['selected_support', 'Support sélectionné'],
  ['selected_visual', 'Visuel sélectionné'],
  ['selected_campaign', 'Campagne sélectionnée'],
  ['current_user', 'Utilisateur actuel'],
  ['current_date', 'Date et heure actuelles'],
  ['photo', 'Photo prise'],
  ['gps', 'Position GPS'],
  ['edt', 'EDT actif'],
  ['work_order', 'Bon de travail actif'],
  ['manual', 'Valeur saisie'],
  ['calculation', 'Calcul à définir'],
  ['none', 'Aucune provenance']
];

export const automationConditions = [
  ['active_support', 'Support actif'],
  ['active_campaign', 'Campagne active'],
  ['active_visual', 'Visuel actif'],
  ['compatible_visual_format', 'Visuel compatible avec le format du support'],
  ['active_edt', 'EDT actif'],
  ['active_work_order', 'Bon de travail actif'],
  ['photo_required', 'Photo obligatoire'],
  ['gps_required', 'GPS obligatoire'],
  ['non_empty_value', 'Valeur non vide'],
  ['none', 'Aucune condition'],
  ['custom', 'Ajouter une condition personnalisée']
];

export const automationAfterActions = [
  ['show_confirmation', 'Afficher une confirmation'],
  ['return_to_list', 'Retourner à la liste'],
  ['open_support', 'Ouvrir la fiche du support'],
  ['open_work_order', 'Ouvrir le bon de travail'],
  ['open_edt', 'Ouvrir l’EDT'],
  ['append_history', 'Ajouter une ligne à l’historique'],
  ['send_notification', 'Envoyer une notification'],
  ['none', 'Aucune action']
];

export const automationRecipients = [
  ['administrator', 'Administrateur'],
  ['coordinator', 'Coordonnateur'],
  ['installer', 'Installateur'],
  ['client_administrator', 'Client-administrateur'],
  ['client', 'Client'],
  ['none', 'Aucune']
];

export const automationStatuses = [
  ['draft', 'Brouillon'],
  ['pending_validation', 'À valider'],
  ['active', 'Active'],
  ['paused', 'En pause'],
  ['inactive', 'Inactive']
];

export const automationPriorities = [
  ['critical', 'Critique'],
  ['high', 'Haute'],
  ['normal', 'Normale'],
  ['low', 'Faible']
];

export const labelFor = (catalog, value) =>
  catalog.find(([key]) => key === value)?.[1] || value || '—';

export const moduleForKey = key =>
  automationModules.find(([moduleKey]) => moduleKey === key);

export function emptyAutomation() {
  return {
    name: '',
    status: 'draft',
    priority: 'normal',
    definition: {
      triggers: [],
      locations: [],
      targets: [],
      conditions: [],
      customCondition: '',
      afterActions: [],
      notifications: []
    }
  };
}
