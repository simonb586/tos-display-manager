import { Building2, CalendarClock, Camera, FileText, History, Image, Info, MapPin, ShieldCheck, Train, Users } from 'lucide-react';

export const CLIENT_PORTAL_ROLES = Object.freeze(['Client', 'Client-Admin']);

const strip = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[’‘`]/g, "'")
  .replace(/&/g, ' et ')
  .replace(/[^a-zA-Z0-9]+/g, ' ')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '_');

export const normalizeClientPortalViewKey = value => strip(value);

const view = definition => Object.freeze({
  clientPortalSupported: true,
  aliases: [],
  ...definition,
  key: definition.key || definition.id,
  component: definition.component || 'ClientPortalDataTable'
});

// Registre technique uniquement : les permissions viennent exclusivement de role_ui_permissions.
export const CLIENT_PORTAL_VIEW_REGISTRY = Object.freeze([
  view({ id: 'infrastructures', label: 'Infrastructures', icon: Building2, section: 'supports', dataSource: 'client_portal_list_v120:supports', permissionKeys: ['Infrastructures'], aliases: ['infrastructures'] }),
  view({ id: 'poster_directory', label: 'Répertoire des affiches', icon: Image, section: 'poster_directory', dataSource: 'admin_preview/client_portal_list_v1361:poster_directory', permissionKeys: ['Repertoire des affiches', 'Répertoire des affiches'], aliases: ['repertoire_des_affiches'] }),
  view({ id: 'information_centers', label: "Centres d'information", icon: Info, section: 'information_centers', dataSource: 'admin_preview/client_portal_list_v1361:information_centers', permissionKeys: ["Centres d'information", 'Centres d’information'], aliases: ['centres_dinformation', 'centres_d_information'] }),
  view({ id: 'information_centers_issues', label: 'C.I. avec enjeux', icon: ShieldCheck, section: 'information_centers_issues', dataSource: 'admin_preview/client_portal_list_v1361:information_centers_issues', permissionKeys: ['C.I. avec enjeux', 'CI avec enjeux'], aliases: ['c_i_avec_enjeux', 'ci_avec_enjeux'] }),
  view({ id: 'stops', label: 'Liste des arrêts', icon: MapPin, section: 'stops', dataSource: 'admin_preview/client_portal_list_v1361:stops', permissionKeys: ['Liste des arrets', 'Liste des arrêts'], aliases: ['liste_des_arrets'] }),
  view({ id: 'vehicles_trains', label: 'Voitures / trains', icon: Train, section: 'vehicles_trains', dataSource: 'admin_preview/client_portal_list_v1361:vehicles_trains', permissionKeys: ['Voitures / trains', 'Voitures et trains'], aliases: ['voitures_trains'] }),
  view({ id: 'requests', label: 'Nouvelle requête', icon: FileText, section: 'requests', component: 'ClientRequestForm', dataSource: 'client_portal_list_v120:supports', permissionKeys: ['Requetes clients', 'Requêtes clients', 'Bons de travail'], aliases: ['bons_de_travail'] }),
  view({ id: 'campaigns', label: 'Campagnes', icon: Image, section: 'campaigns', dataSource: 'client_portal_list_v120:campaigns', permissionKeys: ['Campagnes', 'Campagnes et visuels', 'Campagnes maitres', 'Campagnes maîtres'] }),
  view({ id: 'reports', label: 'Rapports', icon: FileText, section: 'reports', dataSource: 'module15_client_edt_reports_v130', permissionKeys: ['Rapports', 'Rapports finaux', 'Rapports EDT'] }),
  view({ id: 'communications', label: 'Communications opérationnelles', icon: ShieldCheck, section: 'communications', dataSource: 'client_portal_list_v120:communications', permissionKeys: ['Communications operationnelles', 'Communications opérationnelles'] }),
  view({ id: 'photos', label: 'Photos', icon: Camera, section: 'photos', component: 'PhotoGallery', dataSource: 'client_portal_list_v120:photos', permissionKeys: ['Photos'] }),
  view({ id: 'edt', label: 'EDT / Progression', icon: CalendarClock, section: 'edt', dataSource: 'client_portal_list_v120:edt', permissionKeys: ['Suivi des EDT'] }),
  view({ id: 'issues', label: 'Enjeux', icon: ShieldCheck, section: 'issues', dataSource: 'client_portal_list_v120:issues', permissionKeys: ['Enjeux des cadres et supports'] }),
  view({ id: 'history', label: 'Historique', icon: History, section: 'history', dataSource: 'client_portal_list_v120:history', permissionKeys: ['Historique des campagnes'] }),
  view({ id: 'members', label: 'Mon organisation', icon: Users, section: 'members', dataSource: 'client_portal_list_v120:members', permissionKeys: ['Clients', 'Mon organisation'] })
]);

export const CLIENT_PORTAL_EXPLICITLY_BLOCKED = Object.freeze([
  { value: 'Utilisateurs', reason: 'Administration interne non disponible dans le portail Client.' },
  { value: 'Journal des evenements', reason: 'Journal interne reserve au personnel TOS.' },
  { value: 'Journal des événements', reason: 'Journal interne reserve au personnel TOS.' }
]);

const entries = CLIENT_PORTAL_VIEW_REGISTRY.flatMap(item => [
  item.id,
  item.key,
  item.label,
  ...(item.permissionKeys || []),
  ...(item.aliases || [])
].map(value => [normalizeClientPortalViewKey(value), item]));

const SUPPORTED_BY_NORMALIZED_KEY = new Map(entries);
const BLOCKED_KEYS = new Set(CLIENT_PORTAL_EXPLICITLY_BLOCKED.map(item => normalizeClientPortalViewKey(item.value)));

export const CLIENT_PORTAL_SUPPORTED_PERMISSION_VALUES = Object.freeze(
  [...new Set(CLIENT_PORTAL_VIEW_REGISTRY.flatMap(item => item.permissionKeys || [item.label]))]
);

export function resolveClientPortalView(value) {
  if (value === '*') return null;
  return SUPPORTED_BY_NORMALIZED_KEY.get(normalizeClientPortalViewKey(value)) || null;
}

export function isClientPortalViewSupported(value) {
  return Boolean(resolveClientPortalView(value));
}

export function isClientPortalViewExplicitlyBlocked(value) {
  return BLOCKED_KEYS.has(normalizeClientPortalViewKey(value));
}

export function resolveClientPortalViews(visibleTables = []) {
  const allowed = Array.isArray(visibleTables) ? visibleTables : [];
  const all = allowed.includes('*') ? CLIENT_PORTAL_VIEW_REGISTRY : allowed.map(resolveClientPortalView).filter(Boolean);
  const views = [...new Map(all.map(item => [item.id, item])).values()];
  const unknown = allowed.filter(value => value !== '*' && !resolveClientPortalView(value) && !isClientPortalViewExplicitlyBlocked(value));
  const blocked = allowed.filter(value => value !== '*' && isClientPortalViewExplicitlyBlocked(value));
  return { views, unknown, blocked };
}

export const isAllowedClientPortalView = (views, id) => views.some(item => item.id === id);
