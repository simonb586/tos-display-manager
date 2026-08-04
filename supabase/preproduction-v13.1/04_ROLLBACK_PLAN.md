# Plan de sauvegarde et de rollback

## A. Avant toute migration

GO interdit sans sauvegarde Supabase exploitable, branche de base isolée ou projet jetable, export logique et snapshot des objets techniques (colonnes, contraintes, fonctions, propriétaires, droits, RLS, triggers et compteurs). L’opérateur doit tester la procédure de restauration et consigner son point de restauration. Aucune commande destructive générale n’est fournie par ce paquet.

## B. Matrice par migration

| Étape | Objets ajoutés/modifiés | Dépendances | Retour possible | Risque / données à comparer |
|---|---|---|---|---|
| A1 | colonnes catalogue, contraintes, fonctions de lecture/rafraîchissement | `relation_fields`, métadonnées `public` | migration corrective additive | le rafraîchissement peut écrire les métadonnées; comparer toutes les lignes |
| A3 | table d’audit, séquence, RPC général | A1, rôles applicatifs | suppression d’objets seulement si vides et autorisée | historique créé : restauration requise si des audits existent |
| A4 | colonnes d’audit, contrainte de type, RPC Display | A3 | correctif additif | comparer brouillons et audit |
| A5 | audit, contrainte JSON, normaliseur/RPC Validation | A4 | correctif additif | ne jamais écraser `validation_rules`; comparer historique |
| A6 | contrainte permissions, normaliseur/RPC | A5 | correctif additif | aucun droit réel ne doit changer; comparer JSON/audit |
| A7 | `terrain_config`, contraintes, normaliseur/RPC | A6 | correctif additif | aucun effet Terrain; préserver valeurs et audit |
| A8 | `import_export_config`, contraintes, normaliseur/RPC | A7 | correctif additif | aucun import/export réel; préserver valeurs et audit |
| C1 | remplace uniquement la contrainte d’audit A8 | A8 exact | restauration de l’ancienne contrainte seulement après analyse | échec risqué si nom/état divergent; aucune ligne ne doit changer |
| A9 | normaliseur et trois RPC Relations/Calculs | C1 | correctif additif | `relation_rules` demeure autoritaire; comparer relations/audit |

La suppression d’une colonne, table, fonction ou ligne n’est jamais un rollback par défaut. Si des écritures ont eu lieu, le retour peut être impossible sans restauration du point sauvegardé.

## C. Exécution partielle

- A1 réussi, A3 échoué : arrêter; conserver A1 si son vérificateur est conforme, sinon restaurer le point initial.
- A8 réussi, C1 échoué : arrêter avant A9; relever la contrainte réellement présente et préparer un correctif revu.
- C1 réussi, A9 échoué : arrêter; ne pas rétablir C1 automatiquement, car sa liste fermée reste compatible avec A1–A8.
- Migration réussie, vérificateur échoué : ne pas continuer; capturer les résultats et comparer aux snapshots.
- Audit bloqué : ne jamais contourner la contrainte; analyser types, droits et anciennes lignes.
- Permissions incorrectes : révoquer l’accès externe via une action ciblée approuvée ou restaurer; ne pas poursuivre.
- `stale_draft` incorrect : arrêter les tests concurrents, préserver les deux versions et analyser sans écriture corrective.
- Rollback d’audit échoué : geler toute écriture et restaurer le point contrôlé; ne jamais supprimer l’historique.
