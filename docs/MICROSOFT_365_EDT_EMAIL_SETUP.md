# Envoi du rapport final EDT — configuration actuelle et historique Microsoft 365

Depuis le 10 septembre 2026, sur accord explicite, `send-edt-completion-email` utilise Resend avec `noreply@groupetos.com`, comme les invitations et `send-final-report`. La boîte Microsoft 365 `noreply` n'existe pas ; son envoi Graph a été refusé avant livraison. La configuration Graph ci-dessous est historique et ne doit plus être utilisée pour déployer ce worker.

Configuration serveur actuelle : `RESEND_API_KEY`, `CLIENT_PORTAL_URL` et les identifiants Supabase existants. Le secret `EDT_EMAIL_WORKER_SECRET` reste réservé au traitement serveur. L'appel utilisateur exige une identité canonique et un EDT autorisé explicitement désigné. Aucun secret n'est exposé au frontend.

L'envoi appelle `POST https://api.resend.com/emails` avec une clé d'idempotence propre à la demande et au rapport. Les retries réutilisent cette clé ; un renvoi explicite crée une demande distincte. Les PDF restent privés et le chemin est résolu depuis le rapport archivé. Voir [API d'envoi](https://resend.com/docs/api-reference/emails/send-email) et [idempotence Resend](https://resend.com/docs/dashboard/emails/idempotency-keys).

Le lien exige également un compte Client ou Client-Admin actif, la vue Rapports autorisée, une campagne publiée et accessible ainsi qu'un EDT et un rapport visibles. Sans ces conditions, le PDF est joint dans la limite de 2 500 000 octets. Le lien ouvre la vue Rapports seulement si elle est déjà autorisée ; son bouton de téléchargement utilise la session courante et les règles Storage.

## Configuration historique, remplacée

Cette préparation n’envoie aucun courriel tant que la migration, la fonction, les secrets et le traitement planifié ne sont pas validés et déployés manuellement.

## Architecture retenue

La transition transactionnelle `suivi_des_edt.statut: autre valeur → Complété` insère une seule ligne automatique dans `email_outbox`. La fonction serveur `send-edt-completion-email` relit l’EDT, son `requester_contact_id`, le client de la campagne et le plus récent rapport Module 15 de type `edt`, même `no_edt`, statut `generated` ou `published`. Elle utilise Microsoft Graph avec des identifiants d’application. Le navigateur ne choisit jamais le destinataire.

Le rapport provient exclusivement de `edt_reports`. S’il manque lors du traitement automatique, la fonction construit côté serveur un PDF EDT compact à partir des données disponibles, le stocke dans `final-reports`, puis crée sa version dans `edt_reports`. Un rapport prêt et visible au client est envoyé sous forme de lien vers `CLIENT_PORTAL_URL` seulement si le requérant possède un compte portail. Sinon, le même PDF privé indiqué par `edt_reports.storage_bucket` et `report_path` est joint s’il fait au plus 3 Mo. Sans moyen sécurisé exploitable, l’envoi échoue sans courriel vide. Après correction, un Administrateur ou Coordonnateur peut réessayer. La proposition générique `V1_3_0_MODULE_15_REPORT_LIFECYCLE.sql` n’a jamais été appliquée et est remplacée par `V1_3_0_MODULE_15_EDT_REPORTS_SIMPLIFIED.sql`.

## Configuration Entra ID / Microsoft Graph

1. Dans Microsoft Entra admin center, créer une inscription d’application dédiée à cet usage.
2. Copier le Tenant ID et l’Application (client) ID.
3. Créer un secret client et conserver sa valeur dans le gestionnaire de secrets Supabase seulement.
4. Ajouter Microsoft Graph, permission d’application `Mail.Send` uniquement.
5. Accorder le consentement administrateur.
6. Vérifier que la boîte `noreply@groupetos.com` existe et peut envoyer.
7. Restreindre l’application à cette boîte. Pour les tenants compatibles, utiliser Exchange Online App RBAC (`New-ManagementRoleAssignment` avec un périmètre de ressource). Si le tenant utilise encore Application Access Policies, créer un groupe limité à cette boîte, appliquer `New-ApplicationAccessPolicy`, puis vérifier avec `Test-ApplicationAccessPolicy`. Confirmer la méthode Microsoft actuellement supportée avant production.
8. Déployer la fonction, puis configurer un appel planifié authentifié par secret de worker. La fonction traite au plus 20 événements par appel.
9. Tester d’abord avec Graph simulé, dans un environnement non production. Aucun vrai requérant ne doit être utilisé.

## Secrets serveur requis

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MS_TENANT_ID`
- `MS_CLIENT_ID`
- `MS_CLIENT_SECRET`
- `EDT_EMAIL_WORKER_SECRET`
- `CLIENT_PORTAL_URL`

Ne jamais créer `VITE_MS_CLIENT_SECRET` ni versionner une valeur réelle. Le jeton OAuth2 obtenu sur `/{tenant}/oauth2/v2.0/token` avec le flux client credentials reste en mémoire. L’envoi vise exclusivement `POST /v1.0/users/noreply@groupetos.com/sendMail`.

## Exploitation

Les états sont `pending`, `sending`, `sent`, `failed`, avec cinq tentatives maximum et backoff progressif. Les erreurs métier attendent une correction et une relance manuelle. « Renvoyer le rapport » crée une ligne manuelle distincte; une nouvelle version ne provoque aucun renvoi automatique.

Avant activation : faire relire et exécuter manuellement `supabase/V1_3_1_EDT_COMPLETION_EMAIL_WORKFLOW.sql`, déployer la fonction, configurer Graph, puis valider les RLS, le périmètre de boîte et le planificateur. SQL exécuté : NON. A10 demeure inactive.
