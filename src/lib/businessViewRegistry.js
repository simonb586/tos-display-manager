import {INTERNAL_VIEW_REASONS} from './internalViewPolicy.js';
import {resolveClientPortalView} from './clientPortalViewRegistry.js';

// Every current Admin route has a declared client contract. A declaration is not a permission.
// Unknown or internal views never fall back to an unscoped Admin loader in the Client portal.
export const BUSINESS_VIEW_REGISTRY = Object.freeze([
  {
    "route": "Tableau de bord",
    "adminComponents": [
      "Module14Dashboard",
      "Dashboard"
    ],
    "clientViewId": null,
    "clientPolicy": "not_implemented",
    "columnContract": null
  },
  {
    "route": "Exports",
    "adminComponents": [
      "ExportsCenter"
    ],
    "clientViewId": null,
    "clientPolicy": "not_implemented",
    "columnContract": null
  },
  {
    "route": "Centre de commandement",
    "adminComponents": [
      "OperationalCommandCenter"
    ],
    "clientViewId": null,
    "clientPolicy": "not_implemented",
    "columnContract": null
  },
  {
    "route": "Gestionnaire des champs",
    "adminComponents": [
      "FieldCatalogManager"
    ],
    "clientViewId": null,
    "clientPolicy": "not_implemented",
    "columnContract": null
  },
  {
    "route": "Administration",
    "adminComponents": [
      "AdminPanel"
    ],
    "clientViewId": null,
    "clientPolicy": "not_implemented",
    "columnContract": null
  },
  {
    "route": "Utilisateurs réels",
    "adminComponents": [
      "UserProvisioningPanel"
    ],
    "clientViewId": null,
    "clientPolicy": "not_implemented",
    "columnContract": null
  },
  {
    "route": "Visibilité par rôle",
    "adminComponents": [
      "RoleVisibilityAdmin"
    ],
    "clientViewId": null,
    "clientPolicy": "not_implemented",
    "columnContract": null
  },
  {
    "route": "Édition — Historique",
    "adminComponents": [
      "ChangeHistoryPanel"
    ],
    "clientViewId": null,
    "clientPolicy": "not_implemented",
    "columnContract": null
  },
  {
    "route": "Photos et inventaire",
    "adminComponents": [
      "PhotoInventoryCenter"
    ],
    "clientViewId": null,
    "clientPolicy": "not_implemented",
    "columnContract": null
  },
  {
    "route": "Centre EDT et BT",
    "adminComponents": [
      "OperationsCenter"
    ],
    "clientViewId": null,
    "clientPolicy": "not_implemented",
    "columnContract": null
  },
  {
    "route": "Rapports EDT",
    "adminComponents": [
      "Module15Reports"
    ],
    "clientViewId": "reports",
    "clientPolicy": "scoped_projection",
    "columnContract": null
  },
  {
    "route": "Automatisations",
    "adminComponents": [
      "AutomationAssistant"
    ],
    "clientViewId": null,
    "clientPolicy": "not_implemented",
    "columnContract": null
  },
  {
    "route": "Campagnes maîtres",
    "adminComponents": [
      "CampaignsPanel"
    ],
    "clientViewId": "campaigns",
    "clientPolicy": "scoped_projection",
    "columnContract": null
  },
  {
    "route": "Campagne — Visuels et formats",
    "adminComponents": [
      "CampaignVisualManager"
    ],
    "clientViewId": null,
    "clientPolicy": "not_implemented",
    "columnContract": null
  },
  {
    "route": "Campagnes et visuels par site et supports",
    "adminComponents": [
      "SiteSupportAssignmentsView"
    ],
    "clientViewId": null,
    "clientPolicy": "not_implemented",
    "columnContract": null
  },
  {
    "route": "Communications opérationnelles",
    "adminComponents": [
      "CampaignsPanel"
    ],
    "clientViewId": "communications",
    "clientPolicy": "scoped_projection",
    "columnContract": null
  },
  {
    "route": "Communication opérationnelle — Visuels",
    "adminComponents": [
      "CampaignVisualManager"
    ],
    "clientViewId": null,
    "clientPolicy": "not_implemented",
    "columnContract": null
  },
  {
    "route": "Communications opérationnelles par site et supports",
    "adminComponents": [
      "SiteSupportAssignmentsView"
    ],
    "clientViewId": null,
    "clientPolicy": "not_implemented",
    "columnContract": null
  },
  {
    "route": "Carte interactive",
    "adminComponents": [
      "InteractiveMap"
    ],
    "clientViewId": null,
    "clientPolicy": "not_implemented",
    "columnContract": null
  },
  {
    "route": "Application terrain",
    "adminComponents": [
      "TerrainApp"
    ],
    "clientViewId": null,
    "clientPolicy": "not_implemented",
    "columnContract": null
  },
  {
    "route": "Recherche terrain",
    "adminComponents": [
      "FieldSearch"
    ],
    "clientViewId": null,
    "clientPolicy": "not_implemented",
    "columnContract": null
  },
  {
    "route": "Infrastructures",
    "adminComponents": [
      "TableView"
    ],
    "clientViewId": "infrastructures",
    "clientPolicy": "scoped_projection",
    "columnContract": "businessColumns:Infrastructures"
  },
  {
    "route": "Répertoire des affiches",
    "adminComponents": [
      "TableView"
    ],
    "clientViewId": "poster_directory",
    "clientPolicy": "scoped_projection",
    "columnContract": "businessColumns:Répertoire des affiches"
  },
  {
    "route": "Enjeux des cadres et supports",
    "adminComponents": [
      "TableView"
    ],
    "clientViewId": "issues",
    "clientPolicy": "scoped_projection",
    "columnContract": "businessColumns:Enjeux des cadres et supports"
  },
  {
    "route": "Centres d’information",
    "adminComponents": [
      "TableView"
    ],
    "clientViewId": "information_centers",
    "clientPolicy": "scoped_projection",
    "columnContract": "businessColumns:Centres d’information"
  },
  {
    "route": "C.I. avec enjeux",
    "adminComponents": [
      "TableView"
    ],
    "clientViewId": "information_centers_issues",
    "clientPolicy": "scoped_projection",
    "columnContract": "businessColumns:C.I. avec enjeux"
  },
  {
    "route": "Liste des arrêts",
    "adminComponents": [
      "TableView"
    ],
    "clientViewId": "stops",
    "clientPolicy": "scoped_projection",
    "columnContract": "businessColumns:Liste des arrêts"
  },
  {
    "route": "Voitures / trains",
    "adminComponents": [
      "TableView"
    ],
    "clientViewId": "vehicles_trains",
    "clientPolicy": "scoped_projection",
    "columnContract": "businessColumns:Voitures / trains"
  },
  {
    "route": "Photos",
    "adminComponents": [
      "TableView"
    ],
    "clientViewId": "photos",
    "clientPolicy": "scoped_projection",
    "columnContract": "businessColumns:Photos"
  },
  {
    "route": "Bons de travail",
    "adminComponents": [
      "WorkOrdersPanel"
    ],
    "clientViewId": "requests",
    "clientPolicy": "scoped_projection",
    "columnContract": null
  },
  {
    "route": "Historique des campagnes",
    "adminComponents": [
      "TableView"
    ],
    "clientViewId": "history",
    "clientPolicy": "scoped_projection",
    "columnContract": "businessColumns:Historique des campagnes"
  },
  {
    "route": "Suivi des EDT",
    "adminComponents": [
      "OperationsCenter"
    ],
    "clientViewId": "edt",
    "clientPolicy": "scoped_projection",
    "columnContract": null
  },
  {
    "route": "Utilisateurs",
    "adminComponents": [
      "TableView"
    ],
    "clientViewId": null,
    "clientPolicy": "internal_only",
    "columnContract": "businessColumns:Utilisateurs"
  },
  {
    "route": "Clients",
    "adminComponents": [
      "ClientsAccessAdmin"
    ],
    "clientViewId": "members",
    "clientPolicy": "scoped_projection",
    "columnContract": null
  },
  {
    "route": "Journal des événements",
    "adminComponents": [
      "ActivityJournal"
    ],
    "clientViewId": null,
    "clientPolicy": "internal_only",
    "columnContract": null
  }
].map(view => Object.freeze(INTERNAL_VIEW_REASONS[view.route]?{...view,clientPolicy:'internal_only',clientReason:INTERNAL_VIEW_REASONS[view.route]}:view)));
const byRoute = new Map(BUSINESS_VIEW_REGISTRY.map(view => [view.route,view]));
export function resolveBusinessView(route) { return byRoute.get(route) || null; }
export function knownBusinessRoute(route) {
  if (!byRoute.has(route)) throw new Error('Missing business view contract: '+route);
  return route;
}
export function clientBusinessContract(route) {
  const definition=resolveBusinessView(route);
  return definition?.clientViewId ? resolveClientPortalView(definition.clientViewId) : null;
}
