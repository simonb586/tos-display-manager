# Cutover coordonné — NO-GO

État vérifié le 10 septembre 2026. Le frontend compatible est en production et `terrain-photos` est privé. La certification reste bloquée : à 10:16:41 UTC, **10 anciennes URL publiques sur 21 répondent encore HTTP 200 depuis le CDN**. Les mêmes 21 chemins avec une requête sans cache sont tous refusés. Aucun fichier n'a été supprimé ou remplacé pour tenter d'invalider le cache.

## Livraison

- Branche : `release/v1.3.3`, push normal.
- Premier commit frontend : `ff361d67dc2361f9c9bdd6bd4883feff9e0cdc29`.
- Correctif frontend actuellement déployé : `a56cb62b6dbbe8568bb3dade3b7b9ab80aff453a`.
- Vercel #1 : `dpl_2dHkG8bVGSV5c5BkQQyEyZ4AAis5`, READY.
- Vercel final : `dpl_E7sF3CTZShC4XK9PAoZa4tGgbYA5`, READY, `https://portail.groupetos.com`.
- Bundle principal : `index-XF84o7pT.js`, SHA-256 `014d2095f6105d9ff0d7fa6fe486ece3835691d7a56139826cb3545d078fc2bb`.
- Les deux déploiements ont précédé la fermeture. Le second corrigeait la projection Photos du portail pour les photos légitimes sans campagne. Aucun autre changement fonctionnel n'a été déployé après la fermeture.

Les deux migrations supplémentaires appliquées sont conservées dans ce commit de suivi :

| Migration | Effet | Validation |
| --- | --- | --- |
| `20260910094611_cutover_preview_photo_parity.sql` | Photos de l'aperçu alignées sur le propriétaire cible, avec les gardes d'identité et de client conservées | 8 cas locaux et 8 distants PASS |
| `20260910095039_terrain_photos_private_coordinated_cutover.sql` | Policies privées et fermeture atomique du bucket | 180 cas locaux ; droits HTTP privés PASS ; cache public résiduel FAIL |

Le contenu SQL local correspond aux migrations distantes après normalisation des seuls espaces de transport : MD5 `20e9ceb50e81a14d6d0b9b468ce49bd3` et `1c97e517c15c5f57f7194a711e373955`. Les migrations déjà appliquées n'ont pas été réécrites. Le fichier historique `supabase/prepared/20260909113049_terrain_photos_private_policies_prepared.sql` est désormais matérialisé par la seconde migration ; ne pas le réappliquer.

## Résultats

| Contrôle demandé | Résultat et limite |
| --- | --- |
| Frontend private-compatible | PASS : anciennes références converties en signatures ; aucun lecteur critique actif exclusivement public |
| Commit / push frontend | PASS : les deux commits ci-dessus ont été poussés et leur HEAD distant vérifié |
| Vercel #1 / final | PASS : les deux déploiements sont READY ; le second dessert le domaine de production |
| Bucket avant / après | PUBLIC → PRIVATE |
| Fichiers existants | PASS : 21/21, téléchargements signés et empreintes des octets identiques |
| Storage | **FAIL global** : droits privés PASS, mais 10 URL publiques encore en cache |
| Signed URLs | PASS sur les essais HTTP : génération, lecture, expiration réelle d'un jeton court, renouvellement, refus et absence de repli public |
| Cache applicatif | PASS en production : réutilisation, erreur réseau, retry, changement Client EXO → Client B et déconnexion ; anciennes signatures non réutilisées par le résolveur |
| Client B | PASS portail, RPC, exports et demandes de signature : 0 EXO. **Isolation globale non certifiée** tant que les anciennes URL anonymes restent accessibles |
| Marylène | PASS : Infrastructures 25 lignes, Campagnes 14 lignes, 10 images privées, Actualiser, export XLSX avec image intégrée ; surveillance continue 31 s, aucun cycle de connexion |
| Admin / aperçu / Fiche 360 | PASS : 2 images privées dans la Fiche 360, 10 dans l'aperçu ciblé, PDF réel avec image intégrée |
| Terrain | PARTIEL : sélection réelle support/EDT/phase/visuel, upload privé et suppression de retour arrière PASS. Le parcours UI complet enjeu → Terminer → historique sur fixture reste à certifier |
| VH-VAUD-16 | PASS en RPC et dans l'UI : 34 prioritaire, 89/90 exclus, 42 visuels compatibles ; relations protégées conservées |
| Auth 24 h | NON EXÉCUTÉ : condition Storage PASS non satisfaite ; configuration inchangée |
| Safe Links | NON CERTIFIÉ : campagne réelle d'invitation et prélecture non exécutée |
| Edge | NON DÉPLOYÉ : handlers préparés seulement, revue et tests distants encore requis |
| Courriel réel | NON EXÉCUTÉ, requis : aucun courriel envoyé pendant ce cutover |
| Métier / rapports | 118/118 scénarios métier et de portée distants PASS ; PDF privé réel PASS. Les preuves antérieures de concurrence ne remplacent pas la certification finale complète |
| Historiques | 84/84 suites rejouées PASS |
| Navigateur local | 628/628 PASS, dont 30 photos ; services simulés, à distinguer des essais de production ci-dessus |
| Régressions locales | 9/9 suites PASS ; policies privées 180 cas PASS |
| Security precheck SQL | PASS : 0 grant métier anonyme, 0 RPC privée anonyme, 0 SECURITY DEFINER sans search_path fixé, 0 vue non security_invoker |
| Scans sans identité | PASS : 56 tables/vues sous anon et 56 sous authenticated sans UID, 0 ligne lisible |
| RPC / portée | 931 gardes/grants, 493 SELECT sur 29 tables et 986 contrôles de portée PASS |
| Check / build / diff | PASS ; avertissements de taille de bundle et d'import mixte existants, sans échec de build |
| Verdict | **NO-GO — ne pas déclarer CUTOVER COMPLETE** |

L'essai initial des 986 cas a reçu HTTP 504 du connecteur et n'est pas compté comme réussi. Les 986 cas ont ensuite tous été rejoués par lots, avec résultats persistés dans `final-sql-validation.json`.

La déconnexion invalide le cache de l'application et les nouvelles demandes de signature. Elle ne révoque pas instantanément une URL signée déjà copiée : cette URL reste un jeton d'accès jusqu'à son expiration. Les durées applicatives sont 120 s pour le téléchargement, 300 s pour l'aperçu et 900 s pour le rapport. Les tests ne prétendent pas certifier une révocation instantanée de ces jetons.

## Blocage CDN et reprise

La fermeture a été réalisée en SQL. Le [code Storage de Supabase](https://github.com/supabase/storage/blob/master/src/storage/storage.ts) prévoit une purge automatique dans l'API lors d'une transition public → privé ; cette transaction SQL n'a pas déclenché ce chemin. Une confirmation `updateBucket({public:false})` a réussi ensuite, mais le bucket était déjà privé. La purge manuelle `purgeBucketCache('terrain-photos')` a répondu HTTP 403 : `feature not enabled for this tenant`.

Demander au support Supabase d'activer la purge ou de purger le cache du seul bucket `terrain-photos`, sans suppression d'objet. La [documentation de purge CDN](https://supabase.com/docs/guides/storage/cdn/purge-cdn-cache) décrit une propagation pouvant prendre 60 secondes et précise que les caches déjà présents dans les navigateurs ne sont pas effacés. Ne pas rouvrir le bucket ou remplacer les photos pour provoquer une invalidation.

Après purge ou expiration effective, rejouer les 21 URL littérales, sans ajouter de paramètre destiné à contourner le cache : elles doivent toutes être refusées. Le refus des seules URL avec nonce ne suffit pas. Puis terminer le parcours Terrain sur fixture isolée et la couverture Client B/Fiche 360/rapports, avant de poursuivre la phase Auth autorisée.

Auth doit ensuite être configuré avec une modification limitée à la durée d'invitation, sans pousser aveuglément le fichier complet contenant les autres paramètres SMTP/SMS. Les limites 24 h, renvois, usage unique, Safe Links et Edge restent à tester réellement. `info@groupetos.com` est un compte activé existant : le préserver. Une autre adresse contrôlée est encore nécessaire pour tester une nouvelle invitation sans réinitialiser ce compte ; la réception et le clic devront être confirmés.

## Préservation et preuves

- 2 027 événements conservés ; empreinte `10b1a25223df81f329a79eb0ae2bf3f3`, calculée par `md5(string_agg(to_jsonb(a)::text,'' order by a.id))`.
- 21 objets Terrain et les références métier conservés. Les octets ont été comparés aux empreintes avant bascule.
- Relations `edt_supports.id=3`, `campagnes_supports.id=1`, `campagnes_visuels_sites_supports.id=163` présentes.
- Comptes Auth temporaires et uploads de test nettoyés ; fixtures SQL annulées par transaction.
- Aucun secret, session, PDF/XLSX métier ou résultat brut de production inclus dans le commit de suivi ou envoyé à Vercel.

Les preuves détaillées restent localement dans ce dossier : `private-storage-http.json`, `private-session.json`, `public-cache-final.json`, `cache-purge.json`, `client-b-private.json`, `marylene-photos-private.json`, `admin-paths-private.json`, `terrain-private-read.json`, `final-local-validation.json` et `final-sql-validation.json`. Les essais de diagnostic ayant échoué ne sont pas des certifications PASS.

Fichiers du commit de suivi : ce rapport, `README.md`, le récapitulatif SQL sans données métier, les deux nouvelles migrations appliquées, le test SQL de l'aperçu et l'agrégateur des 628 cas navigateur. Les scripts d'investigation et les résultats bruts restent locaux. Le hash du commit de suivi et son HEAD distant sont fournis dans le compte rendu de livraison.
