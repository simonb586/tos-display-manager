import React, { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Copy,
  Edit3,
  Link2,
  LoaderCircle,
  Plus,
  Power,
  Save,
  ShieldCheck,
  Trash2,
  X
} from 'lucide-react';
import RelationsStudio from './RelationsStudio';
import {
  approveAutomationDefinition,
  deactivateAutomationDefinition,
  deleteAutomationDefinition,
  duplicateAutomationDefinition,
  listAutomationDefinitions,
  loadAutomationSchema,
  saveAutomationDefinition
} from '../services/automationService';
import {
  automationActions,
  automationAfterActions,
  automationConditions,
  automationLocations,
  automationModules,
  automationPriorities,
  automationRecipients,
  automationStatuses,
  automationTriggers,
  automationValueSources,
  emptyAutomation,
  labelFor,
  moduleForKey
} from '../config/automationCatalog';

const toggleValue = (values, value) =>
  values.includes(value) ? values.filter(item => item !== value) : [...values, value];

function CheckboxGroup({ catalog, values, onChange }) {
  return <div className="automation-check-grid">{catalog.map(([value, label]) => (
    <label key={value}>
      <input
        type="checkbox"
        checked={values.includes(value)}
        onChange={() => onChange(toggleValue(values, value))}
      />
      <span>{label}</span>
    </label>
  ))}</div>;
}

function AutomationForm({ initial, schema, onCancel, onSaved }) {
  const [draft, setDraft] = useState(() => structuredClone(initial || emptyAutomation()));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const patchDefinition = patch => setDraft(current => ({
    ...current,
    definition: { ...current.definition, ...patch }
  }));

  function setTargetModules(keys) {
    const current = new Map(draft.definition.targets.map(target => [target.module, target]));
    patchDefinition({
      targets: keys.map(module => current.get(module) || { module, fields: [] })
    });
  }

  function updateTarget(module, patch) {
    patchDefinition({
      targets: draft.definition.targets.map(target =>
        target.module === module ? { ...target, ...patch } : target
      )
    });
  }

  function toggleField(module, field) {
    const target = draft.definition.targets.find(item => item.module === module);
    const fields = target?.fields || [];
    const exists = fields.some(item => item.field === field);
    updateTarget(module, {
      fields: exists
        ? fields.filter(item => item.field !== field)
        : [...fields, { field, valueSource: 'none', action: 'copy' }]
    });
  }

  function updateField(module, field, patch) {
    const target = draft.definition.targets.find(item => item.module === module);
    updateTarget(module, {
      fields: (target?.fields || []).map(item =>
        item.field === field ? { ...item, ...patch } : item
      )
    });
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const saved = await saveAutomationDefinition(draft);
      onSaved(saved);
    } catch (error) {
      setMessage(error.message || 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  return <form className="automation-form" onSubmit={submit}>
    <div className="automation-form-head">
      <div><h2>{draft.id ? 'Modifier l’automatisation' : 'Nouvelle automatisation'}</h2><p>Cette configuration reste documentaire jusqu’à sa validation explicite.</p></div>
      <button type="button" className="automation-icon-button" onClick={onCancel}><X/></button>
    </div>

    <section><h3>1. Nom de l’automatisation</h3><input required maxLength={120} value={draft.name} onChange={event => setDraft({...draft, name:event.target.value})} placeholder="Ex. Installation d’un visuel"/></section>
    <section><h3>2. Déclencheur — Quand je…</h3><CheckboxGroup catalog={automationTriggers} values={draft.definition.triggers} onChange={triggers => patchDefinition({triggers})}/></section>
    <section><h3>3. Emplacement de l’action</h3><CheckboxGroup catalog={automationLocations} values={draft.definition.locations} onChange={locations => patchDefinition({locations})}/></section>
    <section><h3>4. Table ou module à mettre à jour</h3><CheckboxGroup catalog={automationModules.map(([key,label]) => [key,label])} values={draft.definition.targets.map(target => target.module)} onChange={setTargetModules}/></section>

    <section>
      <h3>5. Champs à mettre à jour</h3>
      {!draft.definition.targets.length && <p className="automation-muted">Sélectionnez d’abord un module.</p>}
      <div className="automation-field-groups">{draft.definition.targets.map(target => {
        const moduleConfig = moduleForKey(target.module);
        const table = moduleConfig?.[2];
        const fields = table ? (schema[table] || []) : [];
        return <article key={target.module}>
          <h4>{moduleConfig?.[1] || target.module}</h4>
          {!table && <p>Module documentaire : aucun champ SQL n’est exposé.</p>}
          {table && !fields.length && <p>Aucun champ disponible ou table absente.</p>}
          {fields.map(field => {
            const mapping = target.fields.find(item => item.field === field);
            return <div className="automation-field-row" key={field}>
              <label><input type="checkbox" checked={Boolean(mapping)} onChange={() => toggleField(target.module, field)}/><span>{field}</span></label>
              <select disabled={!mapping} value={mapping?.valueSource || 'none'} onChange={event => updateField(target.module, field, {valueSource:event.target.value})}>{automationValueSources.map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select>
              <select disabled={!mapping} value={mapping?.action || 'copy'} onChange={event => updateField(target.module, field, {action:event.target.value})}>{automationActions.map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select>
            </div>;
          })}
        </article>;
      })}</div>
    </section>

    <section><h3>6. Conditions</h3><CheckboxGroup catalog={automationConditions} values={draft.definition.conditions} onChange={conditions => patchDefinition({conditions})}/>{draft.definition.conditions.includes('custom') && <input value={draft.definition.customCondition || ''} onChange={event => patchDefinition({customCondition:event.target.value})} placeholder="Condition personnalisée à documenter"/>}</section>
    <section><h3>7. Après l’action</h3><CheckboxGroup catalog={automationAfterActions} values={draft.definition.afterActions} onChange={afterActions => patchDefinition({afterActions})}/></section>
    <section><h3>8. Notifications</h3><CheckboxGroup catalog={automationRecipients} values={draft.definition.notifications} onChange={notifications => patchDefinition({notifications})}/></section>
    <div className="automation-form-pair">
      <section><h3>9. État</h3><select value={draft.status} onChange={event => setDraft({...draft,status:event.target.value})}>{automationStatuses.map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select><small>« Active » devient « À valider » jusqu’à l’approbation administrateur.</small></section>
      <section><h3>10. Priorité</h3><select value={draft.priority} onChange={event => setDraft({...draft,priority:event.target.value})}>{automationPriorities.map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></section>
    </div>

    <section className="automation-summary"><h3>Aperçu structuré</h3><pre>{JSON.stringify(draft.definition, null, 2)}</pre></section>
    {message && <div className="automation-message error">{message}</div>}
    <div className="automation-form-actions"><button type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin"/> : <Save/>} Enregistrer</button><button type="button" className="secondary" onClick={onCancel}>Annuler</button></div>
  </form>;
}

function AutomationCard({ automation, onEdit, onAction }) {
  const definition = automation.definition || {};
  return <article className="automation-card">
    <div className="automation-card-head"><div><h3>{automation.name}</h3><span className={`automation-status ${automation.status}`}>{labelFor(automationStatuses,automation.status)}</span></div><strong className={`automation-priority ${automation.priority}`}>{labelFor(automationPriorities,automation.priority)}</strong></div>
    <dl>
      <div><dt>Déclencheurs</dt><dd>{(definition.triggers || []).map(value => labelFor(automationTriggers,value)).join(', ') || '—'}</dd></div>
      <div><dt>Modules</dt><dd>{(definition.targets || []).map(target => moduleForKey(target.module)?.[1] || target.module).join(', ') || '—'}</dd></div>
      <div><dt>Conditions</dt><dd>{(definition.conditions || []).map(value => labelFor(automationConditions,value)).join(', ') || '—'}</dd></div>
      <div><dt>Dernière modification</dt><dd>{new Date(automation.updated_at).toLocaleString('fr-CA')}</dd></div>
    </dl>
    <div className="automation-card-actions">
      <button onClick={() => onEdit(automation)}><Edit3/> Modifier</button>
      <button onClick={() => onAction('duplicate',automation)}><Copy/> Dupliquer</button>
      {automation.status === 'active'
        ? <button onClick={() => onAction('deactivate',automation)}><Power/> Désactiver</button>
        : <button onClick={() => onAction('approve',automation)}><CheckCircle2/> Valider et activer</button>}
      <button className="danger" onClick={() => onAction('delete',automation)}><Trash2/> Supprimer</button>
    </div>
  </article>;
}

export default function AutomationAssistant({ role }) {
  const [mode, setMode] = useState('simple');
  const [automations, setAutomations] = useState([]);
  const [schema, setSchema] = useState({});
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const isAdmin = role === 'Administrateur';

  async function reload() {
    setBusy(true);
    setMessage('');
    try {
      const [rows, availableSchema] = await Promise.all([
        listAutomationDefinitions(),
        loadAutomationSchema()
      ]);
      setAutomations(rows);
      setSchema(availableSchema);
    } catch (error) {
      setMessage(error.message || 'Assistant indisponible.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { if (isAdmin) reload(); }, [isAdmin]);

  const counts = useMemo(() => ({
    total: automations.length,
    pending: automations.filter(item => item.status === 'pending_validation').length,
    active: automations.filter(item => item.status === 'active').length
  }), [automations]);

  async function runAction(action, automation) {
    if (action === 'delete' && !window.confirm(`Supprimer « ${automation.name} »?`)) return;
    if (action === 'approve' && !window.confirm(`Valider et activer « ${automation.name} »?`)) return;
    setBusy(true);
    setMessage('');
    try {
      if (action === 'duplicate') await duplicateAutomationDefinition(automation);
      if (action === 'approve') await approveAutomationDefinition(automation.id);
      if (action === 'deactivate') await deactivateAutomationDefinition(automation.id);
      if (action === 'delete') await deleteAutomationDefinition(automation.id);
      await reload();
    } catch (error) {
      setMessage(error.message || 'Action impossible.');
      setBusy(false);
    }
  }

  if (!isAdmin) return <div className="automation-page"><div className="automation-message error">Accès réservé aux administrateurs.</div></div>;

  return <div className="automation-page">
    <header className="automation-hero">
      <div><span>Bloc 13.1</span><h1><Bot/> Assistant d’automatisation</h1><p>Documentez, validez et préparez les comportements métier sans SQL arbitraire.</p></div>
      <div className="automation-mode-switch"><button className={mode === 'simple' ? 'active' : ''} onClick={() => setMode('simple')}><Bot/> Mode simple</button><button className={mode === 'advanced' ? 'active' : ''} onClick={() => setMode('advanced')}><Link2/> Mode avancé</button></div>
    </header>

    {mode === 'advanced' ? <div className="automation-advanced"><div className="automation-safety-note"><ShieldCheck/><div><strong>Mode avancé</strong><span>Le Studio conserve ses paramètres techniques et ses fonctions existantes.</span></div></div><RelationsStudio role={role}/></div> : <>
      <div className="automation-toolbar"><div className="automation-metrics"><span><strong>{counts.total}</strong> automatisations</span><span><strong>{counts.pending}</strong> à valider</span><span><strong>{counts.active}</strong> actives</span></div><button onClick={() => setEditing(emptyAutomation())}><Plus/> Nouvelle automatisation</button></div>
      <div className="automation-safety-note"><ShieldCheck/><div><strong>Aucune exécution automatique</strong><span>Le Mode simple enregistre une configuration déclarative séparée des règles exécutables.</span></div></div>
      {message && <div className="automation-message error">{message}</div>}
      {editing && <AutomationForm initial={editing} schema={schema} onCancel={() => setEditing(null)} onSaved={() => {setEditing(null);reload();}}/>}
      {!editing && <div className="automation-grid">{automations.map(automation => <AutomationCard key={automation.id} automation={automation} onEdit={item => setEditing(structuredClone(item))} onAction={runAction}/>)}</div>}
      {!editing && !busy && !automations.length && <div className="automation-empty"><Bot/><h2>Aucune automatisation</h2><p>Créez un premier brouillon guidé.</p><button onClick={() => setEditing(emptyAutomation())}><Plus/> Créer</button></div>}
      {busy && <div className="automation-loading"><LoaderCircle className="spin"/> Chargement…</div>}
    </>}
  </div>;
}
