# Guide manuel court

1. Ouvrir le projet Supabase formellement confirmé comme préproduction.
2. Ouvrir SQL Editor.
3. Exécuter `01_PRECHECK.sql`.
4. Arrêter si une anomalie apparaît.
5. Exécuter une seule migration à la fois selon `02_MIGRATION_ORDER.md`.
6. Exécuter immédiatement son vérificateur.
7. Copier le résultat dans Codex pour revue, sans secret.
8. Appliquer C1 après A8.
9. Ne pas valider la contrainte C1 sans autorisation distincte.
10. Appliquer A9 seulement ensuite.
11. Exécuter `03_POSTCHECK.sql`, puis les tests manuels.
12. Ne rien déployer.
13. Ne rien activer.
