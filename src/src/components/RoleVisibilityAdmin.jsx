import React, { useEffect, useMemo, useState } from 'react';
import { Eye, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import {
  listRoleVisibility,
  saveRoleVisibility
} from '../services/roleVisibilityService';

const ROLES = ['Administrateur', 'Coordonnateur', 'Installateur', 'Client-Admin', 'Client'];

export default function RoleVisibilityAdmin({ dataStore, tableNames, role }) {
  const [permissions, setPermissions] = useState([]);
  const [selectedRole, setSelectedRole] = useState('Administrateur');
  const [selectedTable, setSelectedTable] = useState(tableNames[0] || '');
  const [message, setMessage] = useState('');

  const allowed = role === 'Administrateur';

  async function reload() {
    try {
      setPermissions(await listRoleVisibility());
      setMessage('');
    } catch (error) {
      setMessage(error.message || 'Erreur de chargement.');
    }
  }

  useEffect(() => {
    if (allowed) reload();
  }, [allowed]);

  const current = permissions.find(item => item.role === selectedRole) || {
    role: selectedRole,
    visible_tables: [],
    visible_columns: {}
  };

  const tableRows = dataStore?.[selectedTable]?.rows || [];
  const tableColumns = useMemo(() => {
    if (!tableRows.length) return [];
    return Object.keys(tableRows[0]).filter(column =>
      !['raw_data', 'created_at', 'updated_at', 'format_visuel'].includes(column)
    );
  }, [tableRows]);

  const tableVisible = current.visible_tables?.includes('*') ||
    current.visible_tables?.includes(selectedTable);

  const configuredColumns = current.visible_columns?.[selectedTable] || [];
  const allColumnsVisible = configuredColumns.length === 0;

  function patchCurrent(patch) {
    setPermissions(items => {
      const exists = items.some(item => item.role === selectedRole);
      if (!exists) return [...items, { ...current, ...patch }];
      return items.map(item =>
        item.role === selectedRole ? { ...item, ...patch } : item
      );
    });
  }

  function toggleTable(checked) {
    if (selectedRole === 'Administrateur') return;

    const currentTables = (current.visible_tables || []).filter(item => item !== '*');
    const next = checked
      ? [...new Set([...currentTables, selectedTable])]
      : currentTables.filter(item => item !== selectedTable);

    patchCurrent({ visible_tables: next });
  }

  function toggleColumn(column, checked) {
    const currentMap = current.visible_columns || {};
    const currentColumns = allColumnsVisible ? [...tableColumns] : configuredColumns;
    const nextColumns = checked
      ? [...new Set([...currentColumns, column])]
      : currentColumns.filter(item => item !== column);

    patchCurrent({
      visible_columns: {
        ...currentMap,
        [selectedTable]: nextColumns
      }
    });
  }

  function setAllColumns() {
    patchCurrent({
      visible_columns: {
        ...(current.visible_columns || {}),
        [selectedTable]: []
      }
    });
  }

  async function save() {
    try {
      const saved = await saveRoleVisibility(current);
      setPermissions(items => items.map(item => item.role === saved.role ? saved : item));
      setMessage(`Visibilité enregistrée pour le rôle ${saved.role}.`);
    } catch (error) {
      setMessage(error.message || 'Erreur d’enregistrement.');
    }
  }

  if (!allowed) {
    return (
      <div className="role-visibility-page">
        <section className="v07-card">
          <h1>Accès réservé</h1>
          <p>La visibilité des tables et colonnes est réservée aux administrateurs.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="role-visibility-page">
      <header className="role-visibility-hero">
        <div>
          <h1><ShieldCheck/> Visibilité par rôle</h1>
          <p>Définis les tables et les colonnes visibles selon le type d’utilisateur.</p>
        </div>
        <button onClick={reload}><RefreshCw size={18}/> Actualiser</button>
      </header>

      {message && <div className="v07-message">{message}</div>}

      <div className="role-visibility-layout">
        <section className="v07-card">
          <label>Type d’utilisateur
            <select value={selectedRole} onChange={event => setSelectedRole(event.target.value)}>
              {ROLES.map(item => <option key={item}>{item}</option>)}
            </select>
          </label>

          <label>Table
            <select value={selectedTable} onChange={event => setSelectedTable(event.target.value)}>
              {tableNames.map(item => <option key={item}>{item}</option>)}
            </select>
          </label>

          <label className="role-table-switch">
            <input
              type="checkbox"
              checked={selectedRole === 'Administrateur' || tableVisible}
              disabled={selectedRole === 'Administrateur'}
              onChange={event => toggleTable(event.target.checked)}
            />
            Cette table est visible pour ce rôle
          </label>

          {selectedRole === 'Administrateur' && (
            <small>L’administrateur conserve toujours l’accès complet.</small>
          )}

          <button className="v07-primary" onClick={save}>
            <Save size={18}/> Enregistrer
          </button>
        </section>

        <section className="v07-card">
          <div className="role-columns-head">
            <div>
              <h2><Eye/> Colonnes visibles</h2>
              <p>{selectedTable}</p>
            </div>
            <button className="v07-secondary" onClick={setAllColumns}>
              Toutes les colonnes
            </button>
          </div>

          <div className="role-columns-grid">
            {tableColumns.map(column => {
              const checked = allColumnsVisible || configuredColumns.includes(column);
              return (
                <label key={column}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!tableVisible && selectedRole !== 'Administrateur'}
                    onChange={event => toggleColumn(column, event.target.checked)}
                  />
                  {column}
                </label>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
