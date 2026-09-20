# Installations par site/support et références visuelles

État : tests locaux et test SQL distant PASS ; migration appliquée et vérifiée ; publication du frontal en cours.

## Fonctionnement livré dans le code

- Les deux vues dédiées affichent les installations courantes, à partir des infrastructures et mouvements existants. Le `business_context` de la campagne détermine leur destination. Les affectations prévues et les retraits ne sont pas affichés comme installations courantes.
- Les nouvelles installations sont prises en compte au rafraîchissement, au retour dans la fenêtre et automatiquement toutes les 30 secondes. Les installations sans campagne maître identifiable restent dans « Installations à classer », sans classification automatique.
- Les thèmes disposent d'une recherche, d'un tri alphabétique naturel et d'une fiche détaillée. Le détail exhaustif site/support est retiré de cette vue maître ; l'historique existant reste conservé.
- Les photos à valider disposent des actions de suppression et d'attribution d'un support, selon les permissions existantes.
- Les références JPG, PNG, WebP et PDF sont ajoutées aux visuels dans les fiches des thèmes Marketing ou Communications opérationnelles. Elles apparaissent dans la colonne existante « Visuel générique de la campagne » des infrastructures.
- L'import massif recherche l'identifiant exact d'un support connu, en priorité dans le coin supérieur droit. La reconnaissance du visuel et de sa campagne repose sur les références déposées. Les résultats ambigus restent à valider ; un EDT seul ne suffit pas à attribuer un visuel.
- Les originaux de référence sont privés. Un visuel possédant des références est archivé lors d'une demande de suppression afin de conserver ses fichiers.

## Résultats

Les PASS ci-dessous concernent la version locale et les contrôles distants explicitement décrits, pas une validation du nouveau frontal en production.

| Contrôle | Résultat | Preuve |
| --- | --- | --- |
| Campagnes par site/support | PASS | Projection, 10 supports Marketing, navigateur |
| Communications par site/support | PASS | Projection, 10 supports opérationnels, navigateur |
| Classification Marketing / opérationnelle | PASS | Contexte canonique ; inconnus conservés séparément |
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
| COMMIT | NON EFFECTUÉ | Publication en attente |
| PUSH | NON EFFECTUÉ | Publication en attente |
| VERCEL | NON EFFECTUÉ | Migration requise avant déploiement |
| PRODUCTION | NON VALIDÉE pour cette version | Portail déployé inchangé |

Audit distant en lecture seule : 6 619 infrastructures ; 4 544 installations courantes projetées, dont 2 388 Marketing, 301 opérationnelles et 1 855 à classer. Les 38 lignes d'historique existantes restent conservées. Voir `remote-data.json`. Les neuf profils testés et leur isolation figurent dans `remote-roles.json`.

Les essais de reconnaissance utilisent des images de test, avec perspective et identifiant de cadre, ainsi qu'un PDF généré. Ils démontrent le fonctionnement du traitement ; les références métier et les photos réelles devront être ajoutées par les utilisateurs. Une image floue, un visuel peu distinctif ou plusieurs références identiques peuvent nécessiter une validation manuelle.

## Migration et ordre de publication

Migration additive : `supabase/migrations/20260920085824_visual_reference_assets.sql`. Elle ajoute `reference_assets` aux visuels existants, un bucket privé, les permissions minimales correspondantes et la protection contre la suppression d'un visuel référencé. Aucune variable d'environnement nouvelle n'est requise.

Après confirmation : test transactionnel distant avec attente de verrou limitée à 2 secondes, exécution limitée à 15 secondes et rollback ; application et vérification de la migration ; commit et push normal ; déploiement Vercel ; validation du portail en production. Ne pas déployer le frontal avant le schéma.

Limites des références : 25 Mo par fichier, 20 pages par PDF, 10 fichiers par visuel et 4 Mo de métadonnées de reconnaissance par visuel. Le moteur de reconnaissance est chargé à la demande. Le build signale la taille importante de ce module ; le test réel en navigateur passe.

Verdict actuel : **NO-GO pour déclarer la mise à jour de production terminée**, en attente de la validation finale du frontal publié.


## Fichiers modifies ou ajoutes

Liste exhaustive : [changed-files.json](changed-files.json). Les autres fichiers non suivis preexistants du depot ne font pas partie de cette livraison.


Migration appliquée et enregistrée le 20 septembre 2026 sous la version `20260920085824`. Le fichier local porte cette version pour rester aligné avec le journal distant. Aucun nouvel avis de sécurité Supabase après migration. Build Vercel de production : PASS.
