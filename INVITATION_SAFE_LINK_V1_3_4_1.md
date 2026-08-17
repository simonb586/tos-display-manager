# Configuration manuelle — invitation V1.3.4.1

Le code applicatif ne peut pas modifier la configuration du projet Supabase hébergé. Après validation locale, appliquer les étapes suivantes.

## Template Supabase « Invite user »

Dans **Authentication → Email Templates → Invite user**, remplacer le lien fondé sur `{{ .ConfirmationURL }}` par un lien non consommant :

```html
<h2>Activez votre compte Groupe TOS</h2>
<p>Votre compte est prêt à être activé.</p>
<p>
  <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite">
    Activer mon compte
  </a>
</p>
<p>Si vous n’attendiez pas cette invitation, ignorez ce message.</p>
```

`invite-user` et le renvoi `manage-user` fournissent `CLIENT_PORTAL_URL/accept-invitation` dans `RedirectTo`. Ne pas utiliser `ConfirmationURL` pour ce bouton : cette URL vérifie le jeton dès son ouverture.

## URL et secret serveur

- Configurer `CLIENT_PORTAL_URL` avec l’origine HTTPS publique, sans chemin final.
- Conserver `PUBLIC_SITE_URL` et `APP_PUBLIC_URL` uniquement comme compatibilité transitoire.
- Ajouter `https://<domaine-production>/accept-invitation` à la liste **Redirect URLs** Supabase.
- Conserver `https://<domaine-production>/set-password` dans cette liste.
- Conserver `/update-password` pour la récupération de mot de passe.
- Désactiver le suivi/réécriture des liens chez le fournisseur d’email s’il est actif.

## Déploiement après validation

Les sources officielles de `invite-user` et `manage-user` ont changé : redéployer ces deux Edge Functions après approbation. Aucun SQL n’est requis.

## Expiration

Aucune valeur d’expiration OTP/invitation n’est versionnée dans ce dépôt. Vérifier manuellement la valeur dans les paramètres Authentication du Dashboard Supabase; ne pas la modifier sans diagnostic distinct.
