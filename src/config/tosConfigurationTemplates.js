const draft = Object.freeze({ status: 'draft', priority: 'normal', isSystemTemplate: true });
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
  const templateNames = new Set(templates.map(item=>item.name.toLocaleLowerCase('fr-CA')));
  return [
    ...templates.filter(item => !existingNames.has(item.name.toLocaleLowerCase('fr-CA'))),
    ...(rows || []).map(item=>templateNames.has(String(item.name||'').trim().toLocaleLowerCase('fr-CA'))?{...item,isSystemTemplate:true}:item)
  ];
}
