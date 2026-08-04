# A7 — TerrainConfig : implémentation locale finale

**Statut : brouillon administratif sans effet sur TerrainApp**

## 1. Objectif
Préparer intégralement TerrainConfig 1.0.0 sans activation.
## 2. Périmètre
Modèle pur, stockage JSONB, SQL préparé, RPC, service, onglet, simulation et tests.
## 3. Contrat
Propriétés gelées : `visibleOnTerrain`, `readonlyOnTerrain`, `terrainRoles`, `terrainSection`, `terrainDisplayOrder`, `criticalFields`. `null` conserve l’historique; `false` et `0` sont préservés.
## 4. Inventaire Terrain
`TerrainApp` sélectionne Infrastructure/Arrêt puis exécute Installation, Inspection, Enjeu ou photo, avec commentaires, visuel et fichier. `terrainService` gère téléversement, métadonnées, RPC de finalisation et file locale; `InstallerTerrainShell` suit l’état en ligne; `TerrainSyncDiagnostics` consulte les diagnostics. Aucun fichier de cet inventaire n’est modifié.
## 5. Rôles
Les rôles réellement admis par TerrainApp sont Administrateur, Coordonnateur et Installateur.
## 6. Sections
La liste administrative documentaire issue des écrans/flux est Identification, Intervention, Inspection, Enjeu et Photos. Elle ne crée aucune section réelle.
## 7. Champs critiques
`support_id`, `photo_principale_url`, `photo_miniature_url`, `visuel_actuel_cadre`, plus protections PK, FK, identity, generated, système, authentification, calculé, virtuel et non configurable.
## 8. Stockage
Les colonnes historiques (`visible_terrain`, `terrain_roles`, `terrain_section`, `terrain_readonly`, `show_on_mobile`) sont fragmentées et potentiellement consommées. A7 les préserve et ajoute `relation_fields.terrain_config` JSONB, exclusivement administratif, pour le contrat canonique complet.
## 9. Migration
`V0_13_1_A7_TERRAIN_DRAFT.sql`, additive et non exécutée.
## 10. RPC
`save_relation_field_terrain_draft_v0131a7(text,text,text,jsonb,timestamptz)` sauvegarde uniquement le JSONB de brouillon.
## 11. Sécurité
SECURITY DEFINER, propriétaire postgres, `search_path=pg_catalog`, PUBLIC/anon révoqués, authenticated autorisé avec contrôles d’identité et Administrateur. Aucun SQL dynamique, rôle ou RLS.
## 12. Concurrence
`expected_updated_at` obligatoire et `SELECT ... FOR UPDATE`.
## 13. Audit
Audit commun, type `terrain`, contrat TerrainConfig 1.0.0, événement `terrain_draft_saved`, dans la même transaction et seulement en cas de changement.
## 14. Normalisation
Rejet des propriétés inconnues et types/coercitions invalides; rôles triés; doublons refusés; bornes 0–100000; champs critiques immuables.
## 15. Service
Client central, une RPC et une tentative; aucun accès direct, retry ou repli.
## 16. Interface
Onglet Mobile / Terrain administratif : visibilité, lecture seule, rôles, section, ordre, diagnostics et deux actions seulement.
## 17. Prévisualisation
Téléphone fictif local avec Support 2000-1 et valeur d’inspection fictive; aucune photo, donnée ou requête réelle.
## 18. Accessibilité
Labels, fieldsets, legends, erreurs, focus, contrôles 44 px, clavier, `aria-live` et responsive. Le dialogue non enregistré existant est réutilisé.
## 19. no_change
Court-circuit local, puis comparaison canonique RPC sans UPDATE ni audit.
## 20. stale_draft
Refus sans écrasement; changements locaux conservés et rechargement explicite.
## 21. Tests
Le vérificateur A7 couvre contrat, null/false/0, rôles, sections, ordre, protections, SQL, service, UI, simulation et non-consommation.
## 22. Non-consommation
TerrainApp, services, offline, synchronisation, photos, Inspection, Enjeu et surfaces métier ne référencent ni le modèle ni le résolveur A7.
## 23. Build
Inclus dans `npm run check`; la dette historique du bundle est hors périmètre.
## 24. Risques résiduels
SQL non testé sur PostgreSQL réel; accessibilité et concurrence non testées dans un navigateur/environnement réel.
## 25. Validations manuelles
Revue SQL, SQL Editor autorisé ultérieurement, vérificateur non mutatif, tests multi-administrateurs, clavier, lecteur d’écran et responsive.
## 26. Recommandation pour A8
Ne pas commencer A8 sans autorisation explicite; ne pas consommer A7 avant une activation A10 distincte.
