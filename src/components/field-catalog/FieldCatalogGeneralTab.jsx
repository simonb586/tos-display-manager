import React, { useEffect, useMemo, useState } from 'react';
import { Save, ShieldAlert, Undo2 } from 'lucide-react';
import {
  FIELD_CATALOG_FUNCTIONAL_TYPES,
  fieldDraftChanged,
  fieldGeneralDraft,
  isProtectedCatalogField
} from '../../lib/fieldCatalogDraft';
import { booleanDisplayValue, fieldDisplayValue, fieldStatusLabel } from '../../lib/fieldCatalogPresentation';
import { saveFieldGeneralDraft } from '../../services/fieldCatalogWriteService';
import { validateFieldGeneralDraft } from '../../services/fieldCatalogValidationService';
import '../../features/v13/field-catalog-general.css';

export default function FieldCatalogGeneralTab({ field, role, onSaved, onDirtyChange }) {
  const initial = useMemo(() => fieldGeneralDraft(field), [field]);
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const dirty = fieldDraftChanged(initial, draft);
  const protectedField = isProtectedCatalogField(field);

  useEffect(() => {
    setDraft(initial);
    setErrors({});
    setStatus('idle');
    setMessage('');
  }, [initial]);
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return undefined;
    const preventLoss = event => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', preventLoss);
    return () => window.removeEventListener('beforeunload', preventLoss);
  }, [dirty]);

  function patch(name, value) {
    setDraft(current => ({ ...current, [name]: value }));
    setMessage('');
    setErrors(current => ({ ...current, [name]: undefined }));
  }

  function cancel() {
    setDraft(initial);
    setErrors({});
    setMessage('Modifications annulées.');
    setStatus('idle');
  }

  async function save(event) {
    event.preventDefault();
    const validation = validateFieldGeneralDraft(field, draft, role);
    setErrors(validation.errors);
    if (!validation.valid) {
      setStatus('error');
      setMessage(Object.values(validation.errors)[0]);
      return;
    }
    setStatus('saving');
    setMessage('');
    try {
      await saveFieldGeneralDraft({ field, draft, role });
      await onSaved?.(field.fieldId, draft);
      setStatus('saved');
      setMessage('Brouillon enregistré.');
    } catch (error) {
      setStatus('error');
      setErrors(error.validationErrors || {});
      setMessage(error.message || 'Le brouillon n’a pas pu être enregistré.');
    }
  }

  return <>
    <form className="field-catalog-general-form" onSubmit={save}>
      {protectedField && <div className="field-catalog-protected"><ShieldAlert size={18}/><span>Ce champ système ou identifiant technique est protégé et ne peut pas être modifié.</span></div>}
      <div className="field-catalog-edit-grid">
        <label>Table<input value={draft.tableName} readOnly aria-readonly="true"/></label>
        <label>Nom technique<input value={draft.technicalName} readOnly aria-readonly="true"/></label>
        <label>Libellé<input value={draft.fieldLabel} disabled={protectedField} onChange={event => patch('fieldLabel', event.target.value)}/>{errors.fieldLabel && <small>{errors.fieldLabel}</small>}</label>
        <label>Type fonctionnel<select value={draft.fieldType} disabled={protectedField} onChange={event => patch('fieldType', event.target.value)}><option value="">Sélectionner un type</option>{FIELD_CATALOG_FUNCTIONAL_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select>{errors.fieldType && <small>{errors.fieldType}</small>}</label>
        <label className="wide">Texte d’aide<textarea value={draft.helpText} disabled={protectedField} onChange={event => patch('helpText', event.target.value)} maxLength={4000}/>{errors.helpText && <small>{errors.helpText}</small>}</label>
        <label>Ordre d’affichage<input type="number" min="0" max="100000" step="1" value={draft.displayOrder} disabled={protectedField} onChange={event => patch('displayOrder', event.target.value)}/>{errors.displayOrder && <small>{errors.displayOrder}</small>}</label>
        <label>Statut<input value="Brouillon" readOnly aria-readonly="true"/></label>
      </div>
      {message && <div className={`field-catalog-save-message ${status === 'error' ? 'error' : 'success'}`} role="status">{message}</div>}
      <div className="field-catalog-draft-actions">
        <button type="button" className="secondary" disabled={!dirty || status === 'saving'} onClick={cancel}><Undo2 size={17}/> Annuler</button>
        <button type="submit" disabled={!dirty || protectedField || status === 'saving'}><Save size={17}/> {status === 'saving' ? 'Enregistrement…' : 'Enregistrer le brouillon'}</button>
      </div>
    </form>
    <h3 className="field-catalog-physical-title">Métadonnées physiques</h3>
    <div className="field-catalog-detail-grid">
      <Detail label="Type PostgreSQL" value={field.physical.dataType}/><Detail label="Type interne PostgreSQL" value={field.physical.udtName}/>
      <Detail label="Statut actuel" value={fieldStatusLabel(field.configurationStatus)}/><Detail label="Position physique" value={field.physical.ordinalPosition}/>
      <Detail label="Nullable" value={booleanDisplayValue(field.physical.nullable)}/><Detail label="Valeur par défaut" value={field.physical.defaultValue}/>
      <Detail label="Longueur maximale" value={field.physical.maximumLength}/><Detail label="Précision numérique" value={field.physical.numericPrecision}/>
      <Detail label="Échelle numérique" value={field.physical.numericScale}/><Detail label="Clé primaire" value={booleanDisplayValue(field.primaryKey)}/>
      <Detail label="Unique" value={booleanDisplayValue(field.unique)}/><Detail label="Clé étrangère" value={booleanDisplayValue(field.foreignKey)}/>
      <Detail label="Référence" value={field.physical.foreignTable ? `${field.physical.foreignTable}.${field.physical.foreignColumn}` : null}/>
      <Detail label="Champ généré" value={booleanDisplayValue(field.generated)}/><Detail label="Expression générée" value={field.physical.generationExpression}/>
      <Detail label="Identité" value={booleanDisplayValue(field.physical.identity)}/><Detail label="Système" value={booleanDisplayValue(field.system)}/>
      <Detail label="Lecture seule" value={booleanDisplayValue(field.readOnly)}/>
    </div>
  </>;
}

function Detail({ label, value }) {
  return <div><span>{label}</span><strong>{fieldDisplayValue(value)}</strong></div>;
}
