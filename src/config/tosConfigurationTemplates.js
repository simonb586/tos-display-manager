const draft = Object.freeze({ status: 'draft', priority: 'normal', isSystemTemplate: true });

const automation = (key, name, description, trigger, modules, actions, conditions = []) => ({
  ...draft,
  id: `tos-automation-${key}`,
  name,
  description,
  definition: {
    kind: 'automation',
    triggers: [trigger],
    locations: ['admin_portal'],
    targets: modules.map(module => ({ module, fields: [] })),
    actions,
    conditions,
    afterActions: ['show_confirmation', 'append_history'],
    notifications: []
  },
  updated_at: '2026-07-23T00:00:00.000Z'
});

export const TOS_AUTOMATION_TEMPLATES = Object.freeze([
  automation('visual-install', 'Installation d’un visuel', 'Prépare les étapes de suivi après une installation terrain.', 'installation_completed', ['infrastructures', 'campaign_history'], ['Mettre à jour le visuel actif', 'Ajouter l’intervention à l’historique'], ['active_support']),
  automation('visual-removal', 'Retrait d’un visuel', 'Prépare la mise à jour du support après le retrait d’un visuel.', 'data_removed', ['infrastructures', 'campaign_history'], ['Archiver le visuel précédent', 'Mettre à jour la fiche du support']),
  automation('inspection', 'Inspection', 'Centralise les suites à donner après une inspection.', 'inspection_completed', ['inspections', 'infrastructures'], ['Consigner le résultat', 'Planifier la prochaine inspection']),
  automation('issue', 'Déclaration d’un enjeu', 'Prépare le suivi et les avis associés à un nouvel enjeu.', 'issue_reported', ['issues', 'notifications'], ['Créer le suivi', 'Aviser les responsables']),
  automation('edt-create', 'Création d’EDT', 'Prépare le suivi d’un nouvel EDT.', 'edt_started', ['edt'], ['Initialiser le suivi']),
  automation('edt-update', 'Modification d’un EDT', 'Harmonise les informations liées lorsqu’un EDT change.', 'data_updated', ['edt', 'work_orders'], ['Mettre à jour les éléments concernés']),
  automation('workorder-complete', 'Bon de travail terminé', 'Prépare la clôture et la traçabilité du bon de travail.', 'data_updated', ['work_orders', 'campaign_history'], ['Consigner la date de fin', 'Ajouter au suivi']),
  automation('workorder-reopen', 'Réouverture d’un BT', 'Prépare la reprise d’un bon de travail.', 'data_updated', ['work_orders'], ['Réactiver le suivi']),
  automation('campaign-new', 'Nouvelle campagne', 'Prépare les activités associées à une nouvelle campagne.', 'campaign_selected', ['campaigns', 'visuals'], ['Préparer les visuels']),
  automation('campaign-change', 'Changement de campagne', 'Prépare le remplacement coordonné d’une campagne.', 'campaign_selected', ['campaigns', 'infrastructures'], ['Actualiser les supports concernés']),
  automation('photo-upload', 'Téléversement d’une photo', 'Prépare le classement d’une nouvelle photo.', 'photo_taken', ['photos'], ['Classer la photo', 'Actualiser la miniature']),
  automation('photo-delete', 'Suppression d’une photo', 'Prépare la traçabilité après une suppression autorisée.', 'data_removed', ['photos'], ['Actualiser la galerie', 'Consigner l’action']),
  automation('client-request', 'Nouvelle requête client', 'Prépare le traitement d’une nouvelle demande client.', 'data_updated', ['work_orders', 'notifications'], ['Créer le suivi', 'Aviser le coordonnateur']),
  automation('low-inventory', 'Inventaire faible', 'Prépare un avis lorsque le seuil minimal est atteint.', 'data_updated', ['poster_inventory', 'notifications'], ['Créer un avis'], ['non_empty_value']),
  automation('next-edt', 'Mise à jour du prochain EDT', 'Actualise l’information opérationnelle du prochain EDT.', 'data_updated', ['edt', 'infrastructures'], ['Actualiser le prochain EDT'])
]);

const field = (key, label, width = 180) => ({
  key,
  label,
  width,
  visible: true,
  editable: false,
  format: 'standard',
  emptyValue: '—'
});

const view = (key, name, description, source, destination, fields, locations, mode = 'readonly') => ({
  ...draft,
  id: `tos-view-${key}`,
  name,
  description,
  source,
  destination,
  fields,
  locations,
  mode,
  conditions: [],
  conditionMode: 'all',
  updated_at: '2026-07-23T00:00:00.000Z'
});

export const TOS_VIEW_TEMPLATES = Object.freeze([
  view('active-campaign', 'Campagne active', 'Présente la campagne actuellement installée.', 'campaigns', 'infrastructures', [field('campaign_name','Campagne'),field('campaign_type','Type de campagne'),field('active_visual','Visuel actif'),field('installation_date','Date d’installation'),field('edt_number','Numéro EDT')], ['main_grid']),
  view('previous-campaign', 'Campagne précédente', 'Présente le dernier remplacement connu.', 'campaign_history', 'infrastructures', [field('previous_campaign','Campagne précédente'),field('previous_visual','Visuel précédent'),field('removal_date','Date de retrait ou de remplacement')], ['main_grid']),
  view('next-edt', 'Prochain EDT', 'Présente la prochaine intervention planifiée.', 'edt', 'infrastructures', [field('edt_number','Numéro EDT'),field('phase','Phase'),field('planned_date','Date prévue'),field('status','État')], ['main_grid']),
  view('recent-photos', 'Photos récentes', 'Présente les dernières photos de la fiche du support.', 'photos', 'support360', [field('thumbnail','Miniature',110),field('date','Date'),field('action_type','Type d’action'),field('author','Auteur'),field('comment','Commentaire',240)], ['support360']),
  view('campaign-history', 'Historique complet', 'Présente l’historique des campagnes du support.', 'campaign_history', 'support360', [field('campaign','Campagne'),field('visual','Visuel'),field('installation_date','Date d’installation'),field('removal_date','Date de retrait'),field('edt','EDT'),field('photo','Photo')], ['support360']),
  view('active-issues', 'Enjeux actifs', 'Présente les enjeux qui nécessitent une attention.', 'issues', 'infrastructures', [field('issue_type','Type d’enjeu'),field('priority','Niveau de priorité'),field('status','État'),field('reported_date','Date de déclaration')], ['main_grid','support360'], 'readwrite'),
  view('visual-inventory', 'Inventaire', 'Présente la disponibilité des visuels.', 'inventory', 'visuals', [field('available','Quantité disponible'),field('reserved','Quantité réservée'),field('installed','Quantité installée'),field('minimum','Seuil minimal')], ['main_grid']),
  view('edt-progress', 'Progression EDT', 'Résume l’avancement opérationnel d’un EDT.', 'edt', 'dashboard', [field('total','Supports au total'),field('completed','Terminés'),field('in_progress','En cours'),field('progress','Progression')], ['dashboard'], 'calculated'),
  view('work-orders', 'Bons de travail', 'Présente les bons de travail liés au support.', 'work_orders', 'support360', [field('number','Numéro du bon'),field('work_type','Type de travail'),field('status','État'),field('planned_date','Date prévue'),field('completed_date','Date terminée')], ['support360']),
  view('last-inspection', 'Dernière inspection', 'Présente le dernier contrôle et la prochaine échéance.', 'inspections', 'infrastructures', [field('inspection_date','Date de dernière inspection'),field('result','Résultat'),field('has_issue','Présence d’un enjeu'),field('next_inspection','Prochaine inspection prévue')], ['main_grid'])
]);

export function mergeSystemTemplates(rows, templates) {
  const existingNames = new Set((rows || []).map(item => String(item.name || '').trim().toLocaleLowerCase('fr-CA')));
  return [
    ...templates.filter(item => !existingNames.has(item.name.toLocaleLowerCase('fr-CA'))),
    ...(rows || [])
  ];
}
