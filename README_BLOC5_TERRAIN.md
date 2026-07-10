# TOS Display Manager — Bloc 5 Terrain V1

## Fonctions ajoutées

- Recherche d’une infrastructure ou d’un arrêt
- Fiche terrain
- Inspection avec cases à cocher
- Commentaires
- Capture/joindre une photo
- GPS avec précision
- Enregistrement dans Supabase
- File d’attente locale hors ligne
- Synchronisation manuelle au retour du réseau

## Installation

1. Dézippe le pack.
2. Copie `src`, `supabase` et ce README à la racine du projet.
3. Accepte fusion/remplacement.
4. Dans Supabase SQL Editor, exécute `supabase/bloc5_terrain.sql`.
5. Dans VS Code :

```powershell
npm run build
npm run dev
```

6. Ouvre **Application terrain** dans le menu.

## Important

La file hors ligne sauvegarde les données texte. Une photo prise sans connexion n’est pas encore conservée hors ligne; une note est ajoutée lors de la synchronisation. La conservation complète des fichiers hors ligne sera ajoutée dans une version ultérieure.
