import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  Eye,
  EyeOff,
  Link2,
  LoaderCircle,
  PencilLine,
  Plus,
  Trash2,
  X
} from 'lucide-react';
import {
  deleteRelationRule,
  loadCompleteRelationCatalog,
  saveRelationRule
} from '../services/relationService';

export default function ColumnRelationMenu({
  sourceTable,
  sourceField,
  role
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('read');
  const [schema, setSchema] = useState({});
  const [rules, setRules] = useState([]);
  const [destinationTable, setDestinationTable] = useState('');
  const [destinationField, setDestinationField] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const isAdmin = role === 'Administrateur';

  const relatedRules = useMemo(
    () => rules.filter(rule =>
      rule.source_table === sourceTable &&
      rule.source_field === sourceField
    ),
    [rules, sourceTable, sourceField]
  );

  async function load() {
    setBusy(true);
    try {
      const catalog = await loadCompleteRelationCatalog();
      setSchema(catalog.schema);
      setRules(catalog.rules);

      const firstTable = Object.keys(catalog.schema)
        .sort((a, b) => a.localeCompare(b, 'fr-CA'))
        .find(table => table !== sourceTable) || '';

      setDestinationTable(current => current || firstTable);
      setDestinationField(current =>
        current || (catalog.schema[firstTable] || [])[0] || ''
      );
    } catch (error) {
      setMessage(error.message || 'Relations indisponibles.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (open) load();
  }, [open, sourceTable, sourceField]);

  if (!isAdmin) return null;

  async function addRelation() {
    if (!destinationTable || !destinationField) {
      setMessage('Sélectionne une table et un champ de destination.');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      await saveRelationRule({
        source_table: sourceTable,
        source_field: sourceField,
        destination_table: destinationTable,
        destination_field: destinationField,
        enabled: true,
        create_history: true,
        requires_confirmation: mode === 'edit',
        confidence: mode === 'edit'
          ? 'Grille — afficher et modifier'
          : 'Grille — afficher',
        validation_status: 'Validée',
        condition_json: {
          grid_shortcut: true,
          destination_editable: mode === 'edit',
          relation_direction: mode === 'edit' ? 'bidirectional' : 'source_to_destination'
        }
      });

      setMessage('Relation ajoutée au Studio des relations.');
      await load();
    } catch (error) {
      setMessage(error.message || 'Relation impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(rule) {
    if (!window.confirm(
      `Supprimer la relation vers ${rule.destination_table}.${rule.destination_field}?`
    )) return;

    setBusy(true);
    try {
      await deleteRelationRule(rule.id);
      setMessage('Relation supprimée.');
      await load();
    } catch (error) {
      setMessage(error.message || 'Suppression impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="column-relation-menu" onClick={event => event.stopPropagation()}>
      <button
        type="button"
        className="column-relation-trigger"
        title="Relations de cette colonne"
        onClick={() => setOpen(value => !value)}
      >
        <Link2 size={14}/>
        <ChevronDown size={13}/>
        {relatedRules.length > 0 && (
          <span>{relatedRules.length}</span>
        )}
      </button>

      {open && (
        <div className="column-relation-popover">
          <div className="column-relation-head">
            <div>
              <strong>Relations de la colonne</strong>
              <small>{sourceTable}.{sourceField}</small>
            </div>
            <button type="button" onClick={() => setOpen(false)}>
              <X size={16}/>
            </button>
          </div>

          <div className="column-relation-modes">
            <button
              type="button"
              className={mode === 'read' ? 'active' : ''}
              onClick={() => setMode('read')}
            >
              <Eye size={15}/> Afficher la donnée dans…
            </button>
            <button
              type="button"
              className={mode === 'edit' ? 'active' : ''}
              onClick={() => setMode('edit')}
            >
              <PencilLine size={15}/> Afficher et modifier dans…
            </button>
          </div>

          <label>
            Table de destination
            <select
              value={destinationTable}
              onChange={event => {
                const table = event.target.value;
                setDestinationTable(table);
                setDestinationField((schema[table] || [])[0] || '');
              }}
            >
              {Object.keys(schema)
                .sort((a, b) => a.localeCompare(b, 'fr-CA'))
                .map(table => (
                  <option key={table}>{table}</option>
                ))}
            </select>
          </label>

          <label>
            Champ de destination
            <select
              value={destinationField}
              onChange={event => setDestinationField(event.target.value)}
            >
              {(schema[destinationTable] || []).map(field => (
                <option key={field}>{field}</option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="column-relation-add"
            disabled={busy}
            onClick={addRelation}
          >
            {busy
              ? <LoaderCircle className="spin" size={16}/>
              : <Plus size={16}/>}
            Ajouter cette relation
          </button>

          {message && <p className="column-relation-message">{message}</p>}

          <div className="column-existing-relations">
            <strong>Relations existantes</strong>

            {relatedRules.map(rule => (
              <article key={rule.id}>
                <div>
                  <span>
                    {rule.condition_json?.destination_editable
                      ? <PencilLine size={14}/>
                      : <Eye size={14}/>}
                    {rule.destination_table}.{rule.destination_field}
                  </span>
                  <small>
                    {rule.condition_json?.destination_editable
                      ? 'Afficher et modifier'
                      : 'Afficher seulement'}
                  </small>
                </div>
                <button type="button" onClick={() => remove(rule)}>
                  <Trash2 size={14}/>
                </button>
              </article>
            ))}

            {!relatedRules.length && (
              <small>Aucune relation pour cette colonne.</small>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
