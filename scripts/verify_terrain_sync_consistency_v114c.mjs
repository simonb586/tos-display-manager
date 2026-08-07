import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildTerrainSyncTimeline,
  formatTerrainSyncDate,
  normalizeTerrainSyncEvent,
  TERRAIN_SYNC_CANONICAL_FIELD,
  TERRAIN_SYNC_TIMEZONE
} from '../src/lib/terrainSyncTimeline.js';

let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks += 1; };
const event = (id, created_at, statut, extra = {}) => ({
  source_system: 'terrain_sync_diagnostics',
  source_record_id: id,
  diagnostic_id: id,
  reference: `sync-${id}`,
  created_at,
  statut,
  ...extra
});

const A = event('A', '2026-07-24T13:04:00Z', 'success');
const B = event('B', '2026-08-07T21:24:00Z', 'error', { resolved_at: '2026-08-07T21:30:00Z' });
let result = buildTerrainSyncTimeline([A, B]);
assert.equal(result.timeline[0].id, 'B'); checks += 1;
assert.equal(result.timeline[0].occurred_at, B.created_at); checks += 1;
assert.equal(result.timeline[0].resolved_at, B.resolved_at); checks += 1;
ok(formatTerrainSyncDate(result.timeline[0].occurred_at).includes('17 h 24'), 'Affichage Toronto 17:24 incorrect');
ok(!formatTerrainSyncDate(result.timeline[0].occurred_at).includes('17 h 30'), 'La résolution devient une synchronisation');

const D = event('D', '2026-08-07T21:40:00Z', 'success', { attempt: 2, last_attempt_at: '2026-08-07T21:40:00Z' });
result = buildTerrainSyncTimeline([A, B, D]);
assert.equal(result.timeline[0].id, 'D'); checks += 1;
assert.equal(result.timeline[0].attempt, 2); checks += 1;
assert.equal(result.timeline[1].id, 'B'); checks += 1;
assert.equal(result.total, 3); checks += 1;

const tied = buildTerrainSyncTimeline([event('1', D.created_at, 'success'), event('2', D.created_at, 'success')]);
assert.deepEqual(tied.timeline.map(row => row.id), ['2', '1']); checks += 1;
const paged = buildTerrainSyncTimeline([A, B, D], { page: 2, pageSize: 1 });
assert.equal(paged.timeline[0].id, 'B'); checks += 1;
assert.equal(paged.total, 3); checks += 1;
const filtered = buildTerrainSyncTimeline([A, B, D], { view: 'errors' });
assert.deepEqual(filtered.timeline.map(row => row.id), ['B']); checks += 1;

assert.equal(TERRAIN_SYNC_CANONICAL_FIELD, 'occurred_at'); checks += 1;
assert.equal(TERRAIN_SYNC_TIMEZONE, 'America/Toronto'); checks += 1;
ok(formatTerrainSyncDate('2026-07-15T16:00:00Z').includes('12 h 00'), 'Heure d’été incorrecte');
ok(formatTerrainSyncDate('2026-01-15T17:00:00Z').includes('12 h 00'), 'Heure d’hiver incorrecte');
ok(formatTerrainSyncDate('2026-08-08T03:30:00Z').startsWith('2026-08-07'), 'Changement de date Toronto incorrect');
ok(formatTerrainSyncDate('2026-08-07T04:00:00Z').includes('00 h 00'), 'Minuit Toronto incorrect');
ok(formatTerrainSyncDate('2026-03-08T06:59:00Z').includes('01 h 59'), 'Avant changement DST incorrect');
ok(formatTerrainSyncDate('2026-03-08T07:01:00Z').includes('03 h 01'), 'Après changement DST incorrect');

const normalized = normalizeTerrainSyncEvent({ ...B, utilisateur: 'agent', support_id: 'S1', campagne_id: 4, edt_id: 7 });
for (const field of ['id', 'source', 'operation_id', 'diagnostic_id', 'status', 'attempt', 'occurred_at', 'created_at', 'resolved_at', 'actor', 'support', 'campaign', 'edt', 'error']) {
  ok(Object.hasOwn(normalized, field), `Champ normalisé absent: ${field}`);
}

const service = fs.readFileSync('src/services/terrainDiagnosticsService.js', 'utf8');
const dashboard = fs.readFileSync('src/services/terrainSyncStatus.js', 'utf8');
const table = fs.readFileSync('src/components/TerrainSyncDiagnostics.jsx', 'utf8');
const main = fs.readFileSync('src/main.jsx', 'utf8');
ok(service.includes("from('terrain_sync_history_v113')"), 'Vue V1.1.3 non canonique');
ok(service.indexOf(".order('created_at'") < service.indexOf('.range('), 'Pagination appliquée avant le tri');
ok(service.includes(".order('source_record_id', { ascending: false })"), 'Tie-breaker stable absent');
ok(dashboard.includes('getTerrainSyncTimeline') && dashboard.includes('timeline[0]'), 'Dashboard hors service central');
ok(table.includes('listTerrainDiagnostics') && table.includes('formatTerrainSyncDate'), 'Table hors service central');
ok(table.includes('Des filtres actifs masquent la synchronisation la plus récente.'), 'Avertissement de filtres absent');
ok(!/new Date\([^)]*resolved_at[^)]*\).*lastSync/.test(service), 'resolved_at utilisé comme dernière synchronisation');
ok(!/\b(delete|truncate|drop)\b/i.test(service + dashboard + table), 'Suppression historique détectée');
ok(main.includes('loadTerrainSyncStatus().then(setTerrainSyncStatus)'), 'Chargement Dashboard absent');

console.log(`V1.1.4C cohérence Terrain : ${checks} contrôles réussis.`);
