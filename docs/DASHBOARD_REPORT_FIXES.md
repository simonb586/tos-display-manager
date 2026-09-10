# Tableau de bord et suppression de rapports EDT

> La partie chargement et compteurs est remplacée par le [correctif P0](DASHBOARD_PERFORMANCE_P0.md). La suppression des rapports décrite ci-dessous reste en vigueur.

Le portail interne affiche sa navigation après la vérification du compte. Les tables sont publiées progressivement dans l’interface ; les valeurs en attente sont signalées. Les infrastructures déjà chargées sont réutilisées par le tableau de bord. Le portail client charge seulement une ligne par section pour obtenir ses totaux, sans attendre les signatures des photos. Les totaux du sommaire restent distincts des pages et filtres des grilles.

Les photos sont comptées dans support_photos (hors suppression logique), sous les droits de la session. Les campagnes et visuels proviennent de leurs catalogues complets. Les EDT complétés, fermés, annulés ou archivés sont exclus des actifs. Les clients sont chargés au démarrage. Les indicateurs de rapports distinguent les EDT complétés, les rapports disponibles et les envois de la version courante.

Le bouton Supprimer retire la version choisie d’un Rapport EDT des rapports disponibles. Une confirmation est requise. L’EDT, le PDF privé, les photos et l’historique sont conservés. L’opération exige un administrateur ou coordonnateur dans le périmètre autorisé ; un coordonnateur global n’est pas admis. Elle est idempotente, journalisée et refusée pendant un envoi. Les tentatives restantes liées à cette version sont arrêtées.

## Ordre de mise en ligne

Migration additive 20260910202335_edt_report_soft_delete, vérification PostgreSQL, tests et build, puis déploiement du frontend. Aucun changement de permissions des photos ni de fournisseur supplémentaire. La compilation conserve la configuration publique déjà validée du portail.

## Validation

17 cas de suppression exécutés sur PostgreSQL local puis distant, avec fixtures annulées, plus les 118 cas métier et 54 cas de sécurité des rapports en local. 19 cas navigateur pour les compteurs, le chargement progressif, la confirmation, le double clic, l’erreur et les rôles. Régression du cache, du portail client et des parcours de rapports. npm run check et vérification du build réel avec Auth, RPC et photos privées. Les preuves de production et mesures finales restent dans le dossier local de certification, exclu du commit.

## Fichiers modifiés

- scripts/fixtures/historical-ui-entry.jsx
- scripts/verify_stabilization_cache.mjs
- scripts/verify_startup_performance_v127.mjs
- src/components/ClientPortal.jsx
- src/components/Module14Dashboard.jsx
- src/components/Module15Reports.jsx
- src/main.jsx
- src/services/clientPortalService.js
- src/services/dataService.js
- src/services/module14Service.js
- src/services/photoInventoryService.js
- src/services/reportDataService.js
- src/services/siteSupportBusinessService.js
- supabase/migrations/20260910202335_edt_report_soft_delete.sql
- scripts/sql/verify_report_deletion.sql
- scripts/fixtures/dashboard-report-fixes-entry.jsx
- scripts/verify_dashboard_report_fixes.mjs
- docs/DASHBOARD_REPORT_FIXES.md
