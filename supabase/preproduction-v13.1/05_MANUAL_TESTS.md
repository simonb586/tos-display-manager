# Tests fonctionnels manuels de préproduction

Pour chaque cas, consigner opérateur, rôle, champ isolé, heure, résultat RPC/UI, compteur d’audit avant/après et absence d’effet métier. Ne tester qu’après les vérificateurs conformes.

- Général : Administrateur autorisé; non-administrateur et anonyme refusés; champ protégé refusé; répétition identique `no_change`; une modification produit exactement un audit.
- DisplayConfig : `saved`, répétition `no_change`, concurrence `stale_draft`, champ protégé intact.
- ValidationConfig : règles valides; `allowedValues`; `errorMessages`; version concurrente `stale_draft`; audit exact sans perte historique.
- PermissionConfig : stratégie deny-wins; rôle inconnu refusé; `no_change`; `stale_draft`; aucun droit, grant ou rôle réel modifié.
- TerrainConfig : champ critique protégé; visibilité, lecture seule et section conservées; aucun comportement Terrain réel.
- ImportExportConfig : alias sûr; formule refusée; disponibilité déclarative; aucun import/export réel.
- RelationConfig : relation physique détectée; relation historique préservée; aucune modification de `relation_rules`.
- CalculationConfig : expression stockée comme déclaration; cycle refusé/détecté; aucune expression exécutée.
- C1 : types `relation` et `calculation` acceptés lors des tests A9; valeur inconnue refusée; compte et contenu des anciennes lignes inchangés.
- Non-consommation : grilles, formulaires, fiches 360, Terrain, import/export inchangés; aucune activation.

Transversal : tester `saved`, `no_change`, `stale_draft`, concurrence de deux administrateurs, `null`, `false`, `0`, tableaux vides, navigation clavier, zoom 200 %, contraste, écran étroit et lecteurs d’écran disponibles. Tout effet métier, perte de ligne, droit inattendu ou erreur non contrôlée donne NO-GO.
