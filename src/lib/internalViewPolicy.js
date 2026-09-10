// Functional boundaries of staff tools; this does not grant or modify database permissions.
export const INTERNAL_VIEW_REASONS=Object.freeze({
  "Centre de commandement": "Pilotage interne des échéances, retards et charges du personnel. Le sommaire Client utilise Module14Dashboard avec sa projection autorisée.",
  "Gestionnaire des champs": "Configuration technique globale des champs, réservée à l’administration.",
  "Administration": "Gestion globale des comptes et clients, réservée à l’administration.",
  "Utilisateurs réels": "Provisionnement et cycle de vie Auth des comptes, réservés à l’administration.",
  "Visibilité par rôle": "Configuration globale des permissions, réservée à l’administration.",
  "Édition — Historique": "Audit administratif des anciennes/nouvelles valeurs entre organisations. L’historique métier Client est une projection distincte autorisée.",
  "Photos et inventaire": "Validation/rejet, suppression et mouvements de stock internes. La consultation Client des preuves utilise la vue Photos.",
  "Centre EDT et BT": "Planification interne des phases, affectation du personnel, clôture et suppression EDT. Le Client consulte Suivi des EDT et soumet ses propres requêtes.",
  "Automatisations": "Configuration globale du moteur et de ses destinations, explicitement réservée aux Administrateurs.",
  "Campagne — Visuels et formats": "Administration des fichiers, formats et phases de campagne. Le Client consulte les campagnes publiées dans son périmètre.",
  "Campagnes et visuels par site et supports": "Outil interne de gestion des affectations et navigation vers les éditeurs de campagne/visuel/EDT. La consultation Client passe par ses campagnes et supports autorisés.",
  "Communication opérationnelle — Visuels": "Administration des visuels et phases de communication. Consultation Client via communications autorisées.",
  "Communications opérationnelles par site et supports": "Gestion interne des affectations de communication entre sites et supports. Consultation Client via communications et supports autorisés.",
  "Application terrain": "Exécution et synchronisation des interventions du personnel terrain. Le Client soumet une requête, sans exécuter une intervention.",
  "Recherche terrain": "Recherche opérationnelle du personnel dans le catalogue chargé par App. Le Client recherche ses supports dans Infrastructures avec le chargeur limité à son organisation.",
  "Utilisateurs": "Catalogue global des utilisateurs internes, distinct des membres de l’organisation Client.",
  "Journal des événements": "Journal interne global du personnel TOS, distinct de l’historique métier Client."
});
