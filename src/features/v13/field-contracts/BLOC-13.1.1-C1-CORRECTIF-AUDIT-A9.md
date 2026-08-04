# Bloc 13.1.1-C1 — Correctif audit A9

1. **Défaut** : le CHECK A8 de `relation_field_config_audit.configuration_type` s’arrête à `import_export`.
2. **Cause** : A9 a ajouté les audits `relation` et `calculation` sans migration additive de la liste autorisée.
3. **Impact** : toute sauvegarde A9 avec audit échouerait et serait annulée transactionnellement.
4. **Fichiers** : une migration C1, un vérificateur en lecture seule, un test statique et cette documentation.
5. **Valeurs conservées** : `general`, `display`, `validation`, `permission`, `terrain`, `import_export`.
6. **Valeurs ajoutées** : `relation`, `calculation`.
7. **Gel** : A8, A9, leurs RPC, contrats, services et composants restent inchangés.
8. **Ordre** : appliquer et vérifier A8, puis C1 et son vérificateur, puis A9 et son vérificateur.
9. **Résultat attendu** : contrainte `relation_field_config_audit_type_v01311c1_check` présente avec la liste fermée des huit types.
10. **Rollback théorique** : dans une nouvelle transaction contrôlée, remplacer C1 par la définition A8 uniquement si aucune ligne A9 n’existe; ne jamais supprimer les audits A9.
11. **Risques** : contrainte `NOT VALID` à valider séparément après inspection des lignes existantes; dépendance au nom exact A8; SQL non testé sur PostgreSQL réel.
12. **Préproduction** : après application et vérification manuelles de C1, le bloc devient prêt sous conditions jusqu’aux autres validations du paquet.
