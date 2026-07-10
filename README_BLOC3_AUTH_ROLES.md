# TOS Display Manager — Bloc 3 Authentification et rôles

## Contenu

- `src/services/authService.js`
- `src/components/Bloc3LoginPanel.jsx`
- `src/features/auth/bloc3-auth.css`
- `supabase/bloc3_auth_roles.sql`

## Installation

1. Copier les dossiers `src` et `supabase` à la racine du projet.
2. Accepter fusion/remplacement.
3. Dans Supabase SQL Editor, exécuter :

```sql
supabase/bloc3_auth_roles.sql
```

4. Dans VS Code :

```powershell
npm run build
npm run dev
```

## Intégration visuelle

Le composant à brancher dans la page Connexion est :

```jsx
import Bloc3LoginPanel from './components/Bloc3LoginPanel';
import './features/auth/bloc3-auth.css';

<Bloc3LoginPanel />
```

## Note

Ce bloc prépare l'authentification. L'association finale entre utilisateurs Auth et lignes `utilisateurs` se fait via `auth_user_id`.
