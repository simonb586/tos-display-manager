# Rapport — améliorations ciblées TOS Display Manager

Date : 15 septembre 2026. Branche : `release/v1.3.3`.

## Modifications et validation

| Exigence | Résultat |
|---|---|
| Enjeu sans EDT/Phase, auteur et date serveur, photo et historique | PASS |
| Dashboard marketing, source canonique et portée client | PASS |
| Dashboard communications, source canonique et portée client | PASS |
| Visuel multi-EDT : ajout, modification, retrait individuel | PASS |
| Dates début/fin indépendantes par EDT | PASS |
| Installation avec EDT par défaut | PASS |
| Installation sans EDT explicite et décochée par défaut | PASS |
| Visuels marketing, communications et Hors-Cadre compatibles | PASS |
| Table Photos brute retirée des deux rôles clients | PASS |
| Photos et inventaire Client et Client-Admin | PASS |
| Lecture seule, mutations directes refusées | PASS |
| Dossiers EDT, Inspections, Supports avec enjeux, Installation sans EDT | PASS |
| Client B : aucune photo EXO, signature privée refusée | PASS |
| Admin : actions photo conservées, suite de non-régression | PASS |
| Terrain : installation, inspection, enjeu, retrait, photos | PASS |
| Sécurité : RLS, Storage privé, limites de tenant | PASS dans le périmètre ciblé |

## Compteurs canoniques

| Rôle | Marketing total / actif | Communications total / actif |
|---|---:|---:|
| Admin, tous clients autorisés | 22 / 17 | 10 / 6 |
| Client EXO | 21 / 17 | 10 / 6 |
| Client-Admin EXO, Marylène | 21 / 17 | 10 / 6 |
| Client B | 1 / 0 | 0 / 0 |

L’écart de total marketing Admin/EXO correspond à la campagne du client B. Les indicateurs actifs attendus sont identiques : **17 marketing et 6 communications**. Les comptes viennent des mêmes prédicats SQL canoniques, avec la portée de l’utilisateur vérifiée côté serveur.

## Base et préservation

Migrations additives appliquées et vérifiées, dans cet ordre :

1. `20260915023244_targeted_terrain_visual_photo_improvements.sql`
2. `20260915024026_client_photo_inventory_canonical_scope.sql`

Quatre associations EDT historiques ont été reprises. Une photo historique a retrouvé son EDT par son propre événement d’audit. Aucun EDT fictif n’est créé pour les installations sans EDT. Les lignes et fichiers métier existants sont conservés. Le nouveau droit client ouvre les photos canoniques non supprimées de son tenant ; il ne change pas les anciens indicateurs de publication. Les écritures clients sont explicitement refusées.

Ordre suivi : tests SQL isolés, transaction réelle annulée, migrations, contrôles RLS/Storage, tests locaux réels, vérification complète, build Vercel, puis commit/push et déploiement.

## Vérifications

- `npm run check` : PASS, code de sortie 0, avec build et suites de non-régression.
- SQL isolé : 11 scénarios PASS, dont dates invalides, relation interclient, atomicité, compatibilité de format, modes explicites et idempotence.
- Composants React réels : PASS pour les trois rôles, dossiers, recherche, zoom et formulaires.
- API réelle : multi-EDT, cinq opérations Terrain, lecture privée des deux clients EXO, écritures refusées, isolation Client B : PASS.
- `vercel build --prod` : PASS.
- `git diff --check` : PASS sur le travail suivi final. Le contrôle initial des nouveaux fichiers indexés a signalé un espace final sur une ligne vide de la migration déjà appliquée (ligne 154). Ce fichier est conservé tel qu’appliqué pour respecter son immutabilité.

Un essai local Client a atteint le délai de 4,5 secondes du tableau de bord. La reprise est vérifiée séparément et toute nouvelle tentative figure dans `local-live.json` / `production.json`. Les avertissements existants de taille des bundles et d’imports mixtes Vite restent présents. Les alertes Supabase préexistantes relatives aux fonctions definer et aux réglages Auth ne sont pas une certification globale de sécurité ; aucun réglage Auth n’a été modifié.

Liste précise des fichiers : [changed-files.txt](changed-files.txt). Méthode de reproduction et preuves : [README.md](README.md).

## Livraison

- Commit applicatif : `6e8f6f911e13a13c0a698c34115f36e24a6bcc25`.
- Push : **PASS**, normal sur `release/v1.3.3`.
- Vercel : **PASS**, `dpl_DKBWpNM4ZYUZC9vJD4LFjL68BHQc`, `READY`.
- Déploiement : https://tos-display-manager-duonszgwo-tos3.vercel.app
- Portail : https://portail.groupetos.com
- Production : **PASS**, 12 contrôles réels enregistrés dans [production.json](production.json), sans reprise du dashboard nécessaire lors du test final.
- Fichiers publics JavaScript/CSS : empreintes SHA-256 identiques au build validé, [production-assets.json](production-assets.json).
- Nettoyage : zéro support et zéro profil de test restants ; 12 photos métier et 4 associations historiques conservées.
- Les preuves finales sont enregistrées dans un commit documentaire distinct, sans modification du code déployé.

**VERDICT : PRODUCTION UPDATE COMPLETE**
