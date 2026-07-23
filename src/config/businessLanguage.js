export const APP_TITLE = 'TOS Display Manager';

export const UI_LABELS = Object.freeze({
  sourceModule: 'Les données proviennent de',
  destinationModule: 'Afficher les données dans',
  trigger: 'Déclencheur',
  systemAction: 'Action système',
  permissions: 'Autorisations',
  fileLibrary: 'Bibliothèque de fichiers',
  supportNumber: 'Numéro du support',
  completionDate: 'Date de fin',
  automation: 'Automatisation',
  automations: 'Automatisations',
  crossModuleViews: 'Vues entre les tables',
  advancedSection: 'Section avancée',
  tosTemplate: 'Modèle TOS'
});

const FIELD_LABELS = Object.freeze({
  support_id: 'Numéro du support',
  no_arret: 'Numéro d’arrêt',
  completed_at: 'Date de fin',
  created_at: 'Date de création',
  updated_at: 'Dernière modification',
  storage_path: 'Emplacement du fichier',
  photo_url: 'Photo',
  thumbnail_url: 'Miniature',
  utilisateur: 'Auteur',
  nom_fichier: 'Nom du fichier',
  prise_le: 'Date de prise',
  type_photo: 'Type de photo',
  est_principale: 'Photo principale',
  statut_validation: 'État de validation',
  edt_support_id: 'Affectation EDT',
  related_support: 'Numéro du support'
});

const MODULE_LABELS = Object.freeze({
  infrastructures: 'Infrastructures',
  campagnes_maitres: 'Campagnes',
  campagne_visuels_formats: 'Visuels',
  historique_des_campagnes: 'Historique des campagnes',
  repertoire_des_affiches: 'Inventaire des visuels',
  support_photos: 'Photos',
  inspections_terrain: 'Inspections',
  inspections: 'Inspections',
  enjeux_terrain: 'Enjeux',
  suivi_des_edt: 'EDT',
  edt_supports: 'Supports de l’EDT',
  bons_de_travail: 'Bons de travail',
  utilisateurs: 'Utilisateurs'
});

export function businessFieldLabel(value) {
  const key = String(value || '');
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key
    .replace(/_id$/i, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

export function businessModuleLabel(value) {
  return MODULE_LABELS[String(value || '')] || businessFieldLabel(value);
}

const TECHNICAL_PATTERNS = [
  /supabase|postgres(?:ql)?|sqlstate|\brpc\b|\brls\b/i,
  /storage|bucket|migration|localhost|vite|preview|trigger/i,
  /violates|constraint|duplicate key|permission denied|row level security/i,
  /pgrst|42p\d+|jwt|schema cache|networkerror|failed to fetch/i
];

export function friendlyError(error, fallback = 'Une difficulté empêche de terminer cette action. Réessayez dans quelques instants.') {
  const raw = String(error?.message || error || '').trim();
  if (/row level security|\brls\b|permission denied|not authorized|unauthorized/i.test(raw)) {
    return 'Vous ne possédez pas les autorisations nécessaires pour effectuer cette action.';
  }
  if (/duplicate|unique constraint|already exists/i.test(raw)) {
    return 'Un élément identique existe déjà. Modifiez les informations puis réessayez.';
  }
  if (/network|failed to fetch|timeout|offline/i.test(raw)) {
    return 'Le service est momentanément inaccessible. Vérifiez votre connexion puis réessayez.';
  }
  if (/not found|pgrst116|404/i.test(raw)) {
    return 'L’élément demandé est introuvable ou n’est plus disponible.';
  }
  if (!raw || TECHNICAL_PATTERNS.some(pattern => pattern.test(raw))) return fallback;
  return raw;
}

export function enforceApplicationTitle() {
  if (typeof document !== 'undefined' && document.title !== APP_TITLE) {
    document.title = APP_TITLE;
  }
}
