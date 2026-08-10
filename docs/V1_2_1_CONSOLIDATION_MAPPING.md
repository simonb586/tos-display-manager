# V1.2.1 — clonage intégral des surfaces historiques

## Sources réelles inventoriées

Les entrées historiques du manifeste chargent, via `dataService.loadTable`, les tables physiques PostgreSQL `public.campagnes_et_visuels` et `public.communications_operationnelles`. En développement uniquement, si `VITE_ALLOW_JSON_FALLBACK=true`, elles utilisent les JSON homonymes (162 et 58 lignes dans le dépôt). Le schéma local ne permet pas de mesurer le nombre de lignes de la base distante : le vérificateur SQL en lecture seule le fera.

`campagnes_et_visuels` possède 12 colonnes SQL dans cet ordre : `id bigint PK`, `nom_campagne text`, `visuel_terrain text`, `date_debut text`, `date_fin text`, `statut_campagne text`, `support_id text`, `emplacement text`, `date_mise_a_jour text`, `raw_data jsonb not null default '{}'`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`.

`communications_operationnelles` possède 16 colonnes SQL : `id bigint PK`, `emplacement text`, `message text`, `date_debut text`, `date_fin text`, `statut text`, `no_arret text`, `site_ou_arret text`, `support_id text`, `no_edt text`, `related_voiture text`, `visuel_message text`, `visuel_terrain text`, `raw_data jsonb not null default '{}'`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`.

Les JSON conservent dans `raw_data` les colonnes Airtable originales, notamment `Date Created`, `Date Modified`, `Record ID#`, `Record Owner` et `Last Modified By`. Elles ne sont donc pas perdues.

## Mapping campagnes

| Ancienne colonne | Nouvelle colonne | Source | Transformation | Conservée |
|---|---|---|---|---|
| `id` | `id`, `legacy_id` | table historique | copie identique | OUI |
| `nom_campagne` | `nom_campagne` | table historique | aucune | OUI |
| `visuel_terrain` | `visuel_terrain` | table historique | aucune | OUI |
| `date_debut` | `date_debut` | table historique | aucune | OUI |
| `date_fin` | `date_fin` | table historique | aucune | OUI |
| `statut_campagne` | `statut_campagne` | table historique | aucune | OUI |
| `support_id` | `support_id` | table historique | aucune | OUI |
| `emplacement` | `emplacement` | table historique | aucune | OUI |
| `date_mise_a_jour` | `date_mise_a_jour` | table historique | aucune | OUI |
| `raw_data` | `raw_data` | table historique | JSON identique | OUI |
| `created_at` | `created_at` | table historique | aucune | OUI |
| `updated_at` | `updated_at` | table historique | aucune | OUI |
| — | `site_id`, `site`, `infrastructure_id` | `infrastructures.support_id` | première correspondance stable par `id`; NULL si inconnue | ajout |
| — | `campaign_id` | `campagnes_maitres.nom_campagne` | correspondance normalisée Marketing; NULL si ambiguë/inconnue | ajout |
| — | `visual_id` | `campagne_visuels_formats` | campagne + nom visuel; NULL si inconnu | ajout |
| — | `business_context` | constante | `marketing` | ajout |
| — | `source_table`, `historical_fingerprint` | provenance | nom source + MD5 déterministe des 12 colonnes | ajout |

## Mapping communications opérationnelles

Les 16 colonnes (`id`, `emplacement`, `message`, `date_debut`, `date_fin`, `statut`, `no_arret`, `site_ou_arret`, `support_id`, `no_edt`, `related_voiture`, `visuel_message`, `visuel_terrain`, `raw_data`, `created_at`, `updated_at`) sont copiées sans transformation et sont toutes **CONSERVÉES OUI**. `id` est aussi copié dans `legacy_id`.

Les enrichissements sont `site_id`, `site`, `infrastructure_id` via `support_id`; `campaign_id` via le nom du message et le contexte; `visual_id` via le visuel; `business_context='operational_communication'`; et les métadonnées `source_table`, `historical_fingerprint`. Une relation indéterminable reste NULL : elle ne provoque ni suppression ni duplication de la ligne historique.

## Comportements et consommateurs

La destination React `SiteSupportAssignmentsView` conserve recherche globale, filtres historiques et nouveaux filtres site/support/infrastructure, pagination, sélection, export CSV de la page ou sélection, configuration d’affichage des colonnes et actions Modifier/Ouvrir, Visuel, Support/Fiche 360, EDT, Photos et Historique. Le service canonique lit désormais exclusivement les deux nouvelles tables. Module 14 consomme ce service. Module 17 reste protégé par son RPC `client_portal_list_v120`; sa bascule SQL interne vers les nouvelles tables devra être faite dans une migration dédiée après validation du contrat RLS/organisation/client_published/client_visible/accès explicite sur la base cible.

Les deux entrées historiques ne figurent plus dans la navigation finale; leurs composants et tables restent présents pour rollback. Rollback applicatif : remettre le service/navigation sur `campagnes_et_visuels` et `communications_operationnelles`. Aucun `DROP`, aucune suppression de données et aucune exécution SQL ne font partie de cette livraison.
