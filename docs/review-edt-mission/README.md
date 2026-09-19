# Validation photos, EDT et historique

La file utilise le filtre `review_queue` de `photo_inventory_read` avant pagination. Les originaux sont affichés dès leur lecture ; le catalogue de reconnaissance charge ensuite, sans masquer les photos en cas d'échec. La finalisation canonique reste obligatoire pour terminer un import.

La migration `20260919232440_review_edt_campaign_consistency.sql` autorise les phases d'installation du même client et contexte métier, y compris les EDT archivés pour une association historique. Les archives restent archivées. Les associations multiples et leurs dates passent par les RPC existants ; un changement de campagne et ses associations forment une seule transaction.

Les services partagent le tri naturel des campagnes et visuels. L'historique utilise les lignes existantes, leurs permissions et le catalogue RLS : détail par support dans les deux contextes, synthèse avec décompte distinct des supports. Les champs heure utilisent `formatTimeHHMMSS`, y compris en export ; les dates et horodatages restent distincts.

## Vérification

- `npm.cmd run check` : tests configurés, build et garde-fous.
- `node scripts/verify_review_edt_mission.mjs` : statuts, tri, heures, rapprochement et décompte.
- `node scripts/verify_review_edt_browser.mjs` : catalogue lent/indisponible, historique et restrictions de colonnes.
- `node scripts/verify_review_time_exports.mjs` : cellules réelles CSV/XLSX.
- `node scripts/verify_review_edt_sql_local.mjs` : PostgreSQL embarqué. Installer préalablement `@electric-sql/pglite@0.3.14` dans `.cache/mission-db` avec `npm.cmd install --prefix .cache/mission-db --no-save --package-lock=false @electric-sql/pglite@0.3.14`.
- `TDM_MISSION_APPLIED=1` avec `verify_review_edt_sql_remote.mjs` : vérification après migration dans une transaction annulée. Sans cette variable, le script teste le candidat avant application.
- `verify_review_edt_live.mjs` et `verify_review_edt_terrain.mjs` : comptes, photos et objets temporaires réels, nettoyés après les essais. Ces scripts nécessitent une autorisation explicite, les accès de test et Edge. `TDM_TEST_PORTAL_ORIGIN=http://127.0.0.1:5180` cible le frontal local ; sinon ils ciblent la production.
- `reconcile_review_edt_campaigns.mjs` : lecture seule ; produit une matrice locale contenant des données métier. Aucune réaffectation automatique dans ce script.

Les rapports détaillés de production et la matrice sont conservés localement. Ne pas les publier automatiquement dans Git.

Ordre de livraison : PostgreSQL local, transaction distante annulée, migration additive, essais réels, contrôle global, commit/push normal, artefact Vercel production, déploiement puis vérification des fichiers servis et des parcours réels.
