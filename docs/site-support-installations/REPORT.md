# Installations par site/support et références visuelles

État : **PRODUCTION UPDATE COMPLETE**. Tests locaux et test SQL distant PASS ; migration appliquée et vérifiée ; frontal déployé et validé sur https://portail.groupetos.com.

## Fonctionnement livré dans le code

- Les deux vues dédiées affichent les installations courantes, à partir des infrastructures et mouvements existants. Le `business_context` de la campagne détermine leur destination. Les affectations prévues et les retraits ne sont pas affichés comme installations courantes.
- Les nouvelles installations sont prises en compte au rafraîchissement, au retour dans la fenêtre et automatiquement toutes les 30 secondes. Les installations sans campagne maître identifiable restent dans « Installations à classer », sans classification automatique.
- Les thèmes disposent d'une recherche, d'un tri alphabétique naturel et d'une fiche détaillée. Le détail exhaustif site/support est retiré de cette vue maître ; l'historique existant reste conservé.
- Les photos à valider disposent des actions de suppression et d'attribution d'un support, selon les permissions existantes.
- Les références JPG, PNG, WebP et PDF sont ajoutées aux visuels dans les fiches des thèmes Marketing ou Communications opérationnelles. Elles apparaissent dans la colonne existante « Visuel générique de la campagne » des infrastructures.
- L'import massif recherche l'identifiant exact d'un support connu, en priorité dans le coin supérieur droit. La reconnaissance du visuel et de sa campagne repose sur les références déposées. Les résultats ambigus restent à valider ; un EDT seul ne suffit pas à attribuer un visuel.
- Les originaux de référence sont privés. Un visuel possédant des références est archivé lors d'une demande de suppression afin de conserver ses fichiers.

## Résultats

Les PASS ci-dessous couvrent les tests locaux et les contrôles distants décrits. La version publiée a également été vérifiée avec les profils Admin, Marylène, Client EXO et Client B ; les compteurs correspondent au périmètre autorisé de chacun (`production.json`).

| Contrôle | Résultat | Preuve |
| --- | --- | --- |
| Campagnes par site/support | PASS | Projection, 10 supports Marketing, navigateur |
| Communications par site/support | PASS | Projection, 10 supports opérationnels, navigateur |
| Classification Marketing | PASS | Contexte canonique ; inconnus conservés séparément |
| Classification opérationnelle | PASS | Contexte canonique ; aucune attribution par supposition |
| Visuels | PASS | Références photo/PDF et correspondance en navigateur |
| EDT | PASS | Reconnaissance, multi-EDT et non-régression EDT |
| Dates installation/retrait | PASS | Dates des mouvements, retraits exclus du courant |
| Déduplication | PASS | Plusieurs photos pour un même mouvement |
| Campagnes thèmes et visuels | PASS | Recherche, ordre, fiche détaillée, formulaires |
| Historique synthèse | PASS | Projection et non-régression existante |
| Client / Client-Admin | PASS | Navigateur et RLS distante en lecture seule |
| Client B | PASS | Isolation distante, aucune infrastructure EXO |
| Exports | PASS | Contrôles de grille et sélection des lignes filtrées |
| Photos / Terrain | PASS | Suites de non-régression |
| CHECK | PASS | `checks.json`, `check.log` |
| BUILD | PASS | `checks.json`, `build.log` |
| DIFF | PASS | `checks.json`, `diff.log` |
| SQL et stockage privé | PASS local | PostgreSQL embarqué, RLS et archivage |
| Test transactionnel du nouveau schéma en production | PASS | Neuf profils ; rollback vérifié (`remote-transaction.json`) |
| COMMIT | `2f95408` | Fonctionnalités `5a46a99`, déduplication `4bed7f8`, historique facultatif `2f95408` |
| PUSH | PASS | Push normal sur `release/v1.3.3` |
| VERCEL | PASS | `dpl_HP97SGKSPLpmR64qEq9ksLqFaqi4`, domaine public associé |
| PRODUCTION | PASS | HTML et fichiers initiaux identiques au build ; quatre profils validés |

Audit distant en lecture seule : 6 619 infrastructures ; 4 543 installations courantes projetées, dont 2 387 Marketing, 301 opérationnelles et 1 855 à classer. Les 38 lignes d'historique existantes restent conservées. Voir `remote-data.json`. Les neuf profils testés et leur isolation figurent dans `remote-roles.json`.

Les essais de reconnaissance utilisent des images de test, avec perspective et identifiant de cadre, ainsi qu'un PDF généré. Ils démontrent le fonctionnement du traitement ; les références métier et les photos réelles devront être ajoutées par les utilisateurs. Une image floue, un visuel peu distinctif ou plusieurs références identiques peuvent nécessiter une validation manuelle.

## Migration et ordre de publication

Migration additive : `supabase/migrations/20260920085824_visual_reference_assets.sql`. Elle ajoute `reference_assets` aux visuels existants, un bucket privé, les permissions minimales correspondantes et la protection contre la suppression d'un visuel référencé. Aucune variable d'environnement nouvelle n'est requise.

Ordre exécuté : test transactionnel distant avec attente de verrou limitée à 2 secondes, exécution limitée à 15 secondes et rollback vérifié ; application et vérification de la migration ; commit et push normal ; build et déploiement Vercel ; contrôles du portail en production. Le schéma a été appliqué avant le frontal.

Limites des références : 25 Mo par fichier, 20 pages par PDF, 10 fichiers par visuel et 4 Mo de métadonnées de reconnaissance par visuel. Le moteur de reconnaissance est chargé à la demande. Le build signale la taille importante de ce module ; le test réel en navigateur passe.

Verdict : **PRODUCTION UPDATE COMPLETE**.


## Fichiers modifiés ou ajoutés

Liste exhaustive : [changed-files.json](changed-files.json). Les autres fichiers non suivis préexistants du dépôt ne font pas partie de cette livraison. Les fichiers `.log` cités sont des journaux locaux ignorés par Git ; les résultats structurés `.json` sont versionnés.


Migration appliquée et enregistrée le 20 septembre 2026 sous la version `20260920085824`. Le fichier local porte cette version pour rester aligné avec le journal distant. Aucun nouvel avis de sécurité Supabase après migration. Build Vercel de production : PASS.


Contrôle de production : les compteurs sont comparés au catalogue autorisé de chaque profil. Les droits de publication existants donnent accès à 23 campagnes pour Marylène, contre 32 pour Admin. Les autorisations ne sont pas élargies pour obtenir artificiellement des compteurs identiques. Une ligne historique sans client est rattachée en mémoire au seul support exact déjà accessible afin de supprimer un doublon ; aucune donnée historique n’est modifiée.


Le profil Client EXO testé n’a actuellement aucune campagne maître accessible : ses tables classées sont donc vides et ses installations restent dans la liste à classer. Les droits de publication et d’accès aux campagnes n’ont pas été modifiés par cette livraison. Le contrôle Client B utilise le compte de test déjà activé, sans terminer une invitation réelle.
