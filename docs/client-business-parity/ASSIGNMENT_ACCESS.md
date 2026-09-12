# Accès Client aux affectations par site et supports

Les rôles Client et Client-Admin disposent des entrées Carte interactive, Campagnes et visuels par site et supports et Communications opérationnelles par site et supports. Les deux grilles utilisent `SiteSupportAssignmentsView`, comme Admin : mêmes colonnes, filtres, tris, pagination et exports. Les restrictions de colonnes configurées restent applicables.

Client consulte les affectations en lecture seule. Client-Admin et Admin utilisent le même formulaire Modifier dans la grille pour corriger l’affectation sélectionnée, y compris un ancien enregistrement sans campagne courante. Les relations et le propriétaire ne sont pas modifiables par Client-Admin. Les formulaires distinguent la source historique de la source `campagnes_supports`; ils n’envoient que des colonnes persistées autorisées. Les requêtes de service restent disponibles pour les deux rôles.

Les détails du visuel sont consultables dans la grille. Le lien interne vers la gestion des visuels reste disponible au personnel. Les préférences de grille du portail sont séparées par identité et périmètre. L’ancien aperçu administratif charge les mêmes sources paginées sous les politiques du compte cible. L’aperçu « Voir en tant que » conserve ses protections contre les écritures.

Trois migrations additives ont été testées dans PostgreSQL local puis appliquées au projet `cmdfomowtzrinywdsosy`, avant tout déploiement frontal :

- `20260912023913_client_site_support_assignment_access.sql` : menus, propriété historique, droits et protection des modifications, sources de l’aperçu.
- `20260912024911_client_assignment_retired_support_history.sql` : conservation des historiques EXO dont les supports ont été retirés.
- `20260912025134_client_assignment_history_policy_alignment.sql` : alignement des anciennes politiques restrictives sur cette règle historique.

Aucune suppression ni réimportation. Les 163 lignes historiques marketing et les 58 lignes opérationnelles sont préservées et accessibles aux deux comptes EXO testés (Marylène 25, Client 33). Le compte Client B 37 n’en voit aucune. Les comptes distincts et les liens contradictoires ne sont pas réattribués. Les grilles dédupliquent les affectations et ajoutent les relations courantes : lors du contrôle, Marylène voit 164 affectations marketing, Client 163 selon ses droits de campagne, et tous deux 52 affectations opérationnelles uniques. Les règles existantes de publication/accès aux campagnes restent en vigueur.

Validation :

- `npm run check` : réussite des tests configurés et du build. Avertissements Vite existants sur les imports mixtes et la taille des bundles.
- `npm run test:business-parity` : réussite.
- `node scripts/verify_client_assignment_summary.mjs` : validation du sommaire des nouvelles vues, sans modifier la réponse mise en cache.
- `node scripts/verify_client_assignment_access_local.mjs` : lecture/modification du propriétaire, refus des écritures Client et interclients, protection des liens et des colonnes, historique retiré, aperçu. Les politiques restrictives réelles sont reproduites depuis `assignment-rls-baseline.json`. Ce harnais réutilise les snapshots et le runtime PGlite du précédent audit local; leurs prérequis restent nécessaires.
- `node scripts/verify_client_assignment_browser.mjs` : menus, mêmes colonnes Admin, formulaire Client-Admin, sauvegarde/rechargement et double clic, Client sans bouton de modification.
- `node scripts/verify_client_assignment_application.mjs` : build local avec sessions réelles 25 et 33; ouverture des deux grilles et des formulaires sans enregistrer de donnée de production. Preuve : `assignment-application-local.json`.
- `node scripts/verify_marylene_navigation.mjs` : aperçu Marylène, 6 619 infrastructures, navigation répétée, carte, retour au tableau et mêmes couleurs calculées que l’Admin. Preuve : `marylene-navigation-local.json`.

Contrôle Supabase : aucun nouvel avertissement RLS. Le contrôle signale 113 fonctions SECURITY DEFINER accessibles aux utilisateurs connectés, contre 112 auparavant : la nouvelle fonction est `portal_assignment_scope`, gardée par identité, rôle, permissions et propriété. Les avertissements Auth antérieurs restent inchangés. [Documentation du contrôle](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Fichiers applicatifs modifiés ou ajoutés :

- `src/components/ClientPortal.jsx`
- `src/components/SiteSupportAssignmentsView.jsx`
- `src/lib/assignmentEditing.js`
- `src/lib/businessViewRegistry.js`
- `src/lib/clientPortalViewRegistry.js`
- `src/lib/internalViewPolicy.js`
- `src/services/dashboardService.js`
- `src/services/siteSupportBusinessService.js`

Autres fichiers de cette livraison : les trois migrations ci-dessus; `scripts/fixtures/business-parity-final-entry.jsx`; les quatre scripts `verify_client_assignment_*.mjs`; `scripts/verify_marylene_navigation.mjs`; `scripts/sql/verify_client_assignment_access.sql`; le registre `docs/stabilization-local/followup/admin-view-registry.json`; ce rapport; `docs/client-business-parity/assignment-rls-baseline.json`, `assignment-application-local.json`, `browser.json` et `marylene-navigation-local.json`.

Livraison frontale : commit/push et vérification de production en cours. Aucune nouvelle variable d’environnement. Le précédent déploiement avait été refusé par la revue automatique pour limite d’utilisation; les validations locales et migrations autorisées ont pu être exécutées depuis.
