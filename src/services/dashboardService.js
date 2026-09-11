import {supabase, supabaseConfigured} from '../lib/supabaseClient';
import {normalizeClientPortalViewKey, resolveClientPortalViews} from '../lib/clientPortalViewRegistry';

export const DASHBOARD_TIMEOUT_MS = 4500;

export function validateDashboardSummary(data) {
  if (data?.version !== 1 || !data.identity?.user_id || !data.identity?.role ||
      !Array.isArray(data.permission?.visible_tables) || !data.kpis || !data.sections) {
    throw new Error('Résumé du tableau de bord incomplet. Réessayez.');
  }
  for (const value of [...Object.values(data.kpis), ...Object.values(data.sections).map(section => section?.total)]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Un indicateur est indisponible. Réessayez.');
  }
  const visible = data.permission.visible_tables;
  if (['Client', 'Client-Admin'].includes(data.identity.role)) {
    if (!data.identity.client_id || resolveClientPortalViews(visible).views
      .filter(view => !['requests', 'members'].includes(view.id))
      .some(view => !Number.isSafeInteger(data.sections[view.section]?.total))) {
      throw new Error('Résumé client incomplet. Réessayez.');
    }
  }
  {
    const groups = [
      [['Infrastructures'], ['infrastructures_total', 'infrastructures_active', 'missing_photos']],
      [['Campagnes maîtres', 'Campagnes et visuels', 'Campagnes'], ['marketing_total', 'marketing_active', 'marketing_soon', 'marketing_places', 'marketing_visuals']],
      [['Communications opérationnelles'], ['operational_total', 'operational_active', 'operational_soon', 'operational_places', 'operational_visuals']],
      [['Suivi des EDT'], ['edt_active', 'edt_late']],
      [['Photos', 'Photos et inventaire'], ['photos']],
      [['Clients'], ['clients']],
      [['Bons de travail'], ['work_orders', 'urgent_work_orders']],
      [['Enjeux des cadres et supports'], ['issues_open']],
      [['Diagnostic terrain', 'Application terrain'], ['terrain', 'terrain_errors']],
      [['Rapports', 'Rapports EDT', 'Rapports finaux'], ['reports', 'reports_completed', 'reports_sent', 'reports_to_send', 'reports_errors']]
    ];
    const keys = visible.map(normalizeClientPortalViewKey);
    if (groups.some(([aliases, required]) => (visible.includes('*') || aliases.some(alias => keys.includes(normalizeClientPortalViewKey(alias)))) && required.some(key => !Object.hasOwn(data.kpis, key)))) {
      throw new Error('Un indicateur manque dans le résumé. Réessayez.');
    }
  }
  return data;
}

export async function loadDashboardSummary({signal} = {}) {
  if (!supabaseConfigured || !supabase) throw new Error('Tableau de bord indisponible. Réessayez.');
  const {data, error} = await supabase.rpc('portal_dashboard_summary').abortSignal(signal);
  if (error) throw new Error('Impossible de charger les indicateurs. Réessayez.');
  return validateDashboardSummary(data);
}
