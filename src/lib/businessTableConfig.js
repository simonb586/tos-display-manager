import {loadInternalIssues} from '../services/internalIssuesService';
export const tableConfig = {
  Infrastructures: { table: 'infrastructures', fallback: () => import('../data/infrastructures.json').then(module => module.default), idField: 'support_id', labelField: 'emplacement_visibilite' },
  'Répertoire des affiches': { table: 'repertoire_des_affiches', fallback: () => import('../data/repertoire_des_affiches.json').then(module => module.default) },
  'Communications opérationnelles': { table: 'communications_operationnelles', fallback: () => import('../data/communications_operationnelles.json').then(module => module.default) },
  'Enjeux des cadres et supports': { table: 'enjeux_des_cadres_et_supports', loader: loadInternalIssues, cacheTables: ['enjeux_des_cadres_et_supports','enjeux_terrain'], readOnly: true, fallback: () => import('../data/enjeux_des_cadres_et_supports.json').then(module => module.default) },
  "Centres d’information": { table: 'centres_dinformation', fallback: () => import('../data/centres_dinformation.json').then(module => module.default) },
  'C.I. avec enjeux': { table: 'ci_avec_enjeux', fallback: () => import('../data/c_i_avec_enjeux.json').then(module => module.default) },
  'Liste des arrêts': { table: 'liste_des_arrets', fallback: () => import('../data/liste_des_arrets.json').then(module => module.default), idField: 'no_arret', labelField: 'emplacement_visibilite' },
  'Voitures / trains': { table: 'voitures_trains', fallback: () => import('../data/voitures_trains.json').then(module => module.default) },
  Photos: { table: 'photos', fallback: () => import('../data/photos.json').then(module => module.default) },
  'Bons de travail': { table: 'bons_de_travail', fallback: () => import('../data/bons_de_travail.json').then(module => module.default) },
  'Historique des campagnes': { table: 'historique_des_campagnes', fallback: () => import('../data/historique_des_campagnes.json').then(module => module.default) },
  'Suivi des EDT': { table: 'suivi_des_edt', fallback: () => import('../data/suivi_des_edt.json').then(module => module.default) },
  Utilisateurs: { table: 'utilisateurs', fallback: () => import('../data/utilisateurs.json').then(module => module.default) },
  Clients: { table: 'clients', fallback: () => import('../data/clients.json').then(module => module.default) },
  'Journal des événements': { table: 'journal_des_evenements', fallback: () => import('../data/journal_des_evenements.json').then(module => module.default) }
};
