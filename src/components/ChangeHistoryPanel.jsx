import React, { useEffect, useState } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { loadAdminChangeLog } from '../services/universalEditorService';
import SortableHeader from './SortableHeader';
import useSortableRows from '../hooks/useSortableRows';

export default function ChangeHistoryPanel({ role }) {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');
  const { sortedRows, sortState, setSortState } = useSortableRows(rows, null, 'change-history');

  async function reload() {
    try {
      setRows(await loadAdminChangeLog());
      setMessage('');
    } catch (error) {
      setMessage(error.message || 'Impossible de charger l’historique.');
    }
  }

  useEffect(() => {
    if (role === 'Administrateur') reload();
  }, [role]);

  if (role !== 'Administrateur') {
    return <section className="v07-card"><h1>Accès réservé</h1></section>;
  }

  return (
    <div className="change-history-page">
      <header className="editor-hero">
        <div>
          <h1><History/> Historique des modifications</h1>
          <p>Anciennes et nouvelles valeurs enregistrées directement par le portail.</p>
        </div>
        <button onClick={reload}><RefreshCw size={17}/> Actualiser</button>
      </header>

      {message && <div className="v07-message">{message}</div>}

      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <SortableHeader label="Date" column="changed_at" rows={rows} sortState={sortState} onSort={setSortState} onReset={() => setSortState(null)}/>
              <SortableHeader label="Utilisateur" column="changed_by_email" rows={rows} sortState={sortState} onSort={setSortState} onReset={() => setSortState(null)}/>
              <SortableHeader label="Table" column="table_name" rows={rows} sortState={sortState} onSort={setSortState} onReset={() => setSortState(null)}/>
              <SortableHeader label="Ligne" column="record_key" rows={rows} sortState={sortState} onSort={setSortState} onReset={() => setSortState(null)}/>
              <SortableHeader label="Champ" column="field_name" rows={rows} sortState={sortState} onSort={setSortState} onReset={() => setSortState(null)}/>
              <SortableHeader label="Ancienne valeur" column="old_value" rows={rows} sortState={sortState} onSort={setSortState} onReset={() => setSortState(null)}/>
              <SortableHeader label="Nouvelle valeur" column="new_value" rows={rows} sortState={sortState} onSort={setSortState} onReset={() => setSortState(null)}/>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map(row => (
              <tr key={row.id}>
                <td>{new Date(row.changed_at).toLocaleString('fr-CA')}</td>
                <td>{row.changed_by_email || row.changed_by || '—'}</td>
                <td>{row.table_name}</td>
                <td>{row.record_key || '—'}</td>
                <td>{row.field_name}</td>
                <td>{String(row.old_value ?? '—')}</td>
                <td>{String(row.new_value ?? '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
