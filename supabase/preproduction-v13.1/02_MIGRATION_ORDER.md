# Ordre officiel contrôlé — Bloc 13.1

Chaque numéro est un point d’arrêt manuel. Une migration n’est ouverte dans SQL Editor qu’après résultat conforme du point précédent. Aucune étape n’est automatique.

1. Précontrôle global : `01_PRECHECK.sql`.
2. A1 — `V0_13_1_A_UNIVERSAL_FIELD_CATALOG.sql`.
3. Vérificateur A1 — `VERIFIER_V0_13_1_A_UNIVERSAL_FIELD_CATALOG.sql`.
4. Synchronisation initiale du catalogue, seulement si elle reçoit une autorisation écrite séparée; sinon omission.
5. A3 — `V0_13_1_A3_FIELD_GENERAL_DRAFT.sql`.
6. Vérificateur A3 — `VERIFIER_V0_13_1_A3_FIELD_GENERAL_DRAFT.sql`.
7. A4 — `V0_13_1_A4_2_DISPLAY_DRAFT.sql`.
8. Vérificateur A4 — `VERIFIER_V0_13_1_A4_2_DISPLAY_DRAFT.sql`.
9. A5 — `V0_13_1_A5_VALIDATION_DRAFT.sql`.
10. Vérificateur A5 — `VERIFIER_V0_13_1_A5_VALIDATION_DRAFT.sql`.
11. A6 — `V0_13_1_A6_PERMISSION_DRAFT.sql`.
12. Vérificateur A6 — `VERIFIER_V0_13_1_A6_PERMISSION_DRAFT.sql`.
13. A7 — `V0_13_1_A7_TERRAIN_DRAFT.sql`.
14. Vérificateur A7 — `VERIFIER_V0_13_1_A7_TERRAIN_DRAFT.sql`.
15. A8 — `V0_13_1_A8_IMPORT_EXPORT_DRAFT.sql`.
16. Vérificateur A8 — `VERIFIER_V0_13_1_A8_IMPORT_EXPORT_DRAFT.sql`.
17. C1 — `V0_13_1_1_C1_FIX_A9_AUDIT_TYPES.sql`.
18. Vérificateur C1 — `VERIFIER_V0_13_1_1_C1_FIX_A9_AUDIT_TYPES.sql`.
19. Inspection des lignes d’audit existantes avec la requête de `07_VALIDATE_C1_CONSTRAINT.sql`.
20. Validation séparée de la contrainte C1, uniquement après une nouvelle autorisation explicite.
21. A9 — `V0_13_1_A9_RELATIONS_CALCULATIONS_DRAFT.sql`.
22. Vérificateur A9 — `VERIFIER_V0_13_1_A9_RELATIONS_CALCULATIONS_DRAFT.sql`.
23. Postcontrôle global : `03_POSTCHECK.sql`.
24. Tests fonctionnels manuels : `05_MANUAL_TESTS.md`.
25. Arrêt avant toute activation.

C1 crée `relation_field_config_audit_type_v01311c1_check` en `NOT VALID`. PostgreSQL contrôle les nouvelles écritures, mais ne balaie pas automatiquement les anciennes lignes. La validation globale est volontairement séparée. A10 ne comporte aucune migration, ne consomme aucune configuration et ne doit déclencher aucune activation.
