import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Bot, CheckCircle2, Copy, Edit3, Eye, FileClock, Filter,
  Link2, LoaderCircle, Plus, Power, Save, Search, Settings2, ShieldCheck,
  Trash2, X
} from 'lucide-react';
import RelationsStudio from './RelationsStudio';
import TerrainSyncDiagnostics from './TerrainSyncDiagnostics';
import ValidationCenter from './ValidationCenter';
import {
  approveAutomationDefinition, deactivateAutomationDefinition, deleteAutomationDefinition,
  duplicateAutomationDefinition, listAutomationDefinitions, saveAutomationDefinition
} from '../services/automationService';
import {
  deleteCrossModuleView, listCrossModuleViews, saveCrossModuleView, setCrossModuleViewStatus
} from '../services/crossModuleViewService';
import {
  automationAfterActions, automationConditions, automationModules, automationPriorities,
  automationRecipients, automationStatuses, automationTriggers, emptyAutomation, labelFor, moduleForKey
} from '../config/automationCatalog';
import {
  catalogLabel, conditionOperators, emptyCrossModuleView, fieldsByModule, viewDestinations,
  viewLocations, viewModes, viewModules, viewStatuses
} from '../config/crossModuleViewCatalog';
import {
  mergeSystemTemplates, TOS_AUTOMATION_TEMPLATES, TOS_VIEW_TEMPLATES
} from '../config/tosConfigurationTemplates';
import { friendlyError, UI_LABELS } from '../config/businessLanguage';

const toggle = (values, value) => values.includes(value)
  ? values.filter(item => item !== value)
  : [...values, value];

const CheckboxGroup = ({ catalog, values = [], onChange }) => (
  <div className="automation-check-grid">{catalog.map(([value, label]) => (
    <label key={value}><input type="checkbox" checked={values.includes(value)}
      onChange={() => onChange(toggle(values, value))}/><span>{label}</span></label>
  ))}</div>
);

function TemplateBadge({ visible }) {
  return visible ? <span className="tos-template-badge"><ShieldCheck size={13}/> {UI_LABELS.tosTemplate}</span> : null;
}

function AutomationPreview({ item, onClose }) {
  const definition = item.definition || {};
  return <div className="configuration-modal" role="dialog" aria-modal="true">
    <section>
      <button className="automation-icon-button modal-close" onClick={onClose} aria-label="Fermer"><X/></button>
      <TemplateBadge visible={item.isSystemTemplate}/>
      <h2>{item.name}</h2><p>{item.description || definition.description || 'Aucune description.'}</p>
      <div className="preview-summary">
        <div><span>{UI_LABELS.trigger}</span><strong>{(definition.triggers || []).map(value => labelFor(automationTriggers,value)).join(', ') || '—'}</strong></div>
        <div><span>Modules concernés</span><strong>{(definition.targets || []).map(target => moduleForKey(target.module)?.[1] || 'Module métier').join(', ') || '—'}</strong></div>
        <div><span>Conditions</span><strong>{(definition.conditions || []).map(value => labelFor(automationConditions,value)).join(', ') || 'Aucune'}</strong></div>
        <div><span>Actions</span><strong>{(definition.actions || definition.afterActions || []).join(', ') || 'Confirmation et historique'}</strong></div>
        <div><span>Notifications</span><strong>{(definition.notifications || []).map(value => labelFor(automationRecipients,value)).join(', ') || 'Aucune'}</strong></div>
        <div><span>État</span><strong>{labelFor(automationStatuses,item.status)}</strong></div>
      </div>
    </section>
  </div>;
}

function AutomationForm({ initial, onCancel, onSaved }) {
  const [draft, setDraft] = useState(() => structuredClone(initial || emptyAutomation()));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const patchDefinition = patch => setDraft(current => ({...current, definition:{...current.definition,...patch}}));
  const targetKeys = (draft.definition?.targets || []).map(target => target.module);
  const setTargets = keys => patchDefinition({targets:keys.map(module => ({module,fields:[]}))});

  async function submit(event) {
    event.preventDefault(); setBusy(true); setMessage('');
    try { await saveAutomationDefinition(draft); onSaved(); }
    catch (error) { setMessage(friendlyError(error, 'Impossible d’enregistrer cette automatisation.')); }
    finally { setBusy(false); }
  }

  return <form className="automation-form" onSubmit={submit}>
    <div className="automation-form-head"><div><h2>{draft.id ? 'Modifier l’automatisation' : 'Nouvelle automatisation'}</h2><p>L’activation demande toujours une confirmation distincte.</p></div><button type="button" className="automation-icon-button" onClick={onCancel}><X/></button></div>
    <section><h3>Informations générales</h3><label>Nom<input required maxLength={120} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label>Description<textarea value={draft.description || draft.definition?.description || ''} onChange={e=>{setDraft({...draft,description:e.target.value});patchDefinition({description:e.target.value});}}/></label></section>
    <section><h3>{UI_LABELS.trigger}</h3><CheckboxGroup catalog={automationTriggers} values={draft.definition?.triggers} onChange={triggers=>patchDefinition({triggers})}/></section>
    <section><h3>Modules concernés</h3><CheckboxGroup catalog={automationModules.map(([key,label])=>[key,label])} values={targetKeys} onChange={setTargets}/></section>
    <section><h3>Conditions</h3><CheckboxGroup catalog={automationConditions} values={draft.definition?.conditions} onChange={conditions=>patchDefinition({conditions})}/></section>
    <section><h3>Actions après traitement</h3><CheckboxGroup catalog={automationAfterActions} values={draft.definition?.afterActions} onChange={afterActions=>patchDefinition({afterActions})}/></section>
    <section><h3>Notifications</h3><CheckboxGroup catalog={automationRecipients} values={draft.definition?.notifications} onChange={notifications=>patchDefinition({notifications})}/></section>
    <div className="automation-form-pair"><section><h3>État</h3><select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value})}>{automationStatuses.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><small>Une demande d’activation reste à valider.</small></section><section><h3>Priorité</h3><select value={draft.priority} onChange={e=>setDraft({...draft,priority:e.target.value})}>{automationPriorities.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></section></div>
    {message&&<div className="automation-message error">{message}</div>}
    <div className="automation-form-actions"><button disabled={busy}>{busy?<LoaderCircle className="spin"/>:<Save/>} Enregistrer le brouillon</button><button type="button" className="secondary" onClick={onCancel}>Annuler</button></div>
  </form>;
}

function AutomationsTab({ rows, busy, reload }) {
  const [query,setQuery]=useState(''); const [status,setStatus]=useState('all');
  const [editing,setEditing]=useState(null); const [preview,setPreview]=useState(null);
  const [message,setMessage]=useState(''); const [history,setHistory]=useState(null);
  const allRows=useMemo(()=>mergeSystemTemplates(rows,TOS_AUTOMATION_TEMPLATES),[rows]);
  const filtered=allRows.filter(item=>(status==='all'||item.status===status)&&`${item.name} ${item.description||item.definition?.description||''}`.toLowerCase().includes(query.toLowerCase()));

  async function action(type,item) {
    if (item.isSystemTemplate) {
      if (type==='duplicate') setEditing({...structuredClone(item),id:undefined,isSystemTemplate:false,name:`${item.name} — copie`,status:'draft'});
      return;
    }
    if (type==='delete'&&!window.confirm(`Supprimer « ${item.name} »?`)) return;
    if (type==='approve'&&!window.confirm(`Activer « ${item.name} »?`)) return;
    try {
      if(type==='duplicate') await duplicateAutomationDefinition(item);
      if(type==='approve') await approveAutomationDefinition(item.id);
      if(type==='deactivate') await deactivateAutomationDefinition(item.id);
      if(type==='delete') await deleteAutomationDefinition(item.id);
      await reload(); setMessage('Action terminée avec succès.');
    } catch(error){setMessage(friendlyError(error));}
  }

  return <>
    <div className="automation-toolbar">
      <div className="configuration-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher une automatisation"/></div>
      <label className="configuration-filter"><Filter size={16}/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Tous les états</option>{automationStatuses.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <button onClick={()=>setEditing(emptyAutomation())}><Plus/> Nouvelle automatisation</button>
    </div>
    <div className="automation-safety-note"><ShieldCheck/><div><strong>Activation contrôlée</strong><span>Les {TOS_AUTOMATION_TEMPLATES.length} modèles TOS sont fournis en Brouillon et ne sont jamais activés automatiquement.</span></div></div>
    {message&&<div className="automation-message">{message}</div>}
    {editing?<AutomationForm initial={editing} onCancel={()=>setEditing(null)} onSaved={()=>{setEditing(null);reload();}}/>:
      <div className="automation-grid">{filtered.map(item=><article className="automation-card" key={item.id}>
        <div className="automation-card-head"><div><TemplateBadge visible={item.isSystemTemplate}/><h3>{item.name}</h3><p>{item.description||item.definition?.description||'Configuration métier'}</p></div><span className={`automation-status ${item.status}`}>{labelFor(automationStatuses,item.status)}</span></div>
        <dl><div><dt>{UI_LABELS.trigger}</dt><dd>{(item.definition?.triggers||[]).map(v=>labelFor(automationTriggers,v)).join(', ')||'—'}</dd></div><div><dt>Modules concernés</dt><dd>{(item.definition?.targets||[]).map(v=>moduleForKey(v.module)?.[1]||'Module métier').join(', ')||'—'}</dd></div><div><dt>Priorité</dt><dd>{labelFor(automationPriorities,item.priority)}</dd></div><div><dt>Dernière modification</dt><dd>{new Date(item.updated_at).toLocaleDateString('fr-CA')}</dd></div></dl>
        <div className="automation-card-actions"><button onClick={()=>setPreview(item)}><Eye/> Examiner</button>{!item.isSystemTemplate&&<button onClick={()=>setEditing(structuredClone(item))}><Edit3/> Modifier</button>}<button onClick={()=>action('duplicate',item)}><Copy/> Dupliquer</button>{!item.isSystemTemplate&&(item.status==='active'?<button onClick={()=>action('deactivate',item)}><Power/> Désactiver</button>:<button onClick={()=>action('approve',item)}><CheckCircle2/> Activer</button>)}{!item.isSystemTemplate&&<button onClick={()=>setHistory(item)}><FileClock/> Historique</button>}{!item.isSystemTemplate&&<button className="danger" onClick={()=>action('delete',item)}><Trash2/> Supprimer</button>}</div>
      </article>)}</div>}
    {busy&&<div className="automation-loading"><LoaderCircle className="spin"/> Chargement…</div>}
    {preview&&<AutomationPreview item={preview} onClose={()=>setPreview(null)}/>}
    {history&&<div className="configuration-modal"><section><button className="automation-icon-button modal-close" onClick={()=>setHistory(null)}><X/></button><h2>Historique</h2><p><strong>{history.name}</strong></p><div className="history-entry"><FileClock/><span>Dernière modification</span><strong>{new Date(history.updated_at).toLocaleString('fr-CA')}</strong></div><p className="automation-muted">Les modifications détaillées demeurent disponibles dans le journal d’audit administratif.</p></section></div>}
  </>;
}

function ViewPreview({ view, onClose }) {
  return <div className="configuration-modal"><section className="view-preview"><button className="automation-icon-button modal-close" onClick={onClose}><X/></button><TemplateBadge visible={view.isSystemTemplate}/><h2>Aperçu — {view.name}</h2><p>{catalogLabel(viewDestinations,view.destination)}</p><div className="preview-table"><div>{view.fields.map(field=><strong key={field.key}>{field.label}</strong>)}</div><div>{view.fields.map(field=><span key={field.key}>{field.emptyValue||'Exemple'}</span>)}</div></div><span className="mode-pill">{catalogLabel(viewModes,view.mode)}</span></section></div>;
}

function ViewForm({ initial, onCancel, onSaved }) {
  const [draft,setDraft]=useState(()=>structuredClone(initial||emptyCrossModuleView()));
  const [preview,setPreview]=useState(false); const [message,setMessage]=useState(''); const [busy,setBusy]=useState(false);
  const available=fieldsByModule[draft.source]||[];
  const selectField=(key,label)=>{
    const exists=draft.fields.some(item=>item.key===key);
    setDraft({...draft,fields:exists?draft.fields.filter(item=>item.key!==key):[...draft.fields,{key,label,width:180,visible:true,editable:false,format:'standard',emptyValue:'—'}]});
  };
  const patchField=(key,patch)=>setDraft({...draft,fields:draft.fields.map(field=>field.key===key?{...field,...patch}:field)});
  const move=(index,direction)=>{const next=[...draft.fields];const target=index+direction;if(target<0||target>=next.length)return;[next[index],next[target]]=[next[target],next[index]];setDraft({...draft,fields:next});};
  const addCondition=()=>setDraft({...draft,conditions:[...draft.conditions,{field:'status',operator:'equals',value:''}]});
  const patchCondition=(index,patch)=>setDraft({...draft,conditions:draft.conditions.map((condition,i)=>i===index?{...condition,...patch}:condition)});
  async function submit(event){event.preventDefault();setBusy(true);setMessage('');try{await saveCrossModuleView(draft);onSaved();}catch(error){setMessage(friendlyError(error));}finally{setBusy(false);}}

  return <form className="automation-form view-form" onSubmit={submit}>
    <div className="automation-form-head"><div><h2>{draft.id?'Modifier la vue':'Nouvelle vue entre les tables'}</h2><p>Choisissez les informations utiles et leur contexte d’affichage.</p></div><button type="button" className="automation-icon-button" onClick={onCancel}><X/></button></div>
    <section><h3>Informations générales</h3><div className="view-form-grid"><label>Nom<input required value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label>État<select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value})}>{viewStatuses.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label className="span-two">Description<textarea value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label><label>Priorité d’affichage<input type="number" min="1" max="999" value={draft.priority==='normal'?100:draft.priority} onChange={e=>setDraft({...draft,priority:e.target.value})}/></label></div></section>
    <section><h3>Parcours des informations</h3><div className="view-form-grid"><label>{UI_LABELS.sourceModule}<select required value={draft.source} onChange={e=>setDraft({...draft,source:e.target.value,fields:[]})}><option value="">Choisir un module</option>{viewModules.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>{UI_LABELS.destinationModule}<select required value={draft.destination} onChange={e=>setDraft({...draft,destination:e.target.value})}><option value="">Choisir un emplacement</option>{viewDestinations.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></div></section>
    <section><h3>Champs à afficher</h3>{!draft.source?<p className="automation-muted">Choisissez d’abord la provenance des informations.</p>:<CheckboxGroup catalog={available} values={draft.fields.map(field=>field.key)} onChange={keys=>{const selected=new Set(draft.fields.map(field=>field.key));const changed=available.find(([key])=>selected.has(key)!==keys.includes(key));if(changed)selectField(...changed);}}/>}<div className="selected-fields">{draft.fields.map((field,index)=><article key={field.key}><div className="field-order"><button type="button" onClick={()=>move(index,-1)}>↑</button><button type="button" onClick={()=>move(index,1)}>↓</button></div><label>Titre affiché<input value={field.label} onChange={e=>patchField(field.key,{label:e.target.value})}/></label><label>Largeur<input type="number" min="80" max="600" value={field.width} onChange={e=>patchField(field.key,{width:Number(e.target.value)})}/></label><label>Format<select value={field.format} onChange={e=>patchField(field.key,{format:e.target.value})}><option value="standard">Standard</option><option value="date">Date</option><option value="number">Nombre</option><option value="image">Image</option><option value="status">État</option></select></label><label>Valeur vide<input value={field.emptyValue} onChange={e=>patchField(field.key,{emptyValue:e.target.value})}/></label><label className="inline-check"><input type="checkbox" checked={field.visible} onChange={e=>patchField(field.key,{visible:e.target.checked})}/> Visible</label><label className="inline-check"><input type="checkbox" checked={field.editable} onChange={e=>patchField(field.key,{editable:e.target.checked})}/> Modifiable</label><button type="button" className="danger icon-only" onClick={()=>selectField(field.key,field.label)}><Trash2 size={16}/></button></article>)}</div></section>
    <section><h3>Afficher cette vue dans</h3><CheckboxGroup catalog={viewLocations} values={draft.locations} onChange={locations=>setDraft({...draft,locations})}/></section>
    <section><h3>Mode d’utilisation</h3><div className="mode-options">{viewModes.map(([value,label])=><label key={value}><input type="radio" name="mode" checked={draft.mode===value} onChange={()=>setDraft({...draft,mode:value})}/><span>{label}</span></label>)}</div></section>
    <section><div className="section-heading"><h3>Conditions d’affichage</h3><button type="button" className="secondary" onClick={addCondition}><Plus/> Ajouter une condition</button></div>{draft.conditions.length>1&&<select value={draft.conditionMode} onChange={e=>setDraft({...draft,conditionMode:e.target.value})}><option value="all">Toutes les conditions</option><option value="any">Au moins une condition</option></select>}<div className="conditions-builder">{draft.conditions.map((condition,index)=><div key={index}><select value={condition.field} onChange={e=>patchCondition(index,{field:e.target.value})}>{available.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><select value={condition.operator} onChange={e=>patchCondition(index,{operator:e.target.value})}>{conditionOperators.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><input value={condition.value} disabled={['empty','not_empty'].includes(condition.operator)} onChange={e=>patchCondition(index,{value:e.target.value})}/><button type="button" className="danger icon-only" onClick={()=>setDraft({...draft,conditions:draft.conditions.filter((_,i)=>i!==index)})}><Trash2/></button></div>)}</div></section>
    {message&&<div className="automation-message error">{message}</div>}
    <div className="automation-form-actions"><button type="button" className="secondary" onClick={()=>setPreview(true)}><Eye/> Prévisualiser</button><button disabled={busy}>{busy?<LoaderCircle className="spin"/>:<Save/>} Enregistrer le brouillon</button><button type="button" className="secondary" onClick={onCancel}>Annuler</button></div>
    {preview&&<ViewPreview view={draft} onClose={()=>setPreview(false)}/>}
  </form>;
}

function ViewsTab({ rows, busy, reload }) {
  const [query,setQuery]=useState('');const[editing,setEditing]=useState(null);const[preview,setPreview]=useState(null);const[message,setMessage]=useState('');
  const allRows=useMemo(()=>mergeSystemTemplates(rows,TOS_VIEW_TEMPLATES),[rows]);
  const filtered=allRows.filter(item=>`${item.name} ${item.description}`.toLowerCase().includes(query.toLowerCase()));
  async function action(type,item){
    if(item.isSystemTemplate){if(type==='duplicate')setEditing({...structuredClone(item),id:undefined,isSystemTemplate:false,name:`${item.name} — copie`,status:'draft'});return;}
    if(type==='delete'&&!window.confirm(`Supprimer « ${item.name} »?`))return;
    try{if(type==='duplicate')setEditing({...structuredClone(item),id:undefined,name:`${item.name} — copie`,status:'draft'});if(type==='active')await setCrossModuleViewStatus(item.id,'active');if(type==='inactive')await setCrossModuleViewStatus(item.id,'inactive');if(type==='delete')await deleteCrossModuleView(item.id);if(!['duplicate'].includes(type))await reload();}catch(error){setMessage(friendlyError(error));}
  }
  return <>
    <div className="automation-toolbar"><div className="configuration-search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher une vue"/></div><button onClick={()=>setEditing(emptyCrossModuleView())}><Plus/> Nouvelle vue</button></div>
    <div className="automation-safety-note"><ShieldCheck/><div><strong>Modèles sans risque</strong><span>Les {TOS_VIEW_TEMPLATES.length} vues TOS restent en Brouillon jusqu’à une activation explicite.</span></div></div>
    {message&&<div className="automation-message error">{message}</div>}
    {editing?<ViewForm initial={editing} onCancel={()=>setEditing(null)} onSaved={()=>{setEditing(null);reload();}}/>:<div className="views-table-wrap"><table className="views-table"><thead><tr><th>Nom de la vue</th><th>{UI_LABELS.sourceModule}</th><th>{UI_LABELS.destinationModule}</th><th>Champs visibles</th><th>Mode</th><th>État</th><th>Actions</th></tr></thead><tbody>{filtered.map(item=><tr key={item.id}><td><TemplateBadge visible={item.isSystemTemplate}/><strong>{item.name}</strong><small>{item.description}</small></td><td>{catalogLabel(viewModules,item.source)}</td><td>{catalogLabel(viewDestinations,item.destination)}</td><td>{item.fields.length}</td><td>{catalogLabel(viewModes,item.mode)}</td><td><span className={`automation-status ${item.status}`}>{catalogLabel(viewStatuses,item.status)}</span></td><td><div className="automation-card-actions"><button onClick={()=>setPreview(item)}><Eye/> Examiner</button>{!item.isSystemTemplate&&<button onClick={()=>setEditing(structuredClone(item))}><Edit3/> Modifier</button>}<button onClick={()=>action('duplicate',item)}><Copy/> Dupliquer</button>{!item.isSystemTemplate&&(item.status==='active'?<button onClick={()=>action('inactive',item)}><Power/> Désactiver</button>:<button onClick={()=>action('active',item)}><CheckCircle2/> Activer</button>)}{!item.isSystemTemplate&&<button className="danger" onClick={()=>action('delete',item)}><Trash2/> Supprimer</button>}</div></td></tr>)}</tbody></table></div>}
    {busy&&<div className="automation-loading"><LoaderCircle className="spin"/> Chargement…</div>}
    {preview&&<ViewPreview view={preview} onClose={()=>setPreview(null)}/>}
  </>;
}

function AdvancedSection({ role, onClose }) {
  const [tool,setTool]=useState('relations');
  if(role!=='Administrateur')return <div className="automation-message error">Cette section est réservée aux administrateurs autorisés.</div>;
  return <div className="advanced-section"><button className="secondary back-button" onClick={onClose}>← Retour au centre de configuration</button><div className="advanced-warning"><AlertTriangle/><div><strong>Cette section modifie le fonctionnement interne du logiciel.</strong><span>Elle est réservée aux administrateurs expérimentés. Vérifiez chaque changement avant de l’enregistrer.</span></div></div><nav className="advanced-categories"><button className={tool==='relations'?'active':''} onClick={()=>setTool('relations')}>Studio des relations</button><button className={tool==='sync'?'active':''} onClick={()=>setTool('sync')}>Synchronisations et diagnostics</button><button className={tool==='validation'?'active':''} onClick={()=>setTool('validation')}>Validation</button></nav>{tool==='relations'&&<RelationsStudio role={role}/>} {tool==='sync'&&<TerrainSyncDiagnostics role={role}/>} {tool==='validation'&&<ValidationCenter role={role}/>}</div>;
}

export default function AutomationAssistant({ role }) {
  const [tab,setTab]=useState('automations');const[advanced,setAdvanced]=useState(false);
  const [automations,setAutomations]=useState([]);const[views,setViews]=useState([]);const[busy,setBusy]=useState(true);const[message,setMessage]=useState('');
  const isAdmin=role==='Administrateur';
  async function reload(){setBusy(true);setMessage('');try{const[a,v]=await Promise.all([listAutomationDefinitions(),listCrossModuleViews()]);setAutomations(a);setViews(v);}catch(error){setMessage(friendlyError(error,'Le centre de configuration est momentanément indisponible.'));}finally{setBusy(false);}}
  useEffect(()=>{if(isAdmin)reload();},[isAdmin]);
  if(!isAdmin)return <div className="automation-page"><div className="automation-message error">Accès réservé aux administrateurs.</div></div>;
  if(advanced)return <div className="automation-page"><AdvancedSection role={role} onClose={()=>setAdvanced(false)}/></div>;
  return <div className="automation-page">
    <header className="automation-hero"><div><span>Centre de configuration</span><h1><Bot/> Automatisations</h1><p>Configurez les comportements et les vues métier dans un espace clair et sécurisé.</p></div><button className="advanced-button" onClick={()=>setAdvanced(true)}><Settings2/> {UI_LABELS.advancedSection}</button></header>
    <nav className="configuration-tabs" aria-label="Sections de configuration"><button className={tab==='automations'?'active':''} onClick={()=>setTab('automations')}><Bot/> Automatisations</button><button className={tab==='views'?'active':''} onClick={()=>setTab('views')}><Link2/> Vues entre les tables</button></nav>
    {message&&<div className="automation-message error">{message}</div>}
    {tab==='automations'?<AutomationsTab rows={automations} busy={busy} reload={reload}/>:<ViewsTab rows={views} busy={busy} reload={reload}/>}
  </div>;
}
