# Déploiement V1.0 — stratégie A

Paquet local non exécuté. Stratégie retenue : **A — frontal complet avec migrations administratives**.

Le frontal métier dépend du socle historique déjà attendu en production. Il ne faut jamais rejouer les scripts historiques d’initialisation : `01_PRODUCTION_PRECHECK.sql` doit confirmer ce socle. Le frontal Administrateur expose le Gestionnaire des champs et Automatisations; leurs objets V0.13.1 sont donc inclus dans l’ordre contrôlé.

## Classement fondé sur les appels réels

- **Niveau 1 — obligatoire avant le frontal :** aucun nouveau SQL V0.13.1. Le socle historique (auth/profils, tables métier, campagnes, EDT/BT, photos, Terrain, rapports, relations et RPC visibles) est un prérequis obligatoire à confirmer, jamais à réinstaller avec ce paquet.
- **Niveau 2 — modules administratifs visibles :** A1, A3, A4, A5, A6, A7, A8, C1, A9 et `V0_13_1_AUTOMATION_ASSISTANT.sql`. La stratégie A les rend obligatoires pour cette livraison complète.
- **Niveau 3 — reportable :** A10 (aucune migration, activation théorique), validation globale de la contrainte C1, consommation métier A4–A10. Les Blocs 13.2 et 13.3 sont des changements frontaux/tests sans migration nouvelle.

Les invitations et l’envoi de rapports utilisent des fonctions serveur déjà visibles; leur présence et leur configuration sont des conditions de déploiement, mais leur déploiement ne fait pas partie de ce paquet SQL.

`02_V1_REQUIRED_MIGRATIONS.sql` reste l’inventaire documentaire. L’exécution simplifiée utilise `02_V1_REQUIRED_MIGRATIONS_EXECUTABLE.sql`, reproduction ordonnée des dix migrations officielles avec leurs transactions intactes et un contrôle léger après chaque section. Les vérificateurs complets restent séparés et le postcontrôle demeure obligatoire.

La procédure SQL tient en trois exécutions : précontrôle, migrations consolidées, postcontrôle. Toute erreur arrête la procédure; le marqueur `V1_MIGRATIONS_COMPLETE` n’apparaît qu’après les dix sections réussies.
