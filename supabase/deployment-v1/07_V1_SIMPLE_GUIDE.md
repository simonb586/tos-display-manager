# Guide ultra simple V1.0

1. Ouvrir SQL Editor dans l’environnement formellement autorisé.
2. Exécuter `01_PRODUCTION_PRECHECK.sql`.
3. Si le verdict est `GO`, exécuter une seule fois `02_V1_REQUIRED_MIGRATIONS_EXECUTABLE.sql`; continuer uniquement si le résultat final est `V1_MIGRATIONS_COMPLETE`.
4. Exécuter `03_PRODUCTION_POSTCHECK.sql`.
5. Si le verdict est `GO POUR DÉPLOIEMENT FRONTAL`, préparer les variables selon `06_VERCEL_DEPLOYMENT_CHECKLIST.md`.
6. Déployer le frontal uniquement après autorisation explicite.
7. Exécuter `05_V1_SMOKE_TESTS.md`.
8. En cas d’erreur, arrêter et appliquer `04_V1_ROLLBACK_PLAN.md`.
