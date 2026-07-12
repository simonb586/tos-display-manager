import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronRight, Eye, RefreshCw, Save, TestTube2, Workflow } from 'lucide-react';
import { listRelationFields, listRelationRules, saveRelationField, saveRelationRule, testRelationRule } from '../services/relationService';

const roles = ['Administrateur', 'Coordonnateur', 'Installateur', 'Client-Admin', 'Client'];

export default function RelationsStudio({ role }) {
  const [fields, setFields] = useState([]);
  const [rules, setRules] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle');
  const isAdmin = role === 'Administrateur';

  async function reload() {
    setStatus('loading');
    setMessage('');
    try {
      const [fieldRows, ruleRows] = await Promise.all([listRelationFields(), listRelationRules()]);
      setFields(fieldRows);
      setRules(ruleRows);
      setSelectedId(current => current || fieldRows[0]?.id || null);
      setStatus('done');
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'Erreur de chargement.');
    }
  }

  useEffect(() => { if (isAdmin) reload(); }, [isAdmin]);

  const selected = fields.find(field => field.id === selectedId);
  const relatedRules = useMemo(
    () => selected ? rules.filter(rule =>
      rule.source_table === selected.table_name && rule.source_field === selected.field_name
    ) : [],
    [rules, selected]
  );

  function patchSelected(patch) {
    setFields(current => current.map(field => field.id === selectedId ? { ...field, ...patch } : field));
  }

  async function saveSelected() {
    if (!selected) return;
    setStatus('saving');
    try {
      await saveRelationField(selected);
      await reload();
      setMessage('Configuration du champ enregistrée.');
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'Erreur d’enregistrement.');
    }
  }

  async function toggleRule(rule, patch) {
    try {
      await saveRelationRule({ ...rule, ...patch });
      await reload();
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'Erreur de relation.');
    }
  }

  async function testRule(rule) {
    try {
      const result = await testRelationRule(rule);
      setMessage(result?.message || 'Test terminé.');
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'Test impossible.');
    }
  }

  if (!isAdmin) {
    return <div className="relations-page"><section className="relations-card"><h1>Accès réservé</h1><p>Le Studio des relations est réservé aux administrateurs.</p></section></div>;
  }

  return (
    <div className="relations-page">
      <header className="relations-hero">
        <div><h1>Studio des relations</h1><p>Configure les sources de vérité, les propagations et la visibilité terrain sans code.</p></div>
        <button onClick={reload}><RefreshCw size={18}/> Actualiser</button>
      </header>

      {message && <div className={status === 'error' ? 'relations-message error' : 'relations-message'}>{message}</div>}

      <div className="relations-layout">
        <aside className="relations-list">
          {fields.map(field => (
            <button key={field.id} className={field.id === selectedId ? 'active' : ''} onClick={() => setSelectedId(field.id)}>
              <div><strong>{field.field_label}</strong><span>{field.module_name}</span></div>
              <small>{field.validation_status}</small><ChevronRight size={16}/>
            </button>
          ))}
        </aside>

        <section className="relations-card">
          {!selected ? <p>Aucun champ à configurer.</p> : <>
            <div className="relations-title">
              <Workflow/>
              <div><h2>{selected.field_label}</h2><p>{selected.table_name}.{selected.field_name}</p></div>
            </div>

            <Question title="Cette donnée est-elle créée directement dans ce champ?">
              <BooleanChoice value={selected.is_primary_source} onChange={value => patchSelected({ is_primary_source: value })}/>
            </Question>

            {!selected.is_primary_source && <div className="relations-grid">
              <label>Table source<input value={selected.source_table || ''} onChange={e => patchSelected({ source_table: e.target.value })} placeholder="Ex. campagnes_maitres"/></label>
              <label>Champ source<input value={selected.source_field || ''} onChange={e => patchSelected({ source_field: e.target.value })} placeholder="Ex. visuel_generique"/></label>
            </div>}

            <Question title="Une modification de ce champ doit-elle mettre à jour d’autres champs?">
              <BooleanChoice value={selected.triggers_updates} onChange={value => patchSelected({ triggers_updates: value })}/>
            </Question>

            <Question title="Ce champ doit-il être visible dans l’application terrain?">
              <BooleanChoice value={selected.visible_terrain} onChange={value => patchSelected({ visible_terrain: value })}/>
            </Question>

            {selected.visible_terrain && <>
              <div className="relations-grid">
                <label>Section terrain<input value={selected.terrain_section || ''} onChange={e => patchSelected({ terrain_section: e.target.value })} placeholder="Informations du support"/></label>
                <label>Lecture seule<select value={selected.terrain_readonly ? 'Vrai' : 'Faux'} onChange={e => patchSelected({ terrain_readonly: e.target.value === 'Vrai' })}><option>Vrai</option><option>Faux</option></select></label>
              </div>
              <label className="relations-label">Visible pour les rôles</label>
              <div className="relations-roles">{roles.map(item => {
                const checked = (selected.terrain_roles || []).includes(item);
                return <label key={item}><input type="checkbox" checked={checked} onChange={e => {
                  const current = selected.terrain_roles || [];
                  patchSelected({ terrain_roles: e.target.checked ? [...current, item] : current.filter(roleName => roleName !== item) });
                }}/>{item}</label>;
              })}</div>
            </>}

            <button className="relations-save" onClick={saveSelected}><Save size={18}/> Enregistrer ce champ</button>

            <div className="relations-rules">
              <h3>Destinations reliées</h3>
              {!relatedRules.length && <p>Aucune destination configurée pour ce champ.</p>}
              {relatedRules.map(rule => <article key={rule.id}>
                <div>
                  <strong>{rule.destination_module}</strong>
                  <span>{rule.destination_table}.{rule.destination_field}</span>
                  <small>{rule.confidence} — {rule.validation_status}</small>
                </div>
                <div className="relations-rule-actions">
                  <button onClick={() => toggleRule(rule, { enabled: !rule.enabled })}>{rule.enabled ? <Eye size={16}/> : <Eye size={16}/>} {rule.enabled ? 'Active' : 'Inactive'}</button>
                  <button onClick={() => testRule(rule)}><TestTube2 size={16}/> Tester</button>
                  <button onClick={() => toggleRule(rule, { validation_status: 'Validée' })}><CheckCircle2 size={16}/> Valider</button>
                </div>
              </article>)}
            </div>
          </>}
        </section>
      </div>
    </div>
  );
}

function Question({ title, children }) {
  return <div className="relations-question"><strong>{title}</strong>{children}</div>;
}

function BooleanChoice({ value, onChange }) {
  return <div className="boolean-choice">
    <button className={value === true ? 'selected true' : ''} onClick={() => onChange(true)}>Vrai</button>
    <button className={value === false ? 'selected false' : ''} onClick={() => onChange(false)}>Faux</button>
  </div>;
}
