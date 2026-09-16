# Photos et inventaire — rapport de validation

## Périmètre livré

- Import en deux étapes : conservation de chaque original, puis confirmation du contexte. Les photos ambiguës restent dans la file de validation et ne modifient pas l’Infrastructure.
- Reconnaissance indépendante du support, de la date, du type, de tous les EDT liés, de la phase, de la campagne/communication et du visuel compatible. Aucun lien préalable support–visuel n’est exigé.
- Correction individuelle et en lot, aperçu, zoom, rotation, navigation et accès à l’original. Une décision de lot conserve les supports individuels.
- Historique canonique des installations/retraits : plusieurs photos peuvent documenter un même mouvement. Les inspections et enjeux ne deviennent pas des mouvements d’affiches.
- Annulation autorisée par le serveur, confirmée dans l’interface, auditée et idempotente. Recalcul chronologique de l’état courant, photos conservées.
- Projections serveur sans courriel d’auteur interne pour Client, Client-Admin et aperçu Admin. Les données d’audit originales restent accessibles aux rôles internes autorisés.
- Dossiers photos conservés, filtre EDT partagé avec l’inventaire, recherche, tri et pagination. Signature des miniatures à l’approche de la zone visible.
- Export ZIP : les photos ayant le même nom occupent désormais des entrées distinctes.

## Lot représentatif réel

Essai avec les services applicatifs, 48 JPEG contenant une date EXIF et des objets Storage privés réels. Chaque fichier téléchargé est comparé octet par octet à son original.

| Mesure | Résultat |
|---|---:|
| Originaux importés et vérifiés | 48/48 |
| Reconnaissances entièrement automatiques | 16/48 |
| Prêtes après choix manuel initial du type inspection | 8 |
| À valider initialement | 24 |
| Dont non identifiées | 8 |
| Photos finalement validées | 41 |
| Photos restant volontairement non identifiées | 7 |
| Originaux perdus ou altérés | 0 |
| Infrastructure modifiée par un brouillon | 0 |

Les 8 photos d’une même installation et les 8 photos d’un même retrait produisent deux mouvements. Les corrections supplémentaires couvrent un support identifié manuellement, une installation sans EDT, un visuel ambigu et des inspections. Les fixtures métier, objets Storage et comptes temporaires sont nettoyés après les essais ; les contrôles ne suppriment aucune donnée métier préexistante.

## Matrice

| Contrôle | Preuve |
|---|---|
| Reconnaissance, formats, Hors-Cadre, EDT concurrents, dates incertaines | `recognition-tests.json` — PASS |
| Revue visuelle, correction, zoom/rotation, lot conservant les supports | `browser-tests.json` — PASS |
| Import réel, conservation, finalisation, refus des ambiguïtés | `local-live.json`, `import-transaction-tests.json` — PASS |
| Recalcul A → retrait A → B ; annulations successives et double clic | `movement-transaction-tests.json`, `local-live.json` — PASS |
| Client et Client-Admin : auteurs masqués, mutations refusées | `local-live.json`, `privacy-matrix-tests.json` — PASS |
| Client B : aucun accès aux photos/mouvements EXO ni signature | `local-live.json` — PASS |
| Marylène et véritable en-tête d’aperçu Admin | `local-live.json` — PASS |
| CSV, XLSX, PDF, ZIP sans courriel interne | `export-tests.json` — PASS |
| Terrain : cinq opérations canoniques PostgreSQL | `terrain-transaction-tests.json` — PASS |
| Terrain : cinq parcours réels et dossiers par rôle | `terrain-local-live.json` — PASS |
| Compteurs du tableau de bord préservés | `dashboard-compatibility-tests.json`, `dashboard-reuse-tests.json` — PASS |
| Vérification complète et build | `check.log` — PASS |
| Reprise après erreur, annulation du délai, aperçu et grilles existantes | `extra-checks.log` — PASS |
| Cinq migrations locales identiques aux versions appliquées | `migration-integrity.json` — PASS |

Les tests d’exports utilisent les véritables fonctions de génération et des lignes réellement obtenues par les API clients. Le téléchargement d’image de leur test ZIP est simulé ; la lecture des vrais fichiers privés et leur intégrité sont vérifiées séparément dans le lot réel. Les essais React locaux utilisent des services déterministes ; les essais distants utilisent de vrais comptes et API.

## Migrations appliquées

1. `20260916001452_photo_inventory_import_privacy_movements.sql`
2. `20260916001458_photo_import_canonical_movements.sql`
3. `20260916003054_photo_projection_dashboard_compatibility.sql`
4. `20260916003405_photo_dashboard_scoped_aggregate_reuse.sql`
5. `20260916003918_photo_import_ambiguous_existing_movement_guard.sql`

Les migrations appliquées restent immuables. Les correctifs de compatibilité ont été ajoutés dans de nouvelles migrations. Les métadonnées initiales figurent dans les fichiers `*-before.json`.

## Performance et sécurité

Les premiers essais ont détecté des interruptions prématurées du tableau de bord à 4,5 secondes. Les agrégats réutilisent maintenant les lignes déjà autorisées par RLS : la comparaison SQL conserve tous les compteurs et mesure environ 2,1 secondes au lieu de 3,5 secondes dans le scénario instrumenté. Le délai frontal reste borné, à 10 secondes, avec annulation, erreur et reprise. Le dernier lot réel passe les trois rôles sans reprise.

L’advisor signale les huit nouveaux points d’entrée `SECURITY DEFINER` destinés aux utilisateurs authentifiés : ils vérifient le profil, les capacités et le périmètre, et sont interdits à `anon`. Le schéma privé et sa table de référence ne sont pas accordés aux utilisateurs ; RLS y refuse tout accès direct. Les avis Auth et les 116 points d’entrée préexistants restent hors périmètre. Voir [la documentation de l’advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## Publication

Les validations avant publication sont PASS. Commit, push, déploiement Vercel et contrôles de production : à effectuer. Aucun verdict de production complète n’est encore prononcé.
