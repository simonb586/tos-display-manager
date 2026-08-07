import { supabase, supabaseConfigured } from '../lib/supabaseClient.js';
import {
  formatTerrainSyncDate,
  normalizeTerrainStatus,
  normalizeTerrainSyncEvent,
  TERRAIN_FAILURE_STATUSES,
  TERRAIN_PENDING_STATUSES,
  TERRAIN_SUCCESS_STATUSES
} from '../lib/terrainSyncTimeline.js';
export { formatTerrainSyncDate } from '../lib/terrainSyncTimeline.js';
const ready = () => {
  if (!supabaseConfigured || !supabase) throw new Error('Diagnostics Terrain indisponibles.');
};

function timelineQuery({ status = '', view = 'history' } = {}) {
  let query = supabase.from('terrain_sync_history_v113').select('*', { count: 'exact' });
  if (status) query = query.eq('statut', status);
  if (view === 'errors') query = query.in('statut', ['Échec', 'Echec', 'Échouée', 'error', 'erreur', 'failed']);
  return query.order('created_at', { ascending: false }).order('source_record_id', { ascending: false });
}

export async function getTerrainSyncTimeline({ page = 1, pageSize = 50, status = '', view = 'history' } = {}) {
  ready();
  const size = [1, 25, 50, 100, 200, 1000].includes(Number(pageSize)) ? Number(pageSize) : 50;
  const from = (Math.max(1, Number(page) || 1) - 1) * size;
  const { data, error, count } = await timelineQuery({ status, view }).range(from, from + size - 1);
  if (error) throw error;
  return { timeline: (data || []).map(normalizeTerrainSyncEvent), total: count || 0 };
}

export async function listTerrainDiagnostics({ page = 1, pageSize = 50, status = '', view = 'history' } = {}) {
  const filtered = await getTerrainSyncTimeline({ page, pageSize, status, view });
  const filtersActive = Boolean(status || view !== 'history');
  const global = filtersActive ? await getTerrainSyncTimeline({ page: 1, pageSize: 1 }) : filtered;
  const globalLatest = global.timeline[0] || null;
  return {
    rows: filtered.timeline,
    total: filtered.total,
    globalLatest,
    filtersActive,
    latestHiddenByFilters: Boolean(filtersActive && globalLatest && filtered.timeline[0]?.id !== globalLatest.id)
  };
}

export async function loadTerrainDiagnosticSummary() {
  ready();
  const rows = [];
  for (let page = 1; page <= 100; page += 1) {
    const result = await getTerrainSyncTimeline({ page, pageSize: 1000 });
    rows.push(...result.timeline);
    if (rows.length >= result.total || result.timeline.length < 1000) break;
  }
  const latestByOperation = [...new Map(rows.map(row => [row.operation_id || `${row.source}:${row.id}`, row])).values()];
  const TorontoDay = formatTerrainSyncDate(new Date(), { year: 'numeric', month: '2-digit', day: '2-digit', hour: undefined, minute: undefined });
  return {
    pending: latestByOperation.filter(row => TERRAIN_PENDING_STATUSES.includes(normalizeTerrainStatus(row.status))).length,
    errors: latestByOperation.filter(row => TERRAIN_FAILURE_STATUSES.includes(normalizeTerrainStatus(row.status))).length,
    successToday: rows.filter(row => TERRAIN_SUCCESS_STATUSES.includes(normalizeTerrainStatus(row.status)) && formatTerrainSyncDate(row.occurred_at, { year: 'numeric', month: '2-digit', day: '2-digit', hour: undefined, minute: undefined }) === TorontoDay).length,
    lastSync: rows[0]?.occurred_at || null,
    total: rows.length
  };
}

export async function resolveTerrainDiagnostic(id, resolution) {
  ready();
  const { data, error } = await supabase.rpc('resolve_terrain_sync_v113', { p_id: id, p_resolution: resolution });
  if (error) throw error;
  return data;
}

export async function retryTerrainDiagnostic(id) {
  ready();
  const { data, error } = await supabase.rpc('request_terrain_sync_retry_v113', { p_id: id });
  if (error) throw error;
  return data;
}
