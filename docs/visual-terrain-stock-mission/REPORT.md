# Visuels, imports externes, enjeux et stock

État : vérifications locales et distantes réussies ; artefact de production construit et audité. Publication bloquée par le contrôle automatique, en attente de confirmation directe.

## Les 204 photos existantes

204/204 lignes et originaux conservés et réanalysés. Aucun mouvement créé, aucune finalisation automatique, choix manuels préservés. 204 dates confirmées ; 69 supports confirmés automatiquement ; 198 photos ont au moins un candidat de support. Les six autres nécessitent une identification manuelle. Les photos incertaines restent à valider.

Aucun des 157 visuels existants ne possède actuellement de référence générique active. Certaines références EDT des infrastructures (notamment EDT-TOS-60-C / EDT-TOS-60-H) ne correspondent à aucun EDT du catalogue. Il n’y a donc pas d’association EDT/campagne/visuel confirmée ni de photo entièrement prête dans ce lot. Ajouter les bonnes références et compléter les EDT manquants permettra de poursuivre la reconnaissance ; les choix manuels restent possibles. Aucun EDT, visuel ou historique fictif n’a été créé pour contourner ces absences.

Précision OCR : sur trois originaux relus visuellement, le bon numéro est proposé 3/3 fois ; 2/3 sont confirmés automatiquement et le troisième, moins lisible, reste manuel. Ce petit échantillon ne mesure pas la précision globale des 204 photos. Le taux de confirmation du support sur le lot est 69/204 (33,8 %), distinct d’une mesure de précision.

## Validation

| Contrôle | Résultat local / distant |
|---|---|
| Visuels : scroll ordinateur/portable/mobile | PASS |
| Modifier le visuel | PASS |
| Supprimer / archiver le visuel utilisé | PASS |
| Référence générique JPG / PNG | PASS |
| Référence générique PDF | PASS |
| Référence générique dans Infrastructure et fiche 360 | PASS |
| Sélection multiple et sélection complète entre pages | PASS |
| Suppression par lot avec annulation et double clic | PASS |
| Détection des supports et propositions incertaines | PASS |
| Association EDT à la date de photo | PASS |
| Association campagne / communication | PASS |
| Association visuelle par référence et format | PASS |
| Heures métier HH:MM:SS écran / CSV / XLSX / PDF | PASS |
| Déclaration d’enjeu | PASS |
| 11 types d’enjeux : 11/11 | PASS |
| Synchronisation Infrastructure | PASS |
| Photos d’enjeu et de résolution dans la fiche 360 | PASS |
| Photo principale préservée | PASS |
| Résolution d’un enjeu sélectionné | PASS |
| Date et auteur de résolution conservés | PASS |
| Réactivation conditionnelle du support | PASS |
| Stock installation 100/50 → 99/51 | PASS |
| Stock retrait 99/51 → 100/50 | PASS |
| Idempotence, reprise et annulation des mouvements | PASS |
| Répertoire des affiches et article au bon format/client | PASS |
| Marylène, Client, Client-Admin et Client B | PASS |
| RLS/RPC : refus des mutations et accès interclients | PASS |
| npm run check et build | PASS |
| git diff --check | PASS |

Preuves : [lot conservé](reanalysis.json), [48 nouveaux JPEG](external-batch-local.json), [Terrain et fiches 360](terrain-local.json), [références et responsive](references-local.json), [suppression ciblée](batch-delete-local.json), [13 cas de reconnaissance](recognition-rules.json).

Les 48 JPEG de test ont été importés par les services réels, avec EXIF et comparaison des octets téléchargés. Sans référence visuelle, le visuel demande une confirmation explicite. 41 photos ont ensuite été validées et regroupées dans les mouvements attendus ; 7 sont restées en attente. L’annulation et les répétitions n’ont pas doublé les mouvements de stock. Toutes ces fixtures ont été nettoyées.

La suppression a été exercée dans le portail : sélection de 20 fichiers de test, annulation de la confirmation, sélection de 5 et double clic de confirmation ; 5 lignes et fichiers supprimés, 15 préservés. Les 204 originaux utilisateur ont été contrôlés séparément et sont intacts.

Les migrations ont été testées sur PostgreSQL local (PGlite) et en transactions distantes annulées avant application. Les règles d’enjeu, deux enjeux bloquants simultanés, le support déjà inactif, le stock insuffisant, le mauvais format/client et les reprises ont été vérifiés. L’affectation manuelle d’un EDT se fait dans la transaction existante, avec validation du client et de la phase ; une association automatique sans lien reste refusée.

## Changements et exploitation

- Références à la création/édition, remplacement et archivage conservant les originaux ; actions accessibles avec défilement horizontal/vertical.
- Reconnaissance OCR par zones, normalisation sûre, candidats approchants et GPS EXIF comme indices ; comparaison avec les références génériques ; saisie limitée aux champs manquants, valeurs reconnues visibles et modifiables.
- Réanalyse des originaux existants sans réimportation. Suppression protégée en deux étapes : réservation atomique des lignes, suppression via Storage API, vérification avant suppression des métadonnées.
- Une configuration canonique des 11 problèmes ; historique, date et photo de résolution ; remise en activité seulement si aucun enjeu bloquant ne subsiste et si le support était actif auparavant.
- Extension du répertoire et du journal de mouvements existants : article explicitement associé ou correspondance unique de visuel/format/client, opérations atomiques, quantités non négatives et idempotence. Un article ambigu, absent ou sans quantités bloque la mutation avec un message explicite.

Migrations appliquées, dans l’ordre :

1. 20260920220303_visual_terrain_stock_workflows.sql
2. 20260920221557_visual_terrain_workflow_readbacks.sql
3. 20260920222548_review_batch_storage_delete.sql
4. 20260920235156_import_manual_edt_assignment.sql

Aucune nouvelle variable d’environnement. Aucun changement des invitations ou de l’authentification. Permissions ajoutées limitées à la lecture des types d’enjeu, aux RPC gardées et à la suppression administrateur de fichiers réservés et non finalisés. Les politiques restrictives de tenant restent applicables.

Les quatre avis de sécurité Supabase préexistants sont inchangés : table RLS sans politique, fonctions SECURITY DEFINER accessibles, durée OTP et protection des mots de passe compromis. Aucun nouvel avis après les migrations. Voir [Security Advisor](https://supabase.com/dashboard/project/cmdfomowtzrinywdsosy/database/security-advisor).

Un dépassement de délai de lecture du tableau de bord pendant des essais concurrents a été suivi d’un rejeu séquentiel réussi. Une interruption réseau pendant la consolidation a été reprise sans mouvement ni perte. Les avertissements de taille de bundles et de nettoyage différé de dossiers temporaires Edge sous Windows restent non bloquants.

[Fichiers applicatifs, migrations et scripts modifiés](changed-files.json). Les données photo détaillées, sessions et caches locaux ne sont pas commis.

## Livraison

| Livraison | État |
|---|---|
| Commit applicatif | 9cc81b6 |
| Push normal | BLOQUÉ par le contrôle automatique |
| Build Vercel de production | PASS : 88 fichiers, aucune clé privée |
| Déploiement Vercel | NON EXÉCUTÉ |
| Validation de la nouvelle version en production | NON EXÉCUTÉE |
| Verdict | NO-GO de publication, en attente d’autorisation directe |

Le dépôt configuré a été vérifié via GitHub : simonb586/tos-display-manager, public, propriété de l’utilisateur authentifié simonb586, avec droits admin et push. Le contrôle automatique considère néanmoins que l’autorisation de déploiement contenue dans la pièce jointe ne couvre pas assez explicitement une publication publique et exige une confirmation directe. Aucun contournement ni force push n’a été tenté. Les migrations Supabase sont appliquées ; le frontal de production reste à sa version précédente tant que le déploiement n’est pas autorisé.
