# TOS Display Manager — MVP V0.6 Préproduction

Version destinée à être déposée dans GitHub puis déployée sur Vercel.

## Inclus dans cette V0.6

- Toutes les tables visibles dans le menu.
- Données QuickBase importées dans le projet pour consultation.
- Correction des accents et des problèmes d'encodage courants.
- Table Infrastructures enrichie : GPS, latitude, longitude, Prochain EDT ciblé, lien carte interactive.
- Recherche générale stricte : aucun résultat approximatif inutile.
- Filtres par colonne.
- Exports simples : table complète et résultats filtrés en CSV compatible Excel.
- Ébauche du rapport client illustré.
- Nouvelle table Suivi des EDT.
- Table Photos avec règle de nommage automatique.
- Application terrain PWA : recherche par Infrastructures ou Arrêts.
- Page de connexion et structure des rôles.

## Lancer localement

```powershell
npm install
npm run dev
```

## Déployer

Déposer le contenu de ce dossier dans GitHub. Vercel redéploiera automatiquement sur :

https://portail.groupetos.com

## Variables Supabase prévues dans Vercel

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

## Notes importantes

Cette version est une préproduction front-end avec données intégrées. Le branchement complet à Supabase, la création des comptes utilisateurs réels, l'écriture en base de données et les rapports PDF complets seront consolidés dans les incréments V0.6.x.
