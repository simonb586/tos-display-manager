# TOS Display Manager — Blocs 1, 2 et 3

## Contenu

- Bloc 1 : Supabase + importateur robuste + fallback JSON.
- Bloc 2 : recherche terrain Infrastructure / Arrêt.
- Bloc 3 : page connexion + rôles + blocage de l'application terrain aux clients.

## Installation simple

1. Copier tout le contenu de ce dossier dans le dépôt local `tos-display-manager`.
2. Conserver ton fichier `.env` existant.
3. Vérifier que `.env` contient :

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

4. Dans VS Code :

```powershell
npm install
npm run build
```

5. Pour importer les données dans Supabase :

```powershell
npm run import:bloc1
```

6. Tester localement :

```powershell
npm run dev
```

7. Si tout est correct : Commit + Push dans GitHub Desktop.

## Important

- Ne jamais committer `.env`.
- L'importateur efface et réimporte les tables du Bloc 1 pour repartir proprement.
- Les données restent disponibles en fallback JSON si Supabase n'est pas disponible.
