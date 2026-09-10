# Tableau de bord : agrégats sécurisés et ouverture en six secondes

Le portail calcule désormais ses compteurs en base et reçoit un résumé unique. Les listes, photos signées, cartes et exports sont chargés à l’ouverture de leur module. L’activité récente commence après les KPI. L’application Terrain de l’Installateur conserve son démarrage spécifique : ce parcours opérationnel n’est pas le dashboard testé ici.

## Cause et correction

Le dashboard Admin attendait les infrastructures complètes, puis les services de campagnes et d’affectations. Les cartes dépendaient de plusieurs promesses sans délai global. Une lecture bloquée pouvait laisser un compteur en attente. Le client utilisait un total issu d’une page de taille 1 pour certaines sections ; les totaux étaient alors limités à la page. Le champ actif des infrastructures est un texte Oui/Non, que le test JavaScript contre false interprétait incorrectement.

portal_dashboard_summary() agrège les KPI. Aucune RPC existante ne fournissait le résumé interne équivalent. La branche dashboard de client_portal_list_v120 est réutilisée pour les clients, avec les mêmes filtres de publication et d’appartenance que les sections canoniques, sans pagination. Les autres branches sont conservées.

Le profil, le rôle et le client proviennent de auth.uid() côté serveur. Aucun argument client n’est accepté. Les lectures internes utilisent les RLS du demandeur (SECURITY INVOKER) ; le chemin client conserve son contrôle canonique. Vue par rôle filtre les compteurs. PUBLIC/anon sont révoqués ; search_path est fixé. Les profils absents, rôles NULL et clients invalides sont refusés. Aucun cache partagé. Les valeurs locales sont isolées par utilisateur/rôle/client et les réponses périmées sont ignorées.

Après les dépendances de session/profil, permissions et résumé démarrent indépendamment. Le rôle canonique est posé avant le montage du portail. Le résumé a un délai maximal de 4 500 ms, suivi d’une erreur et de Réessayer. Les réponses NULL, partielles ou contenant des valeurs invalides sont rejetées. Un zéro n’est affiché qu’après une réponse valide. L’actualisation garde les valeurs et déduplique les clics.

## Mesures avant et candidat compilé

T0 est la navigation réelle du navigateur avec une session authentifiée existante. T1 est la navigation utilisable, T2 le dashboard et T3 le dernier compteur numérique rendu. Le chronométrage inclut la résolution de la session, du profil et des permissions. Il ne mesure pas le temps humain de saisie d’un mot de passe. Les appels sont les requêtes REST commencées avant T3, hors prévols CORS. Les lignes comptées sont celles reçues dans les tableaux de réponse ; le résumé JSON est un objet supplémentaire de quelques kilo-octets. Les « commits React » sont les commits de la racine pendant que le dashboard est visible, mesurés via le hook DevTools ; ce ne sont pas des rendus exacts du seul composant.

| Scénario | T1 ms | T2 ms | T3 ms | REST | Lignes | Commits React |
|---|---:|---:|---:|---:|---:|---:|
| Avant admin | 821 | 979 | 10851 | 41 | 12008 | 12 |
| Avant marylene | 649 | 1220 | 1653 | 19 | 9 | 11 |
| Candidat admin | 608 | 623 | 3744 | 3 | 2 | 4 |
| Candidat marylene | 936 | 936 | 936 | 3 | 2 | 1 |
| Candidat client-b | 814 | 814 | 814 | 3 | 2 | 1 |
| Candidat admin-mobile | 744 | 845 | 3162 | 3 | 2 | 4 |
| Candidat marylene-mobile | 843 | 843 | 843 | 3 | 2 | 1 |
| Candidat client-b-mobile | 813 | 813 | 813 | 3 | 2 | 1 |
| Candidat marylene-mobile-latency | 2579 | 2579 | 2579 | 3 | 2 | 1 |

Le candidat respecte T3 ≤ 6 000 ms dans les sept scénarios. Mobile : 390 × 844. Latence ajoutée : 150 ms avec débit de 1,5 Mo/s. Aucune garantie n’est déduite pour une panne réseau ou un throttling sévère : l’état reste alors déterministe et réessayable. Un seul appel KPI par ouverture ; aucune liste métier pour compter. Avant : 38 appels de données hors profils/permissions côté Admin, dont le bootstrap partagé et des données inutiles au dashboard ; 12 appels de sections KPI côté Marylène. Aucun appel individuel n’est attribué à plusieurs KPI dans les totaux.

## Définition des KPI internes

Tous utilisent portal_dashboard_summary(), une requête réseau partagée. Filtre client et rôle : profil canonique et RLS du demandeur, puis groupes Vue par rôle. Valeurs ci-dessous : Admin de référence lors de l’audit. Les requêtes SQL indépendantes, sous JWT authentifié, concordent avec tous les agrégats du résumé.

| KPI | Source | Valeur |
|---|---|---:|
| photos | support_photos | 10 |
| clients | clients | 2 |
| reports | suivi_des_edt, edt_reports, email_outbox | 1 |
| terrain | terrain_sync_history_v | 10 |
| edt_late | suivi_des_edt | 0 |
| edt_active | suivi_des_edt | 2 |
| issues_open | enjeux_des_cadres_et_supports, enjeux_terrain | 112 |
| work_orders | bons_de_travail | 1 |
| reports_sent | suivi_des_edt, edt_reports, email_outbox | 0 |
| marketing_soon | campagnes_maitres | 0 |
| missing_photos | infrastructures | 5776 |
| reports_errors | suivi_des_edt, edt_reports, email_outbox | 1 |
| terrain_errors | terrain_sync_history_v | 0 |
| marketing_total | campagnes_maitres | 22 |
| reports_to_send | suivi_des_edt, edt_reports, email_outbox | 0 |
| marketing_active | campagnes_maitres | 18 |
| marketing_places | campagne_visuels_formats, campagnes_supports, campagnes_maitres, infrastructures, campagnes_visuels_sites_supports | 163 |
| operational_soon | campagnes_maitres | 0 |
| marketing_visuals | campagne_visuels_formats, campagnes_maitres | 72 |
| operational_total | campagnes_maitres | 10 |
| reports_completed | suivi_des_edt, edt_reports, email_outbox | 1 |
| operational_active | campagnes_maitres | 6 |
| operational_places | campagne_visuels_formats, campagnes_supports, campagnes_maitres, infrastructures, communications_operationnelles_sites_supports | 52 |
| urgent_work_orders | bons_de_travail | 0 |
| operational_visuals | campagne_visuels_formats, campagnes_maitres | 16 |
| infrastructures_total | infrastructures | 6619 |
| infrastructures_active | infrastructures | 5135 |

Infrastructures : actif exclut Non/false/0/inactif ; attention signifie absence des trois références de photo existantes. Marketing et communications : business_context distingue les domaines ; actifs = actif/active/en cours/planifié ; fin prochaine = date_fin entre aujourd’hui et J+7. Les emplacements sont dédupliqués entre affectations courantes et historiques selon la clé métier. Les visuels opérationnels inactifs sont exclus. EDT : clôtures et archives exclues ; retard sur date prévue ISO. Enjeux : fusion dédupliquée des deux sources historiques/Terrain, statuts clos exclus. Terrain : erreurs non résolues. Rapports : EDT complétés, dernière version non supprimée et envoi associé à cette version.

Photos : 10 métadonnées actives actuellement, aucune supprimée ; le chiffre 12 n’est pas injecté artificiellement. Aucun fichier, métadonnée ou lien photo n’est modifié par cette migration.

## KPI client

Marylène / EXO conserve uniquement les sections autorisées : 6 619 infrastructures, 14 campagnes publiées accessibles, 10 photos visibles, 10 historiques, 20 EDT publiés accessibles, 9 communications ; enjeux, répertoire, centres d’information, C.I. avec enjeux, arrêts et voitures/trains : zéro réel. Ces sections respectent les filtres canoniques des RPC existantes. Client B affiche zéro sur ses trois sections autorisées et ne reçoit aucun compteur EXO. Les totaux ne sont pas remplacés par une page ou un filtre de grille.

## SQL et validation

Migration additive 20260910232602_portal_dashboard_summary.sql validée dans PostgreSQL local (PGlite), puis appliquée et vérifiée à distance avant le frontal. 18 cas SQL transactionnels avec fixtures annulées : rôles, scopes, NULL, anon, absence de paramètre client, total supérieur à une page, actif Non et Vue par rôle. Les suites locales métier 118, sécurité rapports 54 et suppression 17 restent PASS. EXPLAIN ANALYZE exécuté pour les COUNT infrastructures et le résumé complet sous JWT réel. Aucun index ajouté : les plans et les mesures obtenues ne justifient pas de nouvelle structure pour respecter le SLO.

Contrats navigateur : délai 4,5 s, réponse partielle, erreurs, retry, déduplication, conservation des valeurs, rejet de la réponse d’un ancien scope, passage EXO vers Client B, absence de boucle et absence de table massive. Navigation interne : 20 parcours et aucun loadManyTables au boot. Vues client : 60 cas. Dashboard et suppression EDT : 19 cas. Onglets historiques : 37 cas. Rapports client : 7 cas. Grilles : stabilité 30 secondes, refresh et isolation. npm run check inclut les tests configurés et le build. Avertissement Vite existant pour des chunks différés de plus de 500 ko ; le chunk initial est contrôlé séparément.

Commande ciblée : npm run test:dashboard-p0 (navigateur Edge disponible, ou TOS_TEST_BROWSER). SQL : scripts/sql/verify_dashboard_summary_p0.sql sur une base migrée avec privilèges de test ; toutes les fixtures sont annulées. Les mesures réelles, les plans, les timings par KPI et la vérification des artefacts publiés restent dans le dossier privé local docs/stabilization-local/certification/remote/dashboard-p0.

## Publication

Ordre : migration, contrôles SQL, npm run check, build compilé testé avec Auth/RPC/Storage réels, scan, commit et push release/v1.3.3, déploiement Vercel précompilé, comparaison des octets publics et nouvelles mesures production. Aucune nouvelle variable d’environnement nécessaire au dashboard. Les validations finales en production sont consignées séparément pour ne pas présenter un candidat comme déjà publié. Les blocages courriel Resend et cache CDN hérités de la mission globale restent indépendants de ce SLO.

## Fichiers de ce correctif

- docs/DASHBOARD_REPORT_FIXES.md
- package.json
- scripts/fixtures/dashboard-report-fixes-entry.jsx
- scripts/fixtures/historical-ui-entry.jsx
- scripts/fixtures/portal-parity-entry.jsx
- scripts/fixtures/report-portal-entry.jsx
- scripts/fixtures/strict-app-entry.jsx
- scripts/lib/offlineBrowser.mjs
- scripts/verify_client_role_views_v136.mjs
- scripts/verify_dashboard_report_fixes.mjs
- scripts/verify_module_17_client_portal_v120.mjs
- scripts/verify_portal_view_renderability.mjs
- scripts/verify_stabilization_browser.mjs
- scripts/verify_strict_app_navigation.mjs
- src/components/ClientPortal.jsx
- src/components/Module14Dashboard.jsx
- src/main.jsx
- src/hooks/useDashboardSummary.js
- src/services/dashboardService.js
- supabase/migrations/20260910232602_portal_dashboard_summary.sql
- scripts/sql/verify_dashboard_summary_p0.sql
- scripts/fixtures/dashboard-summary.js
- scripts/fixtures/dashboard-p0-entry.jsx
- scripts/verify_dashboard_p0.mjs
- docs/DASHBOARD_PERFORMANCE_P0.md
