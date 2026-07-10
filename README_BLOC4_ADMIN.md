# TOS Display Manager — Bloc 4 Administration

## Installation

1. Copie `src`, `supabase` et ce README à la racine de ton projet.
2. Accepte fusion/remplacement.
3. Dans Supabase SQL Editor, exécute `supabase/bloc4_admin.sql`.
4. Dans VS Code :

```powershell
npm run build
npm run dev
```

## Contenu

- Menu Administration
- Tableau de bord administratif
- Gestion des profils utilisateurs
- Rôles
- Activation / désactivation
- Association à un client
- Gestion des clients
- RLS de base

## Sécurité

Ce bloc gère les profils applicatifs. La création d’un vrai compte Supabase Auth et l’envoi du courriel d’invitation nécessitent une fonction serveur sécurisée. Cette automatisation viendra dans le Bloc 4.1.
