# Association automatique Terrain / Répertoire

Correction du 25 septembre 2026, en complément des corrections OCR déjà livrées.

## Comportement

La sélection du visuel déclenche une résolution serveur dans `repertoire_des_affiches`. Une nouvelle résolution précède l'envoi de la photo et la validation finale. Aucun sélecteur d'article ni association manuelle n'est demandé à l'installateur.

Priorité : identifiant enregistré dans l'intervention, l'association ou l'EDT, puis `inventory_item_id` du visuel ; sinon nom du visuel / `visuel`, format normalisé, campagne et médium pour départager. Les identifiants directs sont vérifiés pour le client et le format. Un identifiant fourni librement par le navigateur ne permet pas de choisir arbitrairement parmi des doublons.

Une correspondance unique conserve l'ID en état React, dans `terrain_operations.details.repertoire_affiche_id` et dans le mouvement de stock existant (`inventory_movements.item_id`, avec sa clé étrangère). Le nouveau point d'entrée appelle le finaliseur canonique existant ; les contrôles de rôle, EDT, éligibilité, propriétaire de photo et stock sont préservés.

Absence ou ambiguïté : seule la finalisation échoue avec une explication administrateur. La photo sélectionnée et les commentaires restent dans le formulaire. Après un envoi dont la réponse échoue, la photo téléversée est conservée et réutilisée avec la même clé d'idempotence. Cette conservation du formulaire vaut tant que la page reste ouverte ; ce changement n'ajoute pas de sauvegarde hors ligne persistante après fermeture du navigateur.

Les quantités restent modifiées exclusivement par le déclencheur canonique et son registre unique. Le déclencheur utilise désormais le même résolveur que Terrain. Aucune mise à jour des stocks ou association massive des données existantes n'est exécutée par la migration.

## Cas signalé

Support `HA-78904 -02` (saisie utilisateur `ha-78904-02`), EDT `EDT-TOS-73-h` : le visuel « Céder sa place aux personnes à mobilité réduite (Bus) », campagne Civisme, est déjà associé à la phase d'installation de l'EDT. Son format est `12.7 x 34.25`.

Le contrôle en lecture seule après migration retourne `not_found`, zéro correspondance. Aucun article correspondant n'existe dans le Répertoire pour ce format ; les articles Civisme présents sont en 20 × 28. Aucun article ni quantité n'a été inventé. Il reste donc à compléter ce catalogue côté administration pour permettre cette installation précise. L'absence d'image théorique de référence ne conditionne pas le nouveau résolveur.

Diagnostic du catalogue complet sans contexte EDT : 22 visuels sur 157 trouvent une correspondance unique ; 135 n'en trouvent pas. Ce diagnostic n'est pas une réparation ni une certification du contenu du catalogue.

## Vérification et livraison

- Tests PostgreSQL local : correspondance unique, aucune, ambiguïté, normalisation, format/client, campagne différente refusée, campagne historique vide, médium, ID EDT direct (`visuel_id` et `canonical_visual_id`), ID visuel direct, ID devenu différent, refus de rôles, finalisation et reprise idempotente : PASS.
- Navigateur local : photo/commentaires conservés en absence ou ambiguïté, reprise après correction, coupure réseau sans suppression ni deuxième téléversement, double clic : PASS.
- PostgreSQL distant, transactions annulées par `ROLLBACK`, avant et après migration : installation EDT et sans EDT, stock 100/50 → 99/51 inchangé à la reprise, lien article conservé, stock zéro avec annulation atomique puis reprise, permissions : PASS. Zéro infrastructure de test restante.
- `npm run check`, incluant build et nouveau `test:terrain-material` : PASS.
- Build Vercel de production, audit des assets sans clé privée et conservation du correctif OCR : PASS. Avertissements existants : taille des bundles, imports statiques/dynamiques et scripts d'installation npm.
- Migration additive appliquée : `20260925211601_terrain_material_auto_resolution.sql`, avant publication du frontal.
- Conseiller de sécurité Supabase : mêmes alertes avant/après, aucun nouveau signal ; alertes existantes sur fonctions definer, table privée sans politique, durée OTP et protection des mots de passe.

Publication et contrôle de production : à compléter après déploiement.

Diagnostic temporaire, à activer dans la console du navigateur : `sessionStorage.setItem('tos-terrain-material-debug','1')`. Pour arrêter : `sessionStorage.removeItem('tos-terrain-material-debug')`. Le journal indique visuel, format, campagne, médium, ID, nombre de correspondances et statut ; aucune photo ni session n'est journalisée. Aucune nouvelle variable d'environnement.

## Fichiers de cette correction

- `package.json`
- `src/components/TerrainApp.jsx`
- `src/services/repertoireAfficheService.js`
- `src/services/terrainService.js`
- `src/lib/terrainErrors.js`
- `supabase/migrations/20260925211601_terrain_material_auto_resolution.sql`
- `scripts/verify_terrain_p0_regression.mjs`
- `scripts/verify_terrain_material_sql.mjs`
- `scripts/verify_terrain_material_browser.mjs`
- `scripts/verify_terrain_material_remote.mjs`
- `scripts/verify_terrain_material_deployment.mjs`
- `scripts/fixtures/terrain-material-entry.jsx`
- `scripts/fixtures/terrain-material-remote.sql`
- `docs/visual-terrain-stock-mission/TERRAIN-REPERTOIRE.md`

Preuves détaillées conservées localement dans `.cache/terrain-material/` ; les données de diagnostic privées ne sont pas publiées.
