# Correction de l’aperçu de Marylène — 11 septembre 2026

Le défaut a été reproduit sur le portail public : la première ouverture chargeait les 6 619 infrastructures, puis un second clic sur la même entrée vidait le résultat sans relancer la requête. Le test précédent ne couvrait que l’ouverture initiale. La Carte était accessible depuis le tableau, mais absente du menu gauche ; la palette Client différait effectivement de celle d’Admin.

Corrections :

- Un clic répété sur la vue courante conserve les données, les filtres et la pagination, y compris pendant une requête en cours.
- Un indicateur de chargement remplace le tableau vide pendant la lecture des données.
- « Carte interactive » apparaît dans le menu si Infrastructures est autorisé. Depuis le tableau, la carte reçoit ses lignes filtrées ; revenir par le menu conserve la pagination.
- Les requêtes de carte et de tableau ont des identifiants distincts. Une réponse tardive de carte ne peut plus rouvrir une vue quittée.
- Admin et Client utilisent la même règle CSS de palette : menu bleu marine, texte clair, sélection blanche et même fond de portail.

Validation locale : `npm run check`, `npm run test:business-parity` et `node scripts/verify_marylene_navigation.mjs` PASS. Le dernier test utilise la session Admin et le véritable profil Marylène (25), client EXO (2). Il compare les couleurs calculées dans le navigateur, vérifie les 6 619 lignes après un clic répété, la carte depuis le tableau et le sommaire, puis le retour à Admin.

Preuves : [défaut reproduit en production](marylene-navigation-before.json), [build corrigé avec données réelles](marylene-navigation-local.json), [régressions navigateur](browser.json).

Aucune migration, modification des données ou variable d’environnement nouvelle.

Fichiers applicatifs :

- [ClientPortal.jsx](../../src/components/ClientPortal.jsx)
- [BusinessTable.jsx](../../src/components/BusinessTable.jsx)
- [palette partagée](../../src/features/shared/portal-shell.css)
- [main.jsx](../../src/main.jsx)

Tests : `scripts/verify_business_parity_browser.mjs`, `scripts/fixtures/business-parity-final-entry.jsx`, `scripts/verify_marylene_navigation.mjs`. Les autres fichiers modifiés de ce correctif sont les rapports et preuves de ce dossier.

Livraison : vérification de production en attente.
