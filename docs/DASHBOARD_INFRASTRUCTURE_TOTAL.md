# Total des infrastructures au tableau de bord

La carte de la vue générale affiche désormais Infrastructures et utilise infrastructures_total du résumé serveur existant. Elle compte toutes les infrastructures autorisées, actives et inactives (6 619 pour le périmètre Admin lors de la demande). Le portail client affichait déjà son total autorisé.

Aucune migration ni variable supplémentaire. La requête agrégée et le chargement P0 sont conservés. Le test existant distingue deux infrastructures au total d’une seule active. Validation : test navigateur ciblé, npm run check, puis vérification du total en production.

Fichiers modifiés :

- src/components/Module14Dashboard.jsx
- scripts/verify_dashboard_report_fixes.mjs
- docs/DASHBOARD_INFRASTRUCTURE_TOTAL.md
