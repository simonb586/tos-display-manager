# Reconnaissance des étiquettes de support — complément du 25 septembre 2026

La mission générale est déjà livrée ; voir [le rapport existant](REPORT.md). Ce complément traite les petits numéros en haut à droite et les collants exceptionnellement placés sur la vitre, à gauche ou à droite.

## Modification

- Cadrage serré prioritaire en haut à droite, puis quatre zones chevauchantes.
- Deux zones couvrant la partie supérieure gauche de la vitre, avec chevauchement ; les zones de droite couvrent également la vitre.
- Relecture des lignes numériques, contraste renforcé et essais d'inclinaison de ±3° sur les zones du coin.
- Conservation des découpages existants, de l'orientation EXIF et de la lecture globale en secours.
- Budget de lecture borné ; candidats déjà obtenus conservés si le délai maximal expire.
- Une lecture non confirmée par le moteur reste manuelle dans le service d'import. Les variantes de contraste/inclinaison d'une même zone ne multiplient pas les preuves indépendantes.

## Résultats et limites

Sept cas synthétiques navigateur : six emplacements/formats d'étiquette reconnus et un numéro inconnu laissé sans association. Inclut vitre gauche à deux hauteurs, vitre droite, petit numéro du cadre, limite de découpage et photo paysage.

Trois originaux locaux : bon candidat 3/3 ; confirmation automatique 2/3, comme avant. Le troisième original demeure peu fiable et reste manuel. Ce petit échantillon ne mesure pas la précision de tout le lot ; aucune amélioration du taux global de confirmation des 204 photos n'est revendiquée.

Tests de sécurité du résultat OCR : candidat conservé après interruption, ambiguïté laissée manuelle, association confirmée et choix manuel préservés.

Commandes :

```text
node scripts/verify_identifier_corners_browser.mjs
node scripts/verify_identifier_review_safety.mjs
node scripts/verify_site_support_installations.mjs
node scripts/verify_external_import_rules.mjs
npm run check
git diff --check
```

Le test navigateur nécessite les trois originaux et le catalogue de diagnostic déjà présents dans `.cache/visual-terrain-stock` ; ces fichiers privés ne sont pas publiés. Le moteur OCR s'exécute dans le navigateur.

Les photos existantes ne sont ni supprimées, ni réimportées, ni finalisées par cette correction. Leur réanalyse reste disponible dans la file de validation. Aucune migration ni nouvelle variable d'environnement.

## Fichiers modifiés

- `src/services/frameIdentifierOcrService.js`
- `src/services/massPhotoImportService.js`
- `scripts/verify_identifier_corners_browser.mjs`
- `scripts/verify_identifier_review_safety.mjs`
- `scripts/verify_identifier_deployment.mjs`
- `docs/visual-terrain-stock-mission/OCR-CORNERS.md`

## Livraison

Tests navigateur OCR, sécurité des associations, régressions ciblées, `npm run check` (code de sortie 0), compilation Vercel de production et `git diff --check` : PASS. Avertissements existants sur la taille des bundles et les scripts d'installation de dépendances ; compilation réussie.

Commit applicatif : `e52ed00`. Push normal sur `release/v1.3.3` : PASS.

Publication Vercel de production : PASS, `tos-display-manager-kin7vzfux-tos3.vercel.app`, code de sortie 0. Contrôle de `https://portail.groupetos.com` : PASS ; page de connexion accessible, HTML, assets d'entrée, module OCR et worker identiques octet par octet au build validé. L'essai OCR des photos a été exécuté localement dans Edge ; ce contrôle de production vérifie la livraison des mêmes fichiers, sans importer de photos ni modifier de données en production.

Verdict du complément OCR : PRODUCTION UPDATE COMPLETE, avec la limite de reconnaissance réelle documentée ci-dessus. Les preuves détaillées sont conservées localement dans `.cache/visual-terrain-stock/ocr-corner-*`.
