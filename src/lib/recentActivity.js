export const RECENT_ACTIVITY_LIMIT = 10;
export const ACTIVITY_TIMEZONE = 'America/Toronto';

const TECHNICAL_ACTIVITY = /(initialisation|initialization|démarrage système|demarrage systeme|migration|chargement supabase|diagnostic technique|log développeur|log developpeur)/i;

export function isRecentBusinessActivity(event = {}) {
  const searchable = [event.action, event.module, event.entity_type, event.source_system].filter(Boolean).join(' ');
  return Boolean(event.occurred_at && event.action && !TECHNICAL_ACTIVITY.test(searchable));
}

export function prepareRecentBusinessActivity(events = []) {
  return events.filter(isRecentBusinessActivity).sort((left, right) => String(right.occurred_at).localeCompare(String(left.occurred_at)) || String(right.id || '').localeCompare(String(left.id || ''))).slice(0, RECENT_ACTIVITY_LIMIT);
}

export function formatActivityDate(value) {
  if (!value) return 'Date inconnue';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date invalide';
  return new Intl.DateTimeFormat('fr-CA', { timeZone: ACTIVITY_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

export function activityObjectLabel(event = {}) {
  if (event.support_id) return `Support ${event.support_id}`;
  if (event.campaign_id) return `Campagne ${event.campaign_id}`;
  if (event.edt_id) return `EDT ${event.edt_id}`;
  if (event.entity_type && event.entity_id) return `${event.entity_type} ${event.entity_id}`;
  return event.entity_type || '';
}

export function recentActivityTarget(event = {}, role = '') {
  const module = `${event.module || ''} ${event.entity_type || ''} ${event.action || ''}`.toLocaleLowerCase('fr-CA');
  if (/(terrain|synchronisation)/.test(module)) return ['Administrateur', 'Coordonnateur'].includes(role) ? 'Diagnostic terrain' : null;
  if (/rapport/.test(module)) return ['Administrateur', 'Coordonnateur'].includes(role) ? 'Rapports finaux' : null;
  if (/(campagne|visuel)/.test(module)) return 'Campagnes maîtres';
  if (/edt/.test(module)) return 'Suivi des EDT';
  if (/(photo|infrastructure|support)/.test(module)) return 'Infrastructures';
  if (/enjeu/.test(module)) return 'Enjeux des cadres et supports';
  if (/(bon de travail|travaux)/.test(module)) return 'Bons de travail';
  return null;
}
