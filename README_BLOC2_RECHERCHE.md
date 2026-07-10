# TOS Display Manager — Bloc 2 Recherche

## Objectif

Ajouter une recherche simple connectée à Supabase :

- Infrastructure
- Arrêt
- EDT

## Installation

1. Copie les fichiers du dossier `src` dans ton projet.
2. Ajoute l'import CSS dans ton application si nécessaire :

```js
import './features/search/bloc2-search.css';
```

3. Ajoute le composant où tu veux afficher la recherche :

```jsx
import Bloc2SearchPanel from './components/Bloc2SearchPanel';

<Bloc2SearchPanel />
```

## Test

Dans VS Code :

```powershell
npm run build
npm run dev
```

## Option Supabase

Si la recherche devient lente, exécute :

```sql
supabase/bloc2_search_indexes.sql
```

dans Supabase SQL Editor.

## Note CTO

Ce bloc est livré de façon additive : il n'écrase pas ton application principale.
