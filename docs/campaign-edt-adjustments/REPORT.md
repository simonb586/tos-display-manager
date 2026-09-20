# Ajustements campagnes, visuels et EDT — 20 septembre 2026

## État de livraison

**PRODUCTION UPDATE COMPLETE.** Les quatre migrations sont appliquées, le code est commité et poussé, et le portail de production a été déployé puis validé dans le navigateur.

Le propriétaire a confirmé explicitement que **l'EDT ID 10 a été réellement exécuté et terminé**. Il conserve son numéro **EDT-TOS-09 (0.1)** et ses relations. Son statut est maintenant **Terminé**, son cycle **ferme**, sa progression 100 %, et il est désarchivé. Les trois phases sont complètes. L'état précédent de l'EDT et des phases est conservé dans `raw_data.confirmed_completion_20260920`. Les horodatages de clôture indiquent la régularisation administrative ; aucune date réelle des travaux n'a été inventée. La recherche « EDT-TOS-09.0.1 » retrouve cet enregistrement sans créer de doublon ni toucher l'EDT distinct « EDT-TOS-09 ».

**EDT-TOS-22-A**, ID 22 : statut déjà terminé, installation et retrait à 100 % et clôturés. Son ancien archivage empêchait sa lecture par le RPC. Il est maintenant désarchivé, terminé à 100 %, avec les anciennes métadonnées d'archivage préservées dans `raw_data.completed_visibility_restoration`.

## Changements

- Retrait du raccourci vers les visuels dans les deux vues maîtres. Dans le code existant, son libellé était « Fiche du thème ». Le composant partagé assure le retrait pour Admin et les vues clientes autorisées.
- Correction d'une boucle de chargement des campagnes clientes vides : le composant utilise les données déjà chargées par le portail au montage, sans relancer le parent et provoquer son propre démontage. Test DOM dédié pour les deux contextes et les deux rôles clients.
- Table compacte des visuels : campagne, nom, code, phase, format, quantité, EDT, dates, état, actions par ligne, recherche et en-têtes triables. Relations multiples conservées.
- Références génériques dans le formulaire Modifier : aperçu image/lien PDF, nom, type, ajout et suppression. Une suppression retire la référence de la reconnaissance et conserve l'original privé et ses métadonnées. Elle libère une place dans la limite de dix références actives ; la limite totale de 4 Mio des métadonnées reste inchangée. Aucun fichier Terrain n'est touché.
- OpenCV reste différé jusqu'à l'analyse d'un fichier. Le moteur est émis comme asset autonome nommé d'après la version installée du paquet, avec une seconde tentative réseau, un délai maximal et un message conservant le formulaire. Aucun hash de production n'est codé en dur, aucune boucle de rechargement.
- Centre EDT : tri naturel par numéro, sens du tri, recherche insensible aux accents et aux variantes de ponctuation, filtres Tous/Planifiés/En cours/Terminés/Archivés. Campagne, client, dates et progression restent visibles. Les clôtures métier sont affichées comme terminées ; les archives restent distinctes.
- RPC de lecture conservé en mode invoker avec les RLS existantes. Les archives sont retournées pour permettre leur filtrage explicite. Les noms des visuels associés servent à la recherche ; les catalogues sont matérialisés une fois pour éviter les évaluations RLS répétées par EDT.

## Diagnostic OpenCV

La requête réelle vers `/assets/opencv-ptZUZGX2.js` a renvoyé **HTTP 200, `text/html`, 428 octets**, correspondant à la page d'entrée. Le JavaScript attendu est absent ; la réécriture SPA masque cette absence. Le mécanisme d'ancien chunk après déploiement est documenté par [Vite](https://vite.dev/guide/build.html#load-error-handling). Le diagnostic établit l'absence de l'asset, sans attribuer arbitrairement l'origine du cache navigateur.

Le build corrigé contient `vendor/opencv-5.0.0-release.1.js`, correspondant à la dépendance déjà verrouillée. L'HTML doit être revalidé ; le moteur est mis en cache selon sa version. Aucun service worker applicatif n'a été trouvé. Le test navigateur bloque volontairement le moteur, vérifie la conservation des valeurs, débloque le réseau, puis réussit les ajouts image et PDF.

## Validations

Les parcours frontend ont réussi sur le build local connecté au Supabase réel, puis **sur https://portail.groupetos.com après déploiement**. Les fixtures créées pour les essais ont été supprimées après validation.

| Contrôle demandé | Résultat |
| --- | --- |
| Bouton fiche visuel — Campagnes maîtres | PASS production |
| Bouton fiche visuel — Communications | PASS production |
| Présentation compacte visuels/formats | PASS production |
| Références génériques dans Modifier | PASS production |
| Ajout image générique | PASS production, navigateur réel |
| Ajout PDF générique | PASS production, navigateur réel |
| OpenCV | CORRIGÉ en production ; moteur, image/PDF et retry testés |
| Tri EDT | PASS |
| Recherche EDT | PASS, incluant l'alias 09.0.1 |
| EDT-TOS-22-A | VISIBLE en production et retourné par le RPC distant |
| Statut 22-A | TERMINÉ, 100 %, désarchivé en base |
| EDT-TOS-09.0.1 | VISIBLE en production sous son numéro existant 09 (0.1) |
| Statut 09.0.1 = Terminé | TERMINÉ, 100 %, désarchivé après confirmation |
| Filtre Terminés | PASS production, les deux EDT à 100 % |
| Filtre Tous | PASS |
| Filtre Archivés | PASS production ; 22-A et ID 10 exclus, archives réelles conservées |
| Client B | PASS SQL distant et navigateur réel ; rôle Client-Admin et périmètre respectés |
| CHECK | PASS, nouveaux tests intégrés |
| BUILD | PASS avec configuration publique Supabase vérifiée |
| DIFF | PASS |
| COMMIT | `ca0a7ea` (code applicatif déployé) |
| PUSH | PASS, `origin/release/v1.3.3`, sans force |
| VERCEL | PASS, READY, `dpl_BLSELP49wBdGSCH8bpteJ9P278LC` |
| PRODUCTION | PASS, assets et parcours navigateur réels |
| VERDICT | **PRODUCTION UPDATE COMPLETE** |

Tests exécutés : `npm run check`, tests unitaires EDT, PostgreSQL local des quatre migrations, transactions distantes annulées avant/après application, Admin/Marylène/Client/Client B, reconnaissance navigateur image/PDF/OCR, formulaires et doubles soumissions, parité navigateur Client/Client-Admin, campagnes clientes vides, import massif, file de validation photo, export CSV/XLSX, Terrain avec et sans EDT, conservation des photos privées et isolation client. Le profil Client testé n'a pas accès à la vue EDT : refus RPC et absence de navigation vérifiés ; Marylène et Client B utilisent la même recherche dans leur périmètre autorisé. Le build conserve les avertissements existants sur la taille de certains bundles et l'import mixte de `photoAccessService`.

Les diagnostics de sécurité Supabase signalent des avertissements préexistants sur des fonctions definer et la configuration Auth. Les deux fonctions concernées ici restent invoker ; aucune politique RLS, aucun rôle et aucune permission client n'ont été élargis.

## Publication et preuves finales

Code applicatif : `ca0a7ea`, poussé sur `release/v1.3.3`. [Déploiement Vercel READY](https://vercel.com/tos3/tos-display-manager/BLSELP49wBdGSCH8bpteJ9P278LC), associé à [portail.groupetos.com](https://portail.groupetos.com). La première tentative a renvoyé « Not authorized » ; la publication a réussi en précisant le périmètre existant `--scope tos3`, sans changement des permissions.

Les 87 fichiers statiques Vercel correspondent au build et ne contiennent aucune clé JWT serveur. Le HTML, les assets initiaux, OpenCV et le worker PDF servis en production correspondent octet par octet aux artefacts validés. Le type MIME JavaScript et les politiques de cache sont vérifiés. Les essais production couvrent création/modification du visuel, ajout image/PDF, retrait avec original conservé, sauvegarde/réouverture, reprise du chargement OpenCV, rechargements avec cache et forcé, tri/recherche/filtres EDT, et Admin/Marylène/Client/Client B. Les vérifications SQL après publication confirment la clôture de l'ID 10 et les quatre périmètres de permission. Le profil Client conserve son refus d'accès au centre EDT.

Les résultats bruts sont conservés localement dans `.cache/campaign-edt/production-browser.json` et `.cache/campaign-edt/deployment.json`. Le commit documentaire suivant ne modifie pas le code applicatif déployé.

## Migrations et reprise

Migrations appliquées, noms locaux alignés sur l'historique distant :

1. `20260920101916_visual_reference_removal.sql`
2. `20260920101926_edt_completed_visibility.sql`
3. `20260920104037_visual_reference_active_limit.sql`
4. `20260920200112_confirmed_edt_10_completion.sql`

Aucune nouvelle variable d'environnement. `scripts/build_campaign_edt_release.mjs --check` vérifie et construit avec une clé publique de rôle `anon`, sans injecter la clé serveur. Les outils de test utilisent les accès existants ; les visuels et fichiers temporaires créés par les essais sont nettoyés par identifiant et nom uniques.

Ordre de livraison : migrations et vérification distante, contrôle complet avec configuration publique, parcours navigateur locaux, commit ciblé et push normal, build Vercel production, contrôle des artefacts, déploiement, puis parcours réels et contrôle des assets servis.

Preuves détaillées conservées dans `.cache/campaign-edt/`, `.cache/campaign-edt-final-check.log`, `.cache/campaign-edt-build.log` et `.cache/campaign-edt-forms.log`. Les données de test ne sont pas publiées dans Git.

## Fichiers de cette mission

- `package.json`
- `src/components/CampaignsPanel.jsx`
- `src/components/CampaignVisualManager.jsx`
- `src/components/VisualReferences.jsx`
- `src/components/OperationsCenter.jsx`
- `src/lib/edtList.js`
- `src/services/openCvLoader.js`
- `src/services/visualReferenceRecognitionService.js`
- `src/services/visualReferenceService.js`
- `vite.config.js`
- `vercel.json`
- `supabase/migrations/20260920101916_visual_reference_removal.sql`
- `supabase/migrations/20260920101926_edt_completed_visibility.sql`
- `supabase/migrations/20260920104037_visual_reference_active_limit.sql`
- `supabase/migrations/20260920200112_confirmed_edt_10_completion.sql`
- `scripts/verify_visual_reference_sql.mjs`
- `scripts/verify_visual_reference_limit_remote.mjs`
- `scripts/verify_installations_production.mjs`
- `scripts/verify_campaign_edt_adjustments.mjs`
- `scripts/verify_confirmed_edt_completion.mjs`
- `scripts/verify_edt_visibility_sql.mjs`
- `scripts/verify_campaign_edt_remote.mjs`
- `scripts/verify_campaign_edt_live.mjs`
- `scripts/verify_campaign_empty_scope.mjs`
- `scripts/fixtures/campaign-empty-scope-entry.jsx`
- `scripts/build_campaign_edt_release.mjs`
- `scripts/verify_campaign_edt_deployment.mjs`
- `docs/campaign-edt-adjustments/REPORT.md`
