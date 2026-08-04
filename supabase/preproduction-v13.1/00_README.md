# Paquet manuel de préproduction — Bloc 13.1

Paquet local non exécuté. Il prépare la validation technique A1 à A9 et C1 dans SQL Editor, après autorisation explicite. Il ne contient ni identifiant d’environnement, ni URL, ni donnée d’accès.

Avant toute exécution future, `06_GO_NO_GO_CHECKLIST.md` exige : référence et URL de préproduction consignées hors du paquet, confirmation écrite « Cet environnement n’est pas la production. », méthode d’accès autorisée et point de restauration exploitable. Si un élément manque : **NO-GO**.

Lire `02_MIGRATION_ORDER.md`, exécuter le précontrôle, puis une migration et son vérificateur à la fois. C1 vient obligatoirement après A8 et avant A9. Sa contrainte est créée `NOT VALID`; les nouvelles écritures sont contrôlées, tandis que les anciennes lignes doivent être inspectées. `07_VALIDATE_C1_CONSTRAINT.sql` est séparé et interdit sans autorisation distincte.

Terminer par le postcontrôle et les tests manuels, puis arrêter. A10 n’a aucune migration. Aucun déploiement, consommateur métier ou mécanisme d’activation ne fait partie de ce paquet.
