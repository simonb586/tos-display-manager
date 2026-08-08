# Module 17 — contrat de sécurité client

## Identifiants et relations réutilisés

- Organisation cliente : `clients.id`.
- Profil : `utilisateurs.auth_user_id -> auth.users.id` et `utilisateurs.client_id -> clients.id`.
- Site : valeur métier `infrastructures.site` (aucune nouvelle entité Site).
- Support : `infrastructures.support_id`.
- Support vers campagne : `campagnes_supports.support_id` et `campagnes_supports.campagne_id`.
- Support vers visuel : `campagnes_supports.visuel_attendu`, complété par `campagne_visuels_formats`.
- Support vers EDT : `campagnes_supports.no_edt` et `edt_supports.support_id`.
- Clé logique des deux projections : `site + support_id + campagne_id + visual_id/visuel_attendu`.

`campagnes_maitres.business_context` demeure l’unique classification Marketing / Communication opérationnelle. Aucun test de nom, y compris « Exo Info », n’est utilisé dans le portail.

## Isolation

Le navigateur ne transmet jamais d’organisation. Les fonctions `client_*_v120` retrouvent le profil actif à partir de `auth.uid()`, puis appliquent `utilisateurs.client_id`. Un Client voit seulement les campagnes publiées inscrites dans `client_campaign_access`; un Client-Admin voit le périmètre publié de sa propre organisation. Les sélections RPC énumèrent les colonnes client-safe et excluent instructions internes, notes, diagnostics, erreurs, coûts, snapshots privés et métadonnées techniques.

## Matrice

| Fonction | Client | Client-Admin |
|---|---:|---:|
| Campagnes attribuées, communications, supports, photos, rapports, EDT, enjeux visibles et historique sûr | Oui | Oui |
| Toute l’organisation publiée | Selon accès | Oui |
| Membres de l’organisation | Non | Oui |
| Inviter ou désactiver un Client | Non | Oui |
| Gérer l’accès campagne d’un Client | Non | Oui |
| Créer/modifier un rôle interne, données internes ou autre organisation | Non | Non |
| Module 14, Studio, Gestionnaire des champs, A10 | Non | Non |

Les invitations préparées ne touchent pas directement `auth.users`. Leur traitement doit être relié ultérieurement au mécanisme serveur d’invitation existant après application et validation de la migration.
