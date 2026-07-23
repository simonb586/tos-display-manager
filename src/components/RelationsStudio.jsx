import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Eye,
  Link2,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
  TestTube2,
  Trash2,
  Workflow
} from 'lucide-react';
import {
  deleteRelationRule,
  loadCompleteRelationCatalog,
  saveRelationField,
  saveRelationRule,
  synchronizeRelationCatalog,
  installRelationTriggers,
  testRelationRule
} from '../services/relationService';

const roles = ['Administrateur', 'Coordonnateur', 'Installateur', 'Client-Admin', 'Client'];

const emptyRule = {
  source_table: '',
  source_field: '',
  destination_table: '',
  destination_field: '',
  enabled: true,
  create_history: true,
  requires_confirmation: false,
  confidence: 'Manuelle',
  validation_status: 'À confirmer',
  propagation_mode: 'automatique',
  condition_json: { source_key: '', destination_key: '' }
};

export default function RelationsStudio({ role }) {
  const [schema, setSchema] = useState({});
  const [fields, setFields] = useState([]);
  const [rules, setRules] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [selectedField, setSelectedField] = useState('');
  const [search, setSearch] = useState('');
  const [newRule, setNewRule] = useState(emptyRule);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle');
  const isAdmin = role === 'Administrateur';

  const tableNames = useMemo(
    () => Object.keys(schema).sort((a, b) => a.localeCompare(b, 'fr-CA')),
    [schema]
  );

  const fieldsForSelectedTable = useMemo(
    () => (schema[selectedTable] || []).slice().sort((a, b) => a.localeCompare(b, 'fr-CA')),
    [schema, selectedTable]
  );

  const selected = useMemo(
    () => fields.find(field =>
      field.table_name === selectedTable &&
      field.field_name === selectedField
    ) || null,
    [fields, selectedTable, selectedField]
  );

  const relatedRules = useMemo(
    () => selected
      ? rules.filter(rule =>
          rule.source_table === selected.table_name &&
          rule.source_field === selected.field_name
        )
      : [],
    [rules, selected]
  );

  const filteredTables = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return tableNames;

    return tableNames.filter(tableName => {
      if (tableName.toLowerCase().includes(needle)) return true;
      return (schema[tableName] || []).some(field =>
        field.toLowerCase().includes(needle)
      );
    });
  }, [tableNames, schema, search]);

  async function reload({ preserveSelection = true } = {}) {
    setStatus('loading');
    setMessage('');

    try {
      const catalog = await loadCompleteRelationCatalog();
      setSchema(catalog.schema);
      setFields(catalog.fields);
      setRules(catalog.rules);

      const nextTable = preserveSelection && selectedTable && catalog.schema[selectedTable]
        ? selectedTable
        : Object.keys(catalog.schema).sort()[0] || '';

      const nextField = preserveSelection &&
        selectedField &&
        (catalog.schema[nextTable] || []).includes(selectedField)
          ? selectedField
          : (catalog.schema[nextTable] || [])[0] || '';

      setSelectedTable(nextTable);
      setSelectedField(nextField);
      setNewRule(current => ({
        ...current,
        source_table: nextTable,
        source_field: nextField
      }));
      setStatus('done');
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'Erreur de chargement.');
    }
  }

  useEffect(() => {
    if (isAdmin) reload({ preserveSelection: false });
  }, [isAdmin]);

  useEffect(() => {
    if (!selectedTable) return;
    const firstField = (schema[selectedTable] || [])[0] || '';
    if (!(schema[selectedTable] || []).includes(selectedField)) {
      setSelectedField(firstField);
    }
  }, [selectedTable, schema, selectedField]);

  useEffect(() => {
    setNewRule(current => ({
      ...current,
      source_table: selectedTable,
      source_field: selectedField
    }));
  }, [selectedTable, selectedField]);

  function patchSelected(patch) {
    setFields(current => current.map(field =>
      field.table_name === selectedTable &&
      field.field_name === selectedField
        ? { ...field, ...patch }
        : field
    ));
  }

  async function runAction(action, successMessage) {
    setStatus('saving');
    setMessage('');

    try {
      await action();
      await reload();
      setMessage(successMessage);
      setStatus('done');
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'Une erreur est survenue.');
    }
  }

  async function saveSelected() {
    if (!selected) return;
    await runAction(
      () => saveRelationField(selected),
      `Configuration enregistrée pour ${selected.table_name}.${selected.field_name}.`
    );
  }

  async function synchronizeAll() {
    await runAction(
      synchronizeRelationCatalog,
      'Toutes les tables et tous les champs du schéma public sont maintenant disponibles dans le Studio.'
    );
  }

  async function installTriggers() {
    await runAction(
      installRelationTriggers,
      'Les déclencheurs automatiques ont été installés sur toutes les tables sources actives.'
    );
  }

  async function createRule(event) {
    event.preventDefault();

    if (
      !newRule.source_table ||
      !newRule.source_field ||
      !newRule.destination_table ||
      !newRule.destination_field
    ) {
      setStatus('error');
      setMessage('Sélectionne une table et un champ pour la source et la destination.');
      return;
    }

    if (
      newRule.source_table === newRule.destination_table &&
      newRule.source_field === newRule.destination_field
    ) {
      setStatus('error');
      setMessage('La source et la destination ne peuvent pas être le même champ.');
      return;
    }

    await runAction(
      () => saveRelationRule(newRule),
      'Nouvelle relation enregistrée.'
    );

    setNewRule(current => ({
      ...emptyRule,
      source_table: current.source_table,
      source_field: current.source_field
    }));
  }

  async function toggleRule(rule, patch) {
    await runAction(
      () => saveRelationRule({ ...rule, ...patch }),
      'Relation mise à jour.'
    );
  }

  async function removeRule(rule) {
    if (!window.confirm(
      `Supprimer la relation ${rule.source_table}.${rule.source_field} → ${rule.destination_table}.${rule.destination_field}?`
    )) return;

    await runAction(
      () => deleteRelationRule(rule),
      'Relation supprimée.'
    );
  }

  async function testRule(rule) {
    setStatus('testing');
    setMessage('');

    try {
      const result = await testRelationRule(rule);
      setStatus('done');
      setMessage(result?.message || 'Test terminé.');
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'Test impossible.');
    }
  }

  if (!isAdmin) {
    return (
      <div className="relations-page">
        <section className="relations-card">
          <h1>Accès réservé</h1>
          <p>Le Studio des relations est réservé aux administrateurs.</p>
        </section>
      </div>
    );
  }

  const busy = ['loading', 'saving', 'testing'].includes(status);

  return (
    <div className="relations-page">
      <header className="relations-hero">
        <div>
          <h1>Studio des relations</h1>
          <p>Sélectionne les tables et les champs dans des listes complètes, sans saisie manuelle.</p>
        </div>
        <div className="relations-hero-actions">
          <button disabled={busy} onClick={synchronizeAll}>
            {busy ? <LoaderCircle className="spin" size={18}/> : <Workflow size={18}/>}
            Synchroniser toutes les tables
          </button>
          <button disabled={busy} onClick={installTriggers}>
            <Workflow size={18}/> Installer les propagations
          </button>
          <button disabled={busy} onClick={() => reload()}>
            <RefreshCw className={status === 'loading' ? 'spin' : ''} size={18}/>
            Actualiser
          </button>
        </div>
      </header>

      {message && (
        <div className={status === 'error' ? 'relations-message error' : 'relations-message success'}>
          {busy && <LoaderCircle className="spin" size={17}/>}
          {message}
        </div>
      )}

      <div className="relations-catalog-bar">
        <label className="relations-search">
          <Search size={17}/>
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Rechercher une table ou un champ..."
          />
        </label>

        <label>
          Table à configurer
          <select
            value={selectedTable}
            onChange={event => {
              const table = event.target.value;
              setSelectedTable(table);
              setSelectedField((schema[table] || [])[0] || '');
            }}
          >
            {filteredTables.map(table => (
              <option key={table} value={table}>
                {table} ({(schema[table] || []).length} champs)
              </option>
            ))}
          </select>
        </label>

        <label>
          Champ à configurer
          <select
            value={selectedField}
            onChange={event => setSelectedField(event.target.value)}
          >
            {fieldsForSelectedTable.map(field => (
              <option key={field} value={field}>{field}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="relations-layout relations-layout-complete">
        <aside className="relations-list">
          <div className="relations-list-summary">
            <strong>{tableNames.length}</strong>
            <span>tables</span>
            <strong>{fields.length}</strong>
            <span>champs</span>
          </div>

          {filteredTables.map(tableName => (
            <button
              key={tableName}
              className={tableName === selectedTable ? 'active' : ''}
              onClick={() => {
                setSelectedTable(tableName);
                setSelectedField((schema[tableName] || [])[0] || '');
              }}
            >
              <div>
                <strong>{tableName}</strong>
                <span>{(schema[tableName] || []).length} champs disponibles</span>
              </div>
              <ChevronRight size={16}/>
            </button>
          ))}
        </aside>

        <div className="relations-main-column">
          <section className="relations-card">
            {!selected ? (
              <p>Aucun champ à configurer.</p>
            ) : (
              <>
                <div className="relations-title">
                  <Workflow/>
                  <div>
                    <h2>{selected.field_label || selected.field_name}</h2>
                    <p>{selected.table_name}.{selected.field_name}</p>
                  </div>
                  <span className={selected.is_virtual ? 'relations-status pending' : 'relations-status configured'}>
                    {selected.is_virtual ? 'Non configuré' : 'Configuré'}
                  </span>
                </div>

                <Question title="Cette donnée est-elle créée directement dans ce champ?">
                  <BooleanChoice
                    value={selected.is_primary_source}
                    onChange={value => patchSelected({ is_primary_source: value })}
                  />
                </Question>

                {!selected.is_primary_source && (
                  <div className="relations-grid">
                    <label>
                      Table source
                      <select
                        value={selected.source_table || ''}
                        onChange={event => patchSelected({
                          source_table: event.target.value,
                          source_field: (schema[event.target.value] || [])[0] || ''
                        })}
                      >
                        <option value="">Sélectionner une table</option>
                        {tableNames.map(table => <option key={table}>{table}</option>)}
                      </select>
                    </label>

                    <label>
                      Champ source
                      <select
                        value={selected.source_field || ''}
                        disabled={!selected.source_table}
                        onChange={event => patchSelected({ source_field: event.target.value })}
                      >
                        <option value="">Sélectionner un champ</option>
                        {(schema[selected.source_table] || []).map(field => (
                          <option key={field}>{field}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                <Question title="Une modification de ce champ doit-elle mettre à jour d’autres champs?">
                  <BooleanChoice
                    value={selected.triggers_updates}
                    onChange={value => patchSelected({ triggers_updates: value })}
                  />
                </Question>

                <Question title="Ce champ doit-il être visible dans l’application terrain?">
                  <BooleanChoice
                    value={selected.visible_terrain}
                    onChange={value => patchSelected({ visible_terrain: value })}
                  />
                </Question>

                {selected.visible_terrain && (
                  <>
                    <div className="relations-grid">
                      <label>
                        Section terrain
                        <input
                          value={selected.terrain_section || ''}
                          onChange={event => patchSelected({ terrain_section: event.target.value })}
                          placeholder="Informations du support"
                        />
                      </label>

                      <label>
                        Lecture seule
                        <select
                          value={selected.terrain_readonly ? 'Vrai' : 'Faux'}
                          onChange={event => patchSelected({
                            terrain_readonly: event.target.value === 'Vrai'
                          })}
                        >
                          <option>Vrai</option>
                          <option>Faux</option>
                        </select>
                      </label>
                    </div>

                    <label className="relations-label">Visible pour les rôles</label>
                    <div className="relations-roles">
                      {roles.map(item => {
                        const checked = (selected.terrain_roles || []).includes(item);

                        return (
                          <label key={item}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={event => {
                                const current = selected.terrain_roles || [];
                                patchSelected({
                                  terrain_roles: event.target.checked
                                    ? [...new Set([...current, item])]
                                    : current.filter(roleName => roleName !== item)
                                });
                              }}
                            />
                            {item}
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}

                <button
                  className="relations-save"
                  disabled={busy}
                  onClick={saveSelected}
                >
                  {status === 'saving'
                    ? <LoaderCircle className="spin" size={18}/>
                    : <Save size={18}/>}
                  Enregistrer ce champ
                </button>
              </>
            )}
          </section>

          <section className="relations-card">
            <div className="relations-title">
              <Link2/>
              <div>
                <h2>Créer une relation</h2>
                <p>Source et destination sont sélectionnées dans le schéma complet.</p>
              </div>
            </div>

            <form className="relations-rule-builder" onSubmit={createRule}>
              <fieldset>
                <legend>Source</legend>
                <label>
                  Table source
                  <select
                    value={newRule.source_table}
                    onChange={event => setNewRule(current => ({
                      ...current,
                      source_table: event.target.value,
                      source_field: (schema[event.target.value] || [])[0] || ''
                    }))}
                  >
                    <option value="">Sélectionner</option>
                    {tableNames.map(table => <option key={table}>{table}</option>)}
                  </select>
                </label>
                <label>
                  Champ source
                  <select
                    value={newRule.source_field}
                    disabled={!newRule.source_table}
                    onChange={event => setNewRule(current => ({
                      ...current,
                      source_field: event.target.value
                    }))}
                  >
                    <option value="">Sélectionner</option>
                    {(schema[newRule.source_table] || []).map(field => (
                      <option key={field}>{field}</option>
                    ))}
                  </select>
                </label>
              </fieldset>

              <div className="relations-arrow">→</div>

              <fieldset>
                <legend>Destination</legend>
                <label>
                  Table destination
                  <select
                    value={newRule.destination_table}
                    onChange={event => setNewRule(current => ({
                      ...current,
                      destination_table: event.target.value,
                      destination_field: (schema[event.target.value] || [])[0] || ''
                    }))}
                  >
                    <option value="">Sélectionner</option>
                    {tableNames.map(table => <option key={table}>{table}</option>)}
                  </select>
                </label>
                <label>
                  Champ destination
                  <select
                    value={newRule.destination_field}
                    disabled={!newRule.destination_table}
                    onChange={event => setNewRule(current => ({
                      ...current,
                      destination_field: event.target.value
                    }))}
                  >
                    <option value="">Sélectionner</option>
                    {(schema[newRule.destination_table] || []).map(field => (
                      <option key={field}>{field}</option>
                    ))}
                  </select>
                </label>
              </fieldset>

              <div className="relations-grid">
                <label>
                  Clé de correspondance source
                  <select value={newRule.condition_json?.source_key || ''} onChange={event => setNewRule(current => ({...current, condition_json:{...(current.condition_json||{}), source_key:event.target.value}}))}>
                    <option value="">Automatique (support_id ou id)</option>
                    {(schema[newRule.source_table] || []).map(field => <option key={field}>{field}</option>)}
                  </select>
                </label>
                <label>
                  Clé de correspondance destination
                  <select value={newRule.condition_json?.destination_key || ''} onChange={event => setNewRule(current => ({...current, condition_json:{...(current.condition_json||{}), destination_key:event.target.value}}))}>
                    <option value="">Automatique (support_id ou id)</option>
                    {(schema[newRule.destination_table] || []).map(field => <option key={field}>{field}</option>)}
                  </select>
                </label>
                <label>
                  Mode de propagation
                  <select value={newRule.propagation_mode || 'automatique'} onChange={event => setNewRule(current => ({...current, propagation_mode:event.target.value}))}>
                    <option value="automatique">Automatique</option>
                    <option value="manuel">Manuel</option>
                  </select>
                </label>
              </div>

              <div className="relations-builder-options">
                <label>
                  <input
                    type="checkbox"
                    checked={newRule.create_history}
                    onChange={event => setNewRule(current => ({
                      ...current,
                      create_history: event.target.checked
                    }))}
                  />
                  Créer un historique
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={newRule.requires_confirmation}
                    onChange={event => setNewRule(current => ({
                      ...current,
                      requires_confirmation: event.target.checked
                    }))}
                  />
                  Confirmation requise
                </label>
              </div>

              <button className="relations-create-rule" disabled={busy}>
                <Plus size={18}/> Ajouter la relation
              </button>
            </form>
          </section>

          <section className="relations-card relations-rules">
            <h3>Relations visibles pour le champ sélectionné</h3>

            {!relatedRules.length && (
              <p>Aucune destination configurée pour ce champ.</p>
            )}

            {relatedRules.map(rule => (
              <article key={rule.id}>
                <div>
                  <strong>{rule.source_table}.{rule.source_field}</strong>
                  <span>→ {rule.destination_table}.{rule.destination_field}</span>
                  <small>{rule.confidence} — {rule.validation_status}</small>
                </div>

                <div className="relations-rule-actions">
                  <button
                    disabled={busy}
                    onClick={() => toggleRule(rule, { enabled: !rule.enabled })}
                  >
                    <Eye size={16}/> {rule.enabled ? 'Active' : 'Inactive'}
                  </button>
                  <button disabled={busy} onClick={() => testRule(rule)}>
                    <TestTube2 size={16}/> Tester
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => toggleRule(rule, {
                      validation_status: 'Validée'
                    })}
                  >
                    <CheckCircle2 size={16}/> Valider
                  </button>
                  <button
                    className="danger"
                    disabled={busy}
                    onClick={() => removeRule(rule)}
                  >
                    <Trash2 size={16}/> Supprimer
                  </button>
                </div>
              </article>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}

function Question({ title, children }) {
  return <div className="relations-question"><strong>{title}</strong>{children}</div>;
}

function BooleanChoice({ value, onChange }) {
  return (
    <div className="boolean-choice">
      <button
        type="button"
        className={value === true ? 'selected true' : ''}
        onClick={() => onChange(true)}
      >
        Vrai
      </button>
      <button
        type="button"
        className={value === false ? 'selected false' : ''}
        onClick={() => onChange(false)}
      >
        Faux
      </button>
    </div>
  );
}
