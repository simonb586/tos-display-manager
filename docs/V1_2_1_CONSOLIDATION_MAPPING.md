# V1.2.1 — consolidation des surfaces métier

Les anciens intitulés sont des entrées de navigation vers des composants React (`CampaignsPanel`, `CampaignVisualManager`) et, pour les données historiques du manifeste, des grilles/fallback JSON. Les surfaces « par site et supports » sont des projections React (`SiteSupportAssignmentsView`) servies par `siteSupportBusinessService`; elles ne sont ni des tables ni des vues SQL nouvelles.

Source de vérité : `campagnes_maitres` (campagne/communication et `business_context`), `campagnes_supports` (affectation, statut, EDT, installation, photo), `infrastructures` (site, support, infrastructure, format), les visuels, `support_photos`, EDT, enjeux et historique existants. Aucun enregistrement n'est recopié.

| Ancienne colonne métier | Colonne consolidée | Source réelle |
|---|---|---|
| campagne / communication | Campagne / communication | `campagnes_maitres.nom_campagne` via `campagnes_supports.campagne_id` |
| site | Site | `infrastructures.site` via `support_id` |
| support | Support | `campagnes_supports.support_id` |
| infrastructure | Infrastructure | `infrastructures.emplacement_visibilite` |
| client | Client | `campagnes_maitres.client` |
| visuel | Visuel | `campagnes_supports.visuel_attendu` |
| format | Format | `infrastructures.format_affichage` |
| statut | Statut | `campagnes_supports.statut` |
| EDT | EDT | `campagnes_supports.no_edt` |
| installation | Installation | `campagnes_supports.date_completion` |
| dates | Date début / Date fin | `campagnes_maitres.date_debut/date_fin` |
| photo | Photo | `campagnes_supports.photo_url` / `support_photos` |
| dernière activité | Dernière activité | `campagnes_supports.updated_at` |

La séparation est exclusivement `business_context = marketing` ou `operational_communication`. La clé logique est site + support + campagne/communication + visuel. Les anciens composants restent dans le code pour préserver l'édition, mais ne sont plus des destinations concurrentes dans la navigation. Aucun SQL n'est requis.
