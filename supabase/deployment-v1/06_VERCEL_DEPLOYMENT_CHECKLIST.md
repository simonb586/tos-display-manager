# Checklist de déploiement frontal Vercel

- [ ] Répertoire racine : `tos-display-manager-stable`.
- [ ] Installation : `npm install`.
- [ ] Build : `npm run build`.
- [ ] Sortie : `dist`.
- [ ] `VITE_SUPABASE_URL` configurée.
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` configurée, ou compatibilité `VITE_SUPABASE_ANON_KEY` confirmée.
- [ ] `PUBLIC_SITE_URL` configurée côté fonctions serveur; `APP_PUBLIC_URL` seulement si l’environnement cible l’utilise explicitement.
- [ ] Aucune adresse de boucle locale dans les valeurs publiques.
- [ ] Aucune donnée sensible dans le dépôt; seules les clés publiques prévues sont exposées au frontal.
- [ ] Invitations redirigées vers le domaine public approuvé.
- [ ] Fonctions serveur `invite-user`, `manage-user` et `send-final-report` présentes/configurées.
- [ ] `npm run check` et build reproductible réussis sur la révision exacte.
- [ ] Domaine public et HTTPS confirmés.
- [ ] Postcontrôle SQL conforme avant déploiement.
- [ ] Tests de fumée exécutés après déploiement.
- [ ] Déploiement Vercel précédent identifié pour retour instantané.

Ne jamais consigner ici les valeurs réelles des variables.
