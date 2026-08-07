import { formatTerrainSyncDate, getTerrainSyncTimeline } from './terrainDiagnosticsService.js';

export async function loadTerrainSyncStatus() {
  try {
    const { timeline } = await getTerrainSyncTimeline({ page: 1, pageSize: 1 });
    return timeline[0]
      ? `Dernière synchro : ${formatTerrainSyncDate(timeline[0].occurred_at)}`
      : 'Aucune synchronisation enregistrée';
  } catch {
    return 'État global non centralisé';
  }
}
