# TOS Display Manager — Bloc 6 Bons de travail V1

## Fonctions ajoutées

- Création d’un bon de travail
- Modification
- Suppression par administrateur
- Assignation à un installateur
- Priorité
- Statut
- Date cible
- Recherche et filtres
- Démarrage et terminaison rapide
- Tableau de bord des bons

## Installation

1. Dézippe le pack.
2. Copie `src`, `supabase` et ce README à la racine du projet.
3. Accepte fusion/remplacement.
4. Dans Supabase SQL Editor, exécute `supabase/bloc6_bons_travail.sql`.
5. Dans VS Code :

```powershell
npm run build
npm run dev
```

6. Ouvre **Bons de travail** dans le menu.

## Rôles

- Administrateur et Coordonnateur : création et modification.
- Installateur : consultation, démarrage et terminaison.
