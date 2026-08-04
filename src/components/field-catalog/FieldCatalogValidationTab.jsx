import React, { useEffect, useRef } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, Plus, Save, Trash2, Undo2 } from 'lucide-react';
import useFieldValidationDraft from '../../hooks/useFieldValidationDraft.js';
import {
  compatibleValidationKeys,
  VALIDATION_MESSAGE_KEYS
} from '../../lib/fieldCatalogValidationDraft.js';
import DisplayInheritanceChoice from './display/DisplayInheritanceChoice.jsx';
import FieldValidationAdminPreview from './validation/FieldValidationAdminPreview.jsx';
import '../../features/v13/field-catalog-validation.css';

const integerValue = raw => raw === '' ? null : /^[0-9]+$/.test(raw) ? Number(raw) : raw;
const decimalValue = raw => raw === '' ? null :
  /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw) ? Number(raw) : raw;
const allowedNumberValue = raw =>
  /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw) ? Number(raw) : Number.NaN;
const show = (compatible, key, value) => compatible.includes(key) || value !== null;

export default function FieldCatalogValidationTab({ field, role, onSaved, onDirtyChange, onSaveActionChange }) {
  const state = useFieldValidationDraft({ field, role, onSaved, onDirtyChange });
  const alertRef = useRef(null);
  const compatible = compatibleValidationKeys(field);
  useEffect(() => {
    onSaveActionChange?.(state.save);
    return () => onSaveActionChange?.(null);
  }, [onSaveActionChange, state.save]);
  useEffect(() => {
    if (state.status === 'error' || state.status === 'stale_draft') alertRef.current?.focus();
  }, [state.status, state.message]);

  const disabled = state.protectedField || state.submitting;
  const allowed = state.draft.allowedValues || [];
  const messages = state.draft.errorMessages || {};
  const patchAllowed = next => state.patch('allowedValues', next.length ? next : null);
  const updateAllowed = (index, value) => patchAllowed(allowed.map((item, i) => i === index ? value : item));
  const moveAllowed = (index, direction) => {
    const next = [...allowed];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    patchAllowed(next);
  };
  const patchMessage = (key, value) => {
    const next = { ...messages };
    if (value === '') delete next[key]; else next[key] = value;
    state.patch('errorMessages', Object.keys(next).length ? next : null);
  };

  return <form className="field-validation-form" aria-busy={state.submitting} onSubmit={event => {
    event.preventDefault(); state.save();
  }}>
    <header><h3>Validation</h3><p>Brouillon sans effet immédiat.</p></header>
    {state.protectedField && <aside className="field-validation-warning" role="note">
      <AlertTriangle/><div><strong>Champ protégé — configuration en lecture seule.</strong>
        <ul>{state.protectionReasons.map(reason => <li key={reason}>{reason}</li>)}</ul></div>
    </aside>}

    <section><h4>Exigence</h4>
      <DisplayInheritanceChoice legend="Valeur obligatoire" name={`validation-required-${field.fieldId}`}
        value={state.draft.requiredOverride} onChange={value => state.patch('requiredOverride', value)}
        disabled={disabled} labels={['Hériter','Requis','Non requis']}/>
      <p>Non requis ne contourne aucune contrainte physique, serveur ou de permission.</p>
    </section>

    {(show(compatible,'minimumLength',state.draft.minimumLength) ||
      show(compatible,'maximumLength',state.draft.maximumLength)) && <section>
      <h4>Longueurs</h4><div className="field-validation-pair">
        {show(compatible,'minimumLength',state.draft.minimumLength) && <label>Longueur minimale
          <input type="text" inputMode="numeric" disabled={disabled}
            value={state.draft.minimumLength ?? ''}
            aria-invalid={Boolean(state.errors.minimumLength)}
            aria-describedby={state.errors.minimumLength ? 'validation-min-length-error' : undefined}
            onChange={e => state.patch('minimumLength', integerValue(e.target.value))}/>
          {state.errors.minimumLength && <span id="validation-min-length-error">{state.errors.minimumLength}</span>}
        </label>}
        {show(compatible,'maximumLength',state.draft.maximumLength) && <label>Longueur maximale
          <input type="text" inputMode="numeric" disabled={disabled}
            value={state.draft.maximumLength ?? ''}
            aria-invalid={Boolean(state.errors.maximumLength)}
            aria-describedby={state.errors.maximumLength ? 'validation-max-length-error' : undefined}
            onChange={e => state.patch('maximumLength', integerValue(e.target.value))}/>
          {state.errors.maximumLength && <span id="validation-max-length-error">{state.errors.maximumLength}</span>}
        </label>}
      </div><p>Entiers positifs ou nuls. Aucun tronquage automatique.</p>
    </section>}

    {(show(compatible,'minimumValue',state.draft.minimumValue) ||
      show(compatible,'maximumValue',state.draft.maximumValue)) && <section>
      <h4>Bornes numériques</h4><div className="field-validation-pair">
        {show(compatible,'minimumValue',state.draft.minimumValue) && <label>Valeur minimale
          <input type="text" inputMode="decimal" disabled={disabled} value={state.draft.minimumValue ?? ''}
            aria-invalid={Boolean(state.errors.minimumValue)}
            onChange={e => state.patch('minimumValue', decimalValue(e.target.value))}/>
        </label>}
        {show(compatible,'maximumValue',state.draft.maximumValue) && <label>Valeur maximale
          <input type="text" inputMode="decimal" disabled={disabled} value={state.draft.maximumValue ?? ''}
            aria-invalid={Boolean(state.errors.maximumValue)}
            onChange={e => state.patch('maximumValue', decimalValue(e.target.value))}/>
        </label>}
      </div><p>Limites inclusives. Aucun arrondi ou conversion silencieuse.</p>
    </section>}

    {show(compatible,'allowedValues',state.draft.allowedValues) && <section>
      <h4>Valeurs permises</h4>
      <p>{allowed.length}/100 valeurs · ordre significatif · types stricts.</p>
      <div className="field-validation-values">
        {allowed.map((value,index) => <div key={index}>
          <select disabled={disabled} aria-label={`Type de la valeur ${index + 1}`}
            value={typeof value} onChange={e => {
              const type=e.target.value;
              updateAllowed(index,type==='number'?0:type==='boolean'?false:'');
            }}>
            <option value="string">Texte</option><option value="number">Nombre</option><option value="boolean">Booléen</option>
          </select>
          {typeof value === 'boolean'
            ? <select disabled={disabled} value={String(value)} onChange={e => updateAllowed(index,e.target.value==='true')}>
              <option value="true">Oui</option><option value="false">Non</option></select>
            : <input disabled={disabled} value={typeof value==='number' && Number.isNaN(value)?'':value}
              aria-label={`Valeur permise ${index + 1}`}
              onChange={e => updateAllowed(index,typeof value==='number'?allowedNumberValue(e.target.value):e.target.value)}/>}
          <button type="button" disabled={disabled || index===0} aria-label="Monter" onClick={() => moveAllowed(index,-1)}><ArrowUp/></button>
          <button type="button" disabled={disabled || index===allowed.length-1} aria-label="Descendre" onClick={() => moveAllowed(index,1)}><ArrowDown/></button>
          <button type="button" disabled={disabled} aria-label="Supprimer" onClick={() => patchAllowed(allowed.filter((_,i)=>i!==index))}><Trash2/></button>
        </div>)}
      </div>
      <button type="button" disabled={disabled || allowed.length>=100} onClick={() => patchAllowed([...allowed,''])}><Plus/> Ajouter une valeur</button>
      {state.errors.allowedValues && <p className="field-validation-error">{state.errors.allowedValues}</p>}
    </section>}

    <section><h4>Messages d’erreur</h4>
      <div className="field-validation-messages">{VALIDATION_MESSAGE_KEYS.map(key => {
        const rule = key === 'errorMessages' || compatible.includes(key);
        const existing = Object.prototype.hasOwnProperty.call(messages,key);
        if (!rule && !existing) return null;
        const value = messages[key] || '';
        return <label key={key} className={!rule ? 'incompatible' : ''}>{key}
          {!rule && <small>Règle historique incompatible — correction requise.</small>}
          <textarea disabled={disabled} value={value} maxLength={600}
            onChange={e => patchMessage(key,e.target.value)}/>
          <small>{Array.from(value).length}/300 points de code</small>
        </label>;
      })}</div>
      {state.errors.errorMessages && <p className="field-validation-error">{state.errors.errorMessages}</p>}
    </section>

    <FieldValidationAdminPreview field={field} draft={state.draft}
      compatible={compatible} protectedField={state.protectedField}/>

    {state.message && <div ref={alertRef} tabIndex={-1}
      className={`field-validation-status ${state.status}`}
      role={['error','stale_draft'].includes(state.status)?'alert':'status'}>
      {state.message}
      {state.status === 'stale_draft' && <button type="button" onClick={() => onSaved?.(field.fieldId)}>
        Recharger le brouillon
      </button>}
    </div>}
    <div className="field-validation-actions">
      <button type="button" disabled={!state.dirty || state.submitting} onClick={state.cancel}><Undo2/> Annuler</button>
      <button type="submit" disabled={!state.dirty || disabled || !state.validation.valid}><Save/>
        {state.submitting?'Enregistrement…':'Enregistrer le brouillon'}</button>
    </div>
  </form>;
}
