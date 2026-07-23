export const viewModules = [
  ['infrastructures', 'Infrastructures'],
  ['campaigns', 'Campagnes'],
  ['visuals', 'Visuels'],
  ['photos', 'Photos'],
  ['campaign_history', 'Historique des campagnes'],
  ['edt', 'EDT'],
  ['work_orders', 'Bons de travail'],
  ['inventory', 'Inventaire'],
  ['issues', 'Enjeux'],
  ['inspections', 'Inspections']
];

export const viewDestinations = [
  ['infrastructures', 'Infrastructures'],
  ['support360', 'Fiche 360'],
  ['campaigns', 'Campagnes'],
  ['edt', 'EDT'],
  ['dashboard', 'Tableau de bord'],
  ['reports', 'Rapports'],
  ['field_app', 'Application terrain'],
  ['exports', 'Exports']
];

export const viewLocations = [
  ['main_grid', 'Grille principale'],
  ['support360', 'Fiche 360'],
  ['dashboard', 'Tableau de bord'],
  ['reports', 'Rapports'],
  ['excel', 'Export Excel'],
  ['pdf', 'Export PDF'],
  ['field_app', 'Application terrain']
];

export const viewModes = [
  ['readonly', 'Lecture seulement'],
  ['readwrite', 'Lecture et modification'],
  ['calculated', 'Valeur calculée']
];

export const viewStatuses = [
  ['draft', 'Brouillon'],
  ['active', 'Active'],
  ['inactive', 'Inactive']
];

export const conditionOperators = [
  ['equals', 'est égal à'],
  ['different', 'est différent de'],
  ['contains', 'contient'],
  ['not_contains', 'ne contient pas'],
  ['empty', 'est vide'],
  ['not_empty', 'n’est pas vide'],
  ['greater', 'est supérieur à'],
  ['less', 'est inférieur à'],
  ['before', 'est avant'],
  ['after', 'est après']
];

export const fieldsByModule = {
  infrastructures: [['support_number','Numéro du support'],['location','Emplacement'],['status','État'],['format','Format'],['active_campaign','Campagne active']],
  campaigns: [['campaign_name','Nom de la campagne'],['campaign_type','Type de campagne'],['status','État'],['start_date','Date de début'],['end_date','Date de fin']],
  visuals: [['visual_name','Nom du visuel'],['format','Format'],['phase','Phase'],['status','État']],
  photos: [['thumbnail','Miniature'],['date','Date'],['action_type','Type d’action'],['author','Auteur'],['comment','Commentaire']],
  campaign_history: [['campaign','Campagne'],['visual','Visuel'],['installation_date','Date d’installation'],['removal_date','Date de retrait'],['edt','EDT'],['photo','Photo']],
  edt: [['edt_number','Numéro EDT'],['phase','Phase'],['planned_date','Date prévue'],['status','État'],['progress','Progression']],
  work_orders: [['number','Numéro du bon'],['work_type','Type de travail'],['status','État'],['planned_date','Date prévue'],['completed_date','Date terminée']],
  inventory: [['available','Quantité disponible'],['reserved','Quantité réservée'],['installed','Quantité installée'],['minimum','Seuil minimal']],
  issues: [['issue_type','Type d’enjeu'],['priority','Niveau de priorité'],['status','État'],['reported_date','Date de déclaration']],
  inspections: [['inspection_date','Date d’inspection'],['result','Résultat'],['has_issue','Présence d’un enjeu'],['next_inspection','Prochaine inspection prévue']]
};

export const catalogLabel = (catalog, value) => catalog.find(([key]) => key === value)?.[1] || '—';

export function emptyCrossModuleView() {
  return {
    name: '', description: '', status: 'draft', priority: 'normal',
    source: '', destination: '', fields: [], locations: [],
    mode: 'readonly', conditions: [], conditionMode: 'all'
  };
}
