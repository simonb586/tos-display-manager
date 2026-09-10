const INFRASTRUCTURE_LABELS = {
  support_id: 'Numéro du support',
  type_support: 'Type de support',
  format_affichage: 'Formats d’affichage',
  medium_recommande: 'Médium recommandé',
  emplacement_visibilite: 'Emplacement / visibilité',
  site: 'Site',
  type_site: 'Type de site',
  ligne_distribution: 'Ligne de distribution',
  type_ligne_distribution: 'Type de ligne de distribution',
  enjeux: 'Enjeux',
  type_enjeux: 'Type d’enjeux',
  actif: 'Actif',
  campagne_selon_visuel: 'Campagne selon le visuel',
  visuel_en_expo: 'Visuel en exposition',
  commentaires: 'Commentaires',
  campagne_actuelle: 'Nom de la campagne actuelle',
  visuel_campagne: 'Visuel de la campagne',
  visuel_actuel_cadre: 'Visuel actuel du cadre',
  date_derniere_manipulation: 'Date de la dernière manipulation',
  edt_associe: 'EDT associé',
  campagne_precedente: 'Campagne précédente',
  visuel_precedent: 'Visuel précédent',
  edt_precedent_associe: 'EDT précédent associé',
  coordonnees_gps: 'Coordonnées GPS',
  latitude: 'Latitude',
  longitude: 'Longitude',
  prochain_edt_cible: 'Prochain EDT ciblé',
  lien_carte_interactive: 'Lien vers la carte interactive'
};

const ALWAYS_HIDDEN_COLUMNS = {
  Infrastructures: ['format_visuel', 'photo_miniature_url', 'photo_principale_url']
};

const BUSINESS_LABELS={nom_campagne:'Campagne / communication',business_context:'Contexte',date_debut:'Début',date_fin:'Fin',statut:'Statut',site:'Site',support_id:'Support',type_support:'Type',type_site:'Type de site',emplacement_visibilite:'Emplacement / visibilité',visual:'Visuel',numero_edt:'EDT',no_edt:'EDT',objet:'Rapport',sent_at:'Publié le',type_enjeu:'Enjeu',description:'Description',occurred_at:'Date',action:'Activité',nom:'Nom',courriel:'Courriel',role:'Rôle'};

const getCols = (rows, name) => {
  if (!rows?.length) return [];
  const hidden = new Set([
    'raw_data',
    'created_at',
    'updated_at',
    ...(ALWAYS_HIDDEN_COLUMNS[name] || [])
  ]);
  return [...new Set(rows.flatMap(Object.keys))].filter(column => !hidden.has(column));
};

const columnLabel = (tableName, column) =>
  tableName === 'Infrastructures'
    ? (INFRASTRUCTURE_LABELS[column] || column)
    : (BUSINESS_LABELS[column] || column.replaceAll('_', ' '));
export {getCols as businessColumns, columnLabel as businessColumnLabel};
