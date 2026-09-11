# Parité du portail Client — validation finale

Travail du 10 septembre 2026 (Toronto), migrations enregistrées le 11 septembre UTC.

Les vues métier Client utilisent désormais les composants Admin : tableau et fiche 360 partagés, campagnes partagées, centre EDT partagé, carte et tableau de bord partagés. Les lignes sont lues sous RLS avec l’identité réelle du compte. Client-Admin dispose de la capacité UPDATE sur ses vues autorisées. Client peut consulter et soumettre des requêtes, comme Client-Admin.

Les données historiques sans propriétaire explicite ont été rattachées à **EXO, client 2**, conformément à la confirmation de l’utilisateur. Aucun propriétaire explicite n’a été remplacé ; les fixtures de certification Client B sont conservées. Aucun fichier Storage, photo, historique ou relation n’a été supprimé.

## Inventaire et périmètre

- ADMIN VIEWS : **35** routes inventoriées par le registre existant.
- CLIENT VIEWS : **4** vues métier autorisées, **7** entrées avec Sommaire, Exports et Carte interactive.
- CLIENT-ADMIN VIEWS : **13** vues métier autorisées, **16** entrées avec Sommaire, Exports et Carte interactive.
- « Voir en tant que » est une commande Admin supplémentaire, pas une catégorie métier.

Les valeurs ci-dessous sont celles de la validation SQL. Un écart de publication ou de propriétaire est une restriction existante, pas une source de données différente. N/A signifie que la configuration actuelle n’autorise pas cette vue pour Client.

Le [correctif de navigation Marylène](MARYLENE_NAVIGATION_FIX.md) complète cette validation après le signalement d’un tableau vidé par un clic répété, de la Carte absente du menu et d’une palette différente.

| Vue canonique | Admin : lignes | EXO : lignes | Client | Client-Admin | Édition CA |
|---|---:|---:|---|---|---|
| Infrastructures | 6 619 | 6 619 | PASS | PASS | PASS |
| Campagnes maîtres / Campagnes | 22 | 14 | PASS | PASS | PASS |
| Photos | 1 | 1 | PASS | PASS | PASS |
| Nouvelle requête | — | supports EXO | PASS | PASS | soumission autorisée |
| Historique des campagnes | 1 | 1 | N/A | PASS | PASS |
| Suivi des EDT / EDT et progression | 168 | 167 | N/A | PASS | PASS |
| Enjeux des cadres et supports | 104 historiques | 104 historiques | N/A | PASS | lecture, comme la vue Admin |
| Communications opérationnelles | 10 | 9 | N/A | PASS | PASS |
| Répertoire des affiches | 182 | 182 | N/A | PASS | PASS |
| Centres d’information | 89 | 89 | N/A | PASS | PASS |
| C.I. avec enjeux | 16 | 16 | N/A | PASS | PASS |
| Liste des arrêts | 4 309 | 4 309 | N/A | PASS | PASS |
| Voitures / trains | 224 | 224 | N/A | PASS | PASS |

La vue Enjeux utilise aussi la fusion canonique des enjeux terrain, comme Admin. « Photos » désigne ici la table métier historique ; le KPI photo et la fiche 360 conservent leur source canonique `support_photos`.

L’écart EDT correspond à une fixture Client B. Les campagnes EXO non publiées et la campagne de Client B ne sont pas exposées aux comptes EXO : les règles de publication existantes restent appliquées. Les tables internes de configuration, d’administration et d’automatisation ne sont pas ajoutées au portail Client.

## Permissions et aperçu

| Contrôle demandé | Résultat |
|---|---|
| CLIENT CONTENT PARITY | PASS, composants et colonnes canoniques |
| CLIENT READ ONLY | PASS, exception explicite : création de requêtes |
| CLIENT-ADMIN CONTENT PARITY | PASS |
| CLIENT-ADMIN EDIT | PASS, UPDATE métier sur les vues autorisées |
| MARYLÈNE EDIT EXO | PASS, profil 25 / client 2 |
| CROSS-CLIENT EDIT | REFUS |
| MAP Admin | PASS |
| MAP Coordonnateur | N/A, aucun compte actif de ce rôle |
| MAP Installateur | PASS |
| MAP Client | PASS |
| MAP Client-Admin | PASS |
| DASHBOARD CATEGORY PARITY | PASS, définition commune des catégories autorisées |
| EXTRA CLIENT DASHBOARD CATEGORIES | 0 |
| KPI PARITY | PASS, même définition et même résultat à périmètre identique |
| ADMIN PREVIEW | PASS sur le build réel : Client-Admin, Installateur, Admin et compte Client en attente |
| CLIENT B | PASS : aucune infrastructure EXO visible |
| CHANGES REQUIRED | OUI, corrections décrites dans ce rapport |

Les identifiants, propriétaires, relations de rattachement et indicateurs de publication restent protégés contre la réaffectation par Client-Admin, dans l’interface et par trigger serveur. La capacité UPDATE ne confère pas les commandes Admin de création, suppression, publication, administration des comptes ou orchestration du cycle de vie EDT.

Pour vérifier une personne : ouvrir **Voir en tant que** dans le menu Admin, choisir son compte actif, puis **Ouvrir sa vue réelle**. Le même shell applicatif est remonté avec son profil, ses permissions et son périmètre RLS. Le bandeau **Revenir à ma vue Admin** permet de sortir de l’aperçu. Les écritures y sont bloquées côté API ; les clés et la session Admin restent intactes. Les comptes en attente conservent leur écran d’activation.

## Preuves et limites des essais

- `npm run check` : suite complète et build ; le registre recense 35 vues Admin. Ce registre est une preuve d’inventaire, pas un essai fonctionnel de chaque commande interne.
- `npm run test:business-parity` : navigateur avec fixtures contrôlées ; colonnes identiques, grille et fiche, édition/enregistrement/rafraîchissement, double-clic, aller-retour carte avec page conservée, catégories et KPI, soumission des deux rôles.
- `scripts/sql/verify_business_parity.sql` : PostgreSQL local, scénarios propres et interclient, propriétaire protégé, Client en lecture seule, requêtes des deux rôles, usurpation d’aperçu et écritures d’aperçu refusées. Chaque scénario est annulé.
- PostgreSQL réel : modification temporaire d’un commentaire EXO avec le profil Marylène, UPDATE contrôlé sur onze vues, créations de requêtes par les profils 25 et 33, puis ROLLBACK. Aucun contenu de test métier n’est conservé.
- Enregistrement EDT : les deux paramètres de création de retrait sont exclus du payload UPDATE, car ils ne sont pas des colonnes persistantes. Régression du service réel PASS, et UPDATE de tous les champs persistants sous l’identité Marylène PASS dans une transaction annulée.
- [API réelle](live-api.json) : comparaison exacte identité/permissions/KPI/lignes entre session réelle et aperçu pour Client, Client-Admin, Client B et Installateur ; faux en-tête Admin et mutations refusés.
- [Navigateur contrôlé](browser.json) et [application locale avec backend réel](application-local.json).
- [Contrôles SQL réels](database-validation.json), [application de production](application-production.json) et [fichiers de la livraison](FILES.md).
- Le harnais SQL local `verify_business_parity_local.mjs` réutilise les snapshots de schéma de certification déjà présents dans cet espace et un runtime PGlite local. Ces prérequis ne font pas partie de l’installation courante de l’application. Le scénario SQL est livré séparément.
- Les harnais HTTP/navigateur distants utilisent `SUPABASE_ACCESS_TOKEN` ou l’adaptateur local déjà présent. Ils ouvrent des sessions de test sans envoyer de courriel, puis les ferment. `TDM_BROWSER_PATH` permet de préciser Chromium/Edge. Aucun jeton n’est enregistré dans les preuves.

Le test Client B a révélé un coût excessif des refus RLS. Les permissions indépendantes des lignes sont maintenant évaluées une fois, et le propriétaire est présélectionné sans enlever les contrôles RLS. Son sommaire SQL est passé d’environ 7,9 s à 0,7 s lors du contrôle final ; les essais HTTP passent sous le délai serveur de 8 s.

## Migrations et livraison

Ordre appliqué et vérifié avant le frontend :

1. `20260911024938_client_admin_business_parity.sql` : capacités UPDATE, EXO, sources partagées, aperçu protégé.
2. `20260911025750_portal_business_read_performance.sql` : calcul unique des permissions de lecture.
3. `20260911030201_portal_business_tenant_query_filter.sql` : présélection du propriétaire.
4. `20260911030456_client_request_owned_supports.sql` : requêtes sur les supports appartenant au client, sans campagne obligatoire.
5. `20260911030921_preview_target_activation_state.sql` : état d’activation exact de la cible.

Aucune variable d’environnement applicative nouvelle. Le hook PostgREST d’aperçu n’agit qu’en présence de l’en-tête validé et n’accepte que l’Admin actif comme initiateur.

Le contrôle Supabase conserve deux avertissements Auth préexistants : [durée OTP](https://supabase.com/docs/guides/platform/going-into-prod#security) et [protection contre les mots de passe compromis](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Le contrôle [SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) passe de 109 à 112 fonctions signalées : les deux prédicats RLS et la lecture Admin de l’unique indicateur d’activation sont intentionnels, avec recherche de l’identité active, permissions explicites et `search_path` fermé. Les essais d’accès refusé couvrent ces entrées. Aucun nouvel avertissement de table sans RLS n’a été signalé.

VERDICT : **PASS**.

Version applicative `a1bf0c9`, pr?c?d?e du commit de parit? `7fc1c8f`, pouss?e sur `release/v1.3.3` et d?ploy?e sur [le portail public](https://portail.groupetos.com). D?ploiement Vercel `dpl_4H36rE5c8BTC6gm8JRnC8DAMwAV6` confirm? Ready et associ? au domaine. La derni?re passe navigateur de production est PASS pour les profils Client, Client-Admin, Installateur et les aper?us Admin/Installateur/Client-Admin/Client en attente. Le retour ? Admin est PASS. [Preuve de livraison](deployment.json).
