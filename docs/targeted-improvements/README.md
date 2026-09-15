# Validation des améliorations ciblées

## Exécution

- `npm run check` : suite de non-régression complète et build.
- `node scripts/verify_targeted_browser.mjs` : composants React réels avec services simulés (trois rôles, dossiers, recherche, zoom, multi-EDT, dates et formulaires Terrain).
- `node scripts/verify_targeted_improvements.mjs` : 11 scénarios SQL isolés. Installer `@electric-sql/pglite` dans un répertoire temporaire et définir `TDM_PGLITE_MODULE` vers son module `dist/index.js` (URL `file:///...`). Par défaut, utilise `%TEMP%/tdm-rpc-test-runtime`.
- `node scripts/start_targeted_dev.mjs` puis `TDM_TEST_PORTAL_ORIGIN=http://127.0.0.1:5180 node scripts/verify_targeted_live.mjs` : navigateur local et API réelle.
- `node scripts/verify_targeted_live.mjs` sans cette variable : même validation sur le portail de production.

Les tests distants écrivent des fixtures contrôlées dans le projet `cmdfomowtzrinywdsosy`. Ils nécessitent une autorisation d’écriture, `SUPABASE_ACCESS_TOKEN` ou le trousseau CLI local, Node avec WebSocket et Microsoft Edge. Ils créent cinq comptes temporaires et un support TARGETED-* ; seuls ces objets et leurs fichiers sont supprimés en fin de test. Ils utilisent une session éphémère du profil Marylène (25), sans envoi de courriel. Ne pas lancer plusieurs instances simultanément. Après interruption, vérifier le journal avant toute relance.

## Preuves

- `local-sql-tests.json` : SQL isolé.
- `remote-transaction-tests.json` : compilation sur le schéma réel et tests transactionnels annulés avant application.
- `photo-scope-tests.json` : portée EXO, autre client et accès Storage.
- `browser-tests.json` : composants réels hors réseau.
- `local-live.json` : parcours réels sur frontal local.
- `check.log` et `vercel-build.log` : vérification complète et build de production.
- `production.json` : ajouté après déploiement.

Les fixtures de schéma et fonctions contiennent des définitions techniques, sans clés ni sessions. Les scripts préparatoires non idempotents et les fichiers historiques non suivis ne font pas partie de ce changement.
