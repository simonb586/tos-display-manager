import React, { useEffect, useState } from 'react';
import { RefreshCw, SearchCheck } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import SortableHeader from './SortableHeader';
import useSortableRows from '../hooks/useSortableRows';

export default function TerrainSyncDiagnostics({ role }) {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');
  const { sortedRows, sortState, setSortState } = useSortableRows(rows, null, 'terrain-sync-diagnostics');
  const canView = ['Administrateur', 'Coordonnateur'].includes(role);

  async function reload() {
    const { data, error } = await supabase
      .from('terrain_sync_diagnostics')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return setMessage(error.message);
    setRows(data || []);
    setMessage('');
  }

  useEffect(() => {
    if (canView) reload();
  }, [canView]);

  if (!canView) return <div className="v07-card">Accès réservé.</div>;

  const header = (label, column) => (
    <SortableHeader
      label={label}
      column={column}
      rows={rows}
      sortState={sortState}
      onSort={setSortState}
      onReset={() => setSortState(null)}
    />
  );

  return <div className="operations-page">
    <header className="operations-hero">
      <div><h1><SearchCheck/> Diagnostic synchronisation terrain</h1><p>Dernière étape réellement confirmée.</p></div>
      <button onClick={reload}><RefreshCw size={17}/> Actualiser</button>
    </header>
    {message && <div className="v07-message">{message}</div>}
    <section className="v07-card">
      <div className="tableWrap">
        <table>
          <thead><tr>
            {header('Date', 'created_at')}
            {header('Référence', 'reference')}
            {header('Support', 'support_id')}
            {header('Étape', 'etape')}
            {header('Statut', 'statut')}
            {header('Utilisateur', 'utilisateur')}
            {header('Détails', 'details')}
          </tr></thead>
          <tbody>{sortedRows.map(row => <tr key={row.id}>
            <td>{new Date(row.created_at).toLocaleString('fr-CA')}</td>
            <td>{row.reference}</td><td>{row.support_id}</td><td>{row.etape}</td>
            <td>{row.statut}</td><td>{row.utilisateur || '—'}</td>
            <td><code>{JSON.stringify(row.details)}</code></td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  </div>;
}
