import React, { useEffect, useState } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { loadAdminChangeLog } from '../services/universalEditorService';

export default function ChangeHistoryPanel({ role }) {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');

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
              <th>Date</th>
              <th>Utilisateur</th>
              <th>Table</th>
              <th>Ligne</th>
              <th>Champ</th>
              <th>Ancienne valeur</th>
              <th>Nouvelle valeur</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
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
