import React, { useEffect, useState } from 'react';
import { RefreshCw, SearchCheck } from 'lucide-react';
import GridPagination from './GridPagination';
import {
  formatTerrainSyncDate,
  listTerrainDiagnostics,
  loadTerrainDiagnosticSummary,
  resolveTerrainDiagnostic,
  retryTerrainDiagnostic
} from '../services/terrainDiagnosticsService';

const failed = value => ['échec', 'echec', 'échouée', 'error', 'erreur', 'failed']
  .includes(String(value || '').toLocaleLowerCase('fr-CA'));

export default function TerrainSyncDiagnostics({ role }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ pending: 0, errors: 0, successToday: 0, lastSync: null });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [view, setView] = useState('history');
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState('');
  const [latestHidden, setLatestHidden] = useState(false);
  const canView = ['Administrateur', 'Coordonnateur'].includes(role);

  async function reload() {
    try {
      const [list, stats] = await Promise.all([
        listTerrainDiagnostics({ page, pageSize, view }),
        loadTerrainDiagnosticSummary()
      ]);
      setRows(list.rows);
      setTotal(list.total);
      setSummary(stats);
      setLatestHidden(list.latestHiddenByFilters);
      setMessage('');
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    if (canView) reload();
  }, [canView, page, pageSize, view]);

  if (!canView) return <div className="v07-card">Accès réservé.</div>;

  async function retry(row) {
    try {
      await retryTerrainDiagnostic(row.diagnostic_id);
      setMessage('Nouvelle tentative enregistrée.');
      await reload();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function resolve(row) {
    const reason = window.prompt('Résolution appliquée :');
    if (!reason) return;
    try {
      await resolveTerrainDiagnostic(row.diagnostic_id, reason);
      setMessage('Erreur marquée comme résolue, historique conservé.');
      await reload();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return <div className="operations-page terrain-sync-history">
    <header className="operations-hero"><div><h1><SearchCheck/> Synchronisation Terrain</h1><p>Historique complet des diagnostics centralisés.</p></div><button onClick={reload}><RefreshCw/> Actualiser</button></header>
    {message && <div className="v07-message">{message}</div>}
    <section className="terrain-sync-summary"><article><span>En attente</span><strong>{summary.pending}</strong></article><article><span>Erreurs actives</span><strong>{summary.errors}</strong></article><article><span>Réussies aujourd’hui</span><strong>{summary.successToday}</strong></article><article><span>Dernière synchronisation</span><strong>{formatTerrainSyncDate(summary.lastSync)}</strong></article></section>
    <nav className="advanced-categories"><button className={view === 'history' ? 'active' : ''} onClick={() => { setPage(1); setView('history'); }}>Historique</button><button className={view === 'errors' ? 'active' : ''} onClick={() => { setPage(1); setView('errors'); }}>Erreurs actives</button></nav>
    {latestHidden && <div className="v07-message" role="status">Des filtres actifs masquent la synchronisation la plus récente.</div>}
    <div className="tableWrap"><table><thead><tr><th>Date</th><th>Utilisateur</th><th>Appareil</th><th>Opération</th><th>Support</th><th>Campagne</th><th>EDT</th><th>Statut</th><th>Tentative</th><th>Résolution</th><th>Actions</th></tr></thead><tbody>{rows.map(row => <tr key={`${row.source}:${row.id}`}><td>{formatTerrainSyncDate(row.occurred_at)}</td><td>{row.actor || '—'}</td><td>{row.device_id || '—'}</td><td>{row.operation || '—'}</td><td>{row.support || '—'}</td><td>{row.campaign || '—'}</td><td>{row.edt || '—'}</td><td>{row.status}</td><td>{row.attempt}</td><td>{row.resolved_at ? `${formatTerrainSyncDate(row.resolved_at)} — ${row.resolution || 'résolue'}` : '—'}</td><td><button onClick={() => setSelected(row)}>Détails</button>{failed(row.status) && row.diagnostic_id && <><button onClick={() => retry(row)}>Réessayer</button><button onClick={() => resolve(row)}>Marquer résolue</button></>}</td></tr>)}</tbody></table></div>
    <GridPagination page={page} pageCount={Math.max(1, Math.ceil(total / pageSize))} pageSize={pageSize} total={total} onPage={setPage} onPageSize={value => { setPage(1); setPageSize(value); }}/>
    {selected && <section className="v07-card"><button onClick={() => setSelected(null)}>Fermer</button><h2>Détails</h2><pre>{JSON.stringify(selected, null, 2)}</pre></section>}
  </div>;
}
