import { loadTable } from './dataService.js';

const text = value => String(value ?? '').trim();
const first = (...values) => values.map(text).find(Boolean) || '';

export function normalizeHistoricalIssue(row) {
  const supportId = first(row.related_support, row.no_cadre, row['Related Support'], row['#Du cadre']);
  const sourceId = first(row.id, row['Record ID#']);
  return {
    ...row,
    id: `historique:${sourceId}`,
    source_id: sourceId,
    source: 'Historique',
    identifiant: sourceId,
    support_id: supportId,
    no_cadre: first(row.no_cadre, row['#Du cadre'], supportId),
    emplacement: first(row.emplacement, row.Emplacement),
    type_enjeu: first(row.type_enjeu, row.type_enjeux, row["Type d'enjeux"]),
    description: first(row.description, row.enjeux, row.Enjeux),
    statut: first(row.statut, row.Statut),
    commentaire: first(row.commentaire, row.Commentaire),
    photo: first(row.photo, row.photo_url),
    date: first(row.date_inscription, row["Date d'inscription de l'enjeux"], row.created_at, row['Date Created']),
    client: first(row.client, row.client_id)
  };
}

export function normalizeTerrainIssue(row) {
  const sourceId = text(row.id);
  return {
    ...row,
    id: `terrain:${sourceId}`,
    source_id: sourceId,
    source: 'Terrain',
    identifiant: sourceId,
    support_id: text(row.support_id),
    no_cadre: text(row.support_id),
    emplacement: text(row.emplacement),
    type_enjeu: first(row.type_enjeu, row.type_enjeux),
    description: first(row.description, row.enjeux, row.type_enjeu),
    statut: text(row.statut),
    commentaire: first(row.commentaire, row.commentaires),
    photo: first(row.photo_url, row.photo_id),
    date: first(row.created_at, row.date_inscription),
    client: first(row.client, row.client_id)
  };
}

const businessKey = row => [
  row.support_id, row.emplacement, row.type_enjeu, row.description, row.statut,
  row.commentaire, row.photo, row.date, row.client
].map(value => text(value).toLocaleLowerCase('fr-CA')).join('\u001f');

export function mergeInternalIssues(historicalRows = [], terrainRows = []) {
  const merged = [];
  const seen = new Set();
  for (const row of [
    ...historicalRows.map(normalizeHistoricalIssue),
    ...terrainRows.map(normalizeTerrainIssue)
  ]) {
    const key = businessKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }
  return merged;
}

export async function loadInternalIssues({ force = false } = {}) {
  const [historical, terrain] = await Promise.all([
    loadTable('enjeux_des_cadres_et_supports', () => import('../data/enjeux_des_cadres_et_supports.json').then(module => module.default), { force }),
    loadTable('enjeux_terrain', [], { force })
  ]);
  return {
    rows: mergeInternalIssues(historical.rows, terrain.rows),
    source: `${historical.source}+${terrain.source}`,
    error: historical.error || terrain.error || null,
    complete: historical.complete && terrain.complete
  };
}
