export const RECENT_ACTIVITY_LIMIT = 10;
export const ACTIVITY_TIMEZONE = 'America/Toronto';

const TECHNICAL_ACTIVITY = /(initialisation|initialization|démarrage système|demarrage systeme|migration|chargement supabase|diagnostic technique|log développeur|log developpeur)/i;

const ACTION_LABELS = {
  insert: 'Création', suppression: 'Suppression', delete: 'Suppression', update: 'Modification',
  photo_ajoutee: 'Photo ajoutée', inspection: 'Inspection', inspection_completed: 'Inspection terminée',
  sync_success: 'Synchronisation Terrain réussie', sync_error: 'Erreur de synchronisation Terrain',
  sync_retry: 'Nouvelle tentative de synchronisation', campaign_created: 'Campagne créée',
  campaign_updated: 'Campagne modifiée', campaign_archived: 'Campagne archivée', visual_created: 'Visuel créé',
  visual_updated: 'Visuel modifié', edt_created: 'EDT créé', installation_started: 'Installation démarrée',
  installation_closed: 'Installation terminée', removal_started: 'Retrait démarré', removal_closed: 'Retrait terminé',
  report_generated: 'Rapport généré', report_sent: 'Rapport envoyé', issue_created: 'Enjeu créé',
  user_created: 'Utilisateur créé', role_changed: 'Rôle modifié'
};

const ENTITY_LABELS = {
  client: 'Client', clients: 'Client', infrastructure: 'Infrastructure', infrastructures: 'Infrastructure',
  support: 'Infrastructure', photo: 'Photo', photos: 'Photo', inspection: 'Inspection', inspections: 'Inspection',
  campaign: 'Campagne', campagne: 'Campagne', campaigns: 'Campagne', campagnes: 'Campagne', visual: 'Visuel', visuel: 'Visuel',
  edt: 'EDT', issue: 'Enjeu', enjeu: 'Enjeu', user: 'Utilisateur', utilisateur: 'Utilisateur', report: 'Rapport', rapport: 'Rapport'
};

const DESTINATIONS = {
  terrain: 'Diagnostic terrain', photo: 'Photos', inspection: 'Infrastructures', issue: 'Enjeux des cadres et supports',
  edt: 'Suivi des EDT', campaign: 'Campagnes maîtres', visual: 'Campagne — Visuels et formats',
  infrastructure: 'Infrastructures', user: 'Utilisateurs réels', report: 'Rapports finaux', fields: 'Gestionnaire des champs'
};

const TABLE_FOR_DESTINATION = {
  Photos: 'Photos', Infrastructures: 'Infrastructures', 'Enjeux des cadres et supports': 'Enjeux des cadres et supports',
  'Suivi des EDT': 'Suivi des EDT', 'Campagnes maîtres': 'Campagnes et visuels', 'Campagne — Visuels et formats': 'Campagnes et visuels'
};

function normalized(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function fields(event, names) {
  return normalized(names.map(name => event[name]).filter(Boolean).join(' '));
}

export function isRecentBusinessActivity(event = {}) {
  const searchable = [event.action, event.module, event.entity_type, event.source_system].filter(Boolean).join(' ');
  return Boolean(event.occurred_at && event.action && !TECHNICAL_ACTIVITY.test(searchable));
}

export function prepareRecentBusinessActivity(events = []) {
  return events.filter(isRecentBusinessActivity).sort((left, right) => String(right.occurred_at).localeCompare(String(left.occurred_at)) || String(right.id || '').localeCompare(String(left.id || ''))).slice(0, RECENT_ACTIVITY_LIMIT);
}

export function formatActivityLabel(event = {}) {
  const action = normalized(event.action).replace(/[\s-]+/g, '_');
  if (['insert', 'update', 'suppression', 'delete'].includes(action)) {
    const entity = ENTITY_LABELS[normalized(event.entity_type)];
    const verb = action === 'insert' ? 'créé' : action === 'update' ? 'modifié' : 'supprimé';
    if (entity) return `${entity} ${verb}`;
  }
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  const safe = String(event.action || '').replace(/_/g, ' ').trim();
  return safe ? safe.charAt(0).toLocaleUpperCase('fr-CA') + safe.slice(1) : 'Activité';
}

function zonedDayKey(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ACTIVITY_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function formatActivityDate(value, now = new Date()) {
  if (!value) return 'Date inconnue';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date invalide';
  const time = new Intl.DateTimeFormat('fr-CA', { timeZone: ACTIVITY_TIMEZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date).replace(' h ', ':');
  const todayKey = zonedDayKey(now);
  const yesterdayKey = zonedDayKey(new Date(now.getTime() - 86400000));
  const eventKey = zonedDayKey(date);
  if (eventKey === todayKey) return `Aujourd’hui ${time}`;
  if (eventKey === yesterdayKey) return `Hier ${time}`;
  const sameYear = new Intl.DateTimeFormat('en', { timeZone: ACTIVITY_TIMEZONE, year: 'numeric' }).format(date) === new Intl.DateTimeFormat('en', { timeZone: ACTIVITY_TIMEZONE, year: 'numeric' }).format(now);
  const day = new Intl.DateTimeFormat('fr-CA', { timeZone: ACTIVITY_TIMEZONE, day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) }).format(date).replace(/\.$/, '');
  return `${day} ${time}`;
}

export function activityObjectLabel(event = {}) {
  if (event.support_id) return `Support ${event.support_id}`;
  if (event.campaign_id) return `Campagne ${event.campaign_id}`;
  if (event.edt_id) return `EDT ${event.edt_id}`;
  const entity = ENTITY_LABELS[normalized(event.entity_type)] || String(event.entity_type || '').replace(/_/g, ' ');
  if (entity && event.entity_id) return `${entity} ${event.entity_id}`;
  return entity || '';
}

export function resolveActivityDestination(event = {}) {
  // La provenance métier explicite prime toujours sur les identifiants secondaires.
  const explicit = fields(event, ['module', 'source_system', 'source']);
  const action = fields(event, ['action']);
  const entity = fields(event, ['entity_type']);
  if (/(terrain_sync_diagnostics|terrain_operations|terrain|synchronisation|\bsync\b)/.test(explicit) || /(^| )(sync_success|sync_error|sync_retry|retry|resolved)( |$)/.test(action.replace(/_/g, ' '))) return DESTINATIONS.terrain;
  if (/photo/.test(explicit) || /photo/.test(action)) return DESTINATIONS.photo;
  if (/inspection/.test(explicit) || /inspection/.test(action)) return DESTINATIONS.inspection;
  if (/(enjeu|issue)/.test(explicit) || /(enjeu|issue)/.test(action)) return DESTINATIONS.issue;
  if (/(edt|installation|retrait|removal)/.test(explicit) || /(edt|installation|retrait|removal)/.test(action)) return DESTINATIONS.edt;
  if (/(campagne|campaign)/.test(explicit) || /(campagne|campaign)/.test(action)) return DESTINATIONS.campaign;
  if (/(visuel|visual)/.test(explicit) || /(visuel|visual)/.test(action)) return DESTINATIONS.visual;
  if (/(infrastructure)/.test(explicit) || /(infrastructure)/.test(action)) return DESTINATIONS.infrastructure;
  if (/(utilisateur|user)/.test(explicit) || /(utilisateur|user|role_changed)/.test(action)) return DESTINATIONS.user;
  if (/(rapport|report)/.test(explicit) || /(rapport|report)/.test(action)) return DESTINATIONS.report;
  if (/(gestionnaire des champs|field_catalog|field manager)/.test(explicit) || /(field_catalog)/.test(action)) return DESTINATIONS.fields;
  if (/(photo|inspection|enjeu|issue|edt|campagne|campaign|visuel|visual|infrastructure|support|utilisateur|user|rapport|report)/.test(entity)) {
    return resolveActivityDestination({ module: entity });
  }
  return null;
}

export function canAccessActivityDestination(destination, role = '', permission) {
  if (!destination) return false;
  if (destination === DESTINATIONS.terrain || destination === DESTINATIONS.report) return ['Administrateur', 'Coordonnateur'].includes(role);
  if (destination === DESTINATIONS.user || destination === DESTINATIONS.fields) return role === 'Administrateur';
  const requiredTable = TABLE_FOR_DESTINATION[destination];
  if (!requiredTable) return false;
  const tables = permission?.visible_tables;
  if (Array.isArray(tables)) return tables.includes('*') || tables.includes(requiredTable);
  // Compatibilité pendant le chargement des permissions : politique de rôles existante.
  const defaults = {
    Administrateur: ['*'], Coordonnateur: ['Photos', 'Infrastructures', 'Enjeux des cadres et supports', 'Suivi des EDT', 'Campagnes et visuels'],
    Installateur: ['Photos', 'Infrastructures', 'Enjeux des cadres et supports'], 'Client-Admin': ['Photos', 'Infrastructures', 'Suivi des EDT', 'Campagnes et visuels'],
    Client: ['Photos', 'Infrastructures', 'Campagnes et visuels']
  };
  const allowed = defaults[role] || [];
  return allowed.includes('*') || allowed.includes(requiredTable);
}

export function recentActivityTarget(event = {}, role = '', permission) {
  const destination = resolveActivityDestination(event);
  return canAccessActivityDestination(destination, role, permission) ? destination : null;
}
