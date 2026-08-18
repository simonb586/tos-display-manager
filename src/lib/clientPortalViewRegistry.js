import { Building2, CalendarClock, Camera, FileText, History, Image, ShieldCheck, Users } from 'lucide-react';

// Registre technique uniquement : les permissions viennent exclusivement de role_ui_permissions.
export const CLIENT_PORTAL_VIEW_REGISTRY = Object.freeze([
  { id: 'infrastructures', label: 'Infrastructures', icon: Building2, section: 'supports', permissionKeys: ['Infrastructures'] },
  { id: 'requests', label: 'Nouvelle requête', icon: FileText, section: 'requests', permissionKeys: ['Requêtes clients', 'Bons de travail'] },
  { id: 'campaigns', label: 'Campagnes', icon: Image, section: 'campaigns', permissionKeys: ['Campagnes', 'Campagnes et visuels', 'Campagnes maîtres'] },
  { id: 'reports', label: 'Rapports', icon: FileText, section: 'reports', permissionKeys: ['Rapports', 'Rapports finaux', 'Rapports EDT'] },
  { id: 'communications', label: 'Communications opérationnelles', icon: ShieldCheck, section: 'communications', permissionKeys: ['Communications opérationnelles'] },
  { id: 'photos', label: 'Photos', icon: Camera, section: 'photos', permissionKeys: ['Photos'] },
  { id: 'edt', label: 'EDT / Progression', icon: CalendarClock, section: 'edt', permissionKeys: ['Suivi des EDT', 'Bons de travail'] },
  { id: 'issues', label: 'Enjeux', icon: ShieldCheck, section: 'issues', permissionKeys: ['Enjeux des cadres et supports'] },
  { id: 'history', label: 'Historique', icon: History, section: 'history', permissionKeys: ['Historique des campagnes'] },
  { id: 'members', label: 'Mon organisation', icon: Users, section: 'members', permissionKeys: ['Clients', 'Mon organisation'] }
]);

export function resolveClientPortalViews(visibleTables = []) {
  const allowed = new Set(Array.isArray(visibleTables) ? visibleTables : []);
  const views = CLIENT_PORTAL_VIEW_REGISTRY.filter(view => allowed.has('*') || view.permissionKeys.some(key => allowed.has(key)));
  const implementedKeys = new Set(CLIENT_PORTAL_VIEW_REGISTRY.flatMap(view => view.permissionKeys));
  const unknown = [...allowed].filter(key => key !== '*' && !implementedKeys.has(key));
  return { views, unknown };
}

export const isAllowedClientPortalView = (views, id) => views.some(view => view.id === id);
