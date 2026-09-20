# Ajustements campagnes, visuels et EDT — 20 septembre 2026

## État de livraison

**Correction métier confirmée et appliquée ; livraison en cours.** Les quatre migrations ont été appliquées après tests PostgreSQL locaux et distants annulés. Les validations du build et des parcours sont reprises avant commit, push et déploiement.

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

Les PASS frontend ci-dessous portent sur **le build local connecté au Supabase réel**, pas sur un nouveau déploiement du portail.

| Contrôle demandé | Résultat |
| --- | --- |
| Bouton fiche visuel — Campagnes maîtres | PASS local |
| Bouton fiche visuel — Communications | PASS local |
| Présentation compacte visuels/formats | PASS local |
| Références génériques dans Modifier | PASS local |
| Ajout image générique | PASS navigateur réel |
| Ajout PDF générique | PASS navigateur réel |
| OpenCV | CORRIGÉ dans le build ; retry testé |
| Tri EDT | PASS |
| Recherche EDT | PASS, incluant l'alias 09.0.1 |
| EDT-TOS-22-A | VISIBLE dans le build et retourné par le RPC distant |
| Statut 22-A | TERMINÉ, 100 %, désarchivé en base |
| EDT-TOS-09.0.1 | VISIBLE sous son numéro existant 09 (0.1) |
| Statut 09.0.1 = Terminé | TERMINÉ, 100 %, désarchivé après confirmation |
| Filtre Terminés | Validation des deux EDT dans les parcours actualisés |
| Filtre Tous | PASS |
| Filtre Archivés | PASS ; 22-A exclu, archives réelles conservées |
| Client B | PASS SQL distant et navigateur réel ; rôle Client-Admin et périmètre respectés |
| CHECK | PASS, nouveaux tests intégrés |
| BUILD | PASS avec configuration publique Supabase vérifiée |
| DIFF | PASS |
| COMMIT | Non effectué |
| PUSH | Non effectué |
| VERCEL | Non déployé |
| PRODUCTION | Validation frontend finale non effectuée |
| VERDICT | Validation de livraison en cours |

Tests exécutés : `npm run check`, tests unitaires EDT, PostgreSQL local des quatre migrations, transactions distantes annulées avant/après application, Admin/Marylène/Client/Client B, reconnaissance navigateur image/PDF/OCR, formulaires et doubles soumissions, parité navigateur Client/Client-Admin, campagnes clientes vides, import massif, file de validation photo, export CSV/XLSX, Terrain avec et sans EDT, conservation des photos privées et isolation client. Le profil Client testé n'a pas accès à la vue EDT : refus RPC et absence de navigation vérifiés ; Marylène et Client B utilisent la même recherche dans leur périmètre autorisé. Le build conserve les avertissements existants sur la taille de certains bundles et l'import mixte de `photoAccessService`.

Les diagnostics de sécurité Supabase signalent des avertissements préexistants sur des fonctions definer et la configuration Auth. Les deux fonctions concernées ici restent invoker ; aucune politique RLS, aucun rôle et aucune permission client n'ont été élargis.

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
