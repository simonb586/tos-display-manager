export const TERRAIN_SYNC_TIMEZONE = 'America/Toronto';
export const TERRAIN_SYNC_CANONICAL_FIELD = 'occurred_at';
export const TERRAIN_FAILURE_STATUSES = ['échec', 'echec', 'échouée', 'error', 'erreur', 'failed'];
export const TERRAIN_PENDING_STATUSES = ['pending', 'en attente', 'en cours', 'syncing'];
export const TERRAIN_SUCCESS_STATUSES = ['réussi', 'reussi', 'réussie', 'success'];
export const normalizeTerrainStatus = value => String(value || '').toLocaleLowerCase('fr-CA');

export function normalizeTerrainSyncEvent(row = {}) {
  const id = String(row.source_record_id || row.id || row.diagnostic_id || '');
  const occurredAt = row.occurred_at || row.created_at || null;
  return {
    ...row,
    id,
    source: row.source || row.source_system || 'terrain',
    operation_id: row.operation_id || (row.source_system === 'terrain_operations' ? id : row.reference) || null,
    diagnostic_id: row.diagnostic_id || null,
    status: row.status || row.statut || null,
    attempt: Number(row.attempt) || 1,
    occurred_at: occurredAt,
    created_at: row.created_at || occurredAt,
    resolved_at: row.resolved_at || null,
    actor: row.actor || row.utilisateur || null,
    support: row.support || row.support_id || null,
    campaign: row.campaign || row.campagne_id || null,
    edt: row.edt || row.edt_id || null,
    error: row.error || null
  };
}

export function compareTerrainSyncEvents(left, right) {
  const byTime = String(right.occurred_at || '').localeCompare(String(left.occurred_at || ''));
  return byTime || String(right.id || '').localeCompare(String(left.id || ''));
}

export function buildTerrainSyncTimeline(rows = [], { status = '', view = 'history', page = 1, pageSize = null } = {}) {
  let timeline = rows.map(normalizeTerrainSyncEvent).filter(row => row.occurred_at).sort(compareTerrainSyncEvents);
  if (status) timeline = timeline.filter(row => row.status === status);
  if (view === 'errors') timeline = timeline.filter(row => TERRAIN_FAILURE_STATUSES.includes(normalizeTerrainStatus(row.status)));
  const total = timeline.length;
  if (pageSize != null) {
    const size = Math.max(1, Number(pageSize) || 50);
    const from = (Math.max(1, Number(page) || 1) - 1) * size;
    timeline = timeline.slice(from, from + size);
  }
  return { timeline, total };
}

export function formatTerrainSyncDate(value, options = {}) {
  if (!value) return 'Aucune';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date invalide';
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: TERRAIN_SYNC_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    ...options
  }).format(date);
}
