import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Save, ShieldAlert, Undo2 } from 'lucide-react';
import useFieldDisplayDraft from '../../hooks/useFieldDisplayDraft.js';
import { fieldStatusLabel } from '../../lib/fieldCatalogPresentation.js';
import DisplayInheritanceChoice from './display/DisplayInheritanceChoice.jsx';
import FieldDisplayAdminPreview from './display/FieldDisplayAdminPreview.jsx';
import '../../features/v13/field-catalog-display.css';

export default function FieldCatalogDisplayTab({
  field,
  role,
  catalogFields,
  onSaved,
  onDirtyChange,
  onSaveActionChange
}) {
  const messageRef = useRef(null);
  const state = useFieldDisplayDraft({
    field,
    role,
    catalogFields,
    onSaved,
    onDirtyChange
  });

  useEffect(() => {
    onSaveActionChange?.(state.save);
    return () => onSaveActionChange?.(null);
  }, [onSaveActionChange, state.save]);

  useEffect(() => {
    if (state.status === 'error') messageRef.current?.focus();
  }, [state.status, state.message]);

  async function submit(event) {
    event.preventDefault();
    await state.save();
  }

  const disabled = state.protectedField || state.submitting;
  const statusClass = state.status === 'error'
    ? 'error'
    : state.status === 'saved'
      ? 'success'
      : state.status === 'no_change'
        ? 'info'
        : 'info';

  return <form
    className="field-display-form"
    onSubmit={submit}
    aria-busy={state.submitting}
  >
    <header className="field-display-header">
      <div>
        <h3>Affichage</h3>
        <p>Préparez la présentation future de ce champ. Aucun réglage n’est actif actuellement.</p>
      </div>
      <div className="field-display-draft-banner" role="status">
        Brouillon sans effet immédiat
      </div>
    </header>

    <section className="field-display-identity" aria-label="Champ sélectionné">
      <div><span>Table</span><strong>{field.tableName}</strong></div>
      <div><span>Nom technique</span><strong>{field.technicalName}</strong></div>
      <div><span>Statut</span><strong>{fieldStatusLabel(field.configurationStatus)}</strong></div>
      <div>
        <span>Protection</span>
        <strong>{state.protectedField ? 'Protégé' : 'Configurable'}</strong>
      </div>
    </section>

    {state.protectedField && <aside className="field-display-protected" role="note">
      <ShieldAlert size={20}/>
      <div>
        <strong>Ce champ est protégé et ne peut pas être configuré.</strong>
        <span>Raison principale : {state.protectionReasons[0]}</span>
        {state.protectionReasons.length > 1 && <ul>
          {state.protectionReasons.slice(1).map(reason => <li key={reason}>{reason}</li>)}
        </ul>}
      </div>
    </aside>}

    <section className="field-display-section" aria-labelledby="field-display-visibility-title">
      <h4 id="field-display-visibility-title">Visibilité</h4>
      <p id="field-display-visibility-help">
        Hériter conserve le comportement historique. Ces réglages restent en brouillon.
      </p>
      <DisplayInheritanceChoice
        legend="Grille"
        name={`display-grid-${field.fieldId}`}
        value={state.draft.showInGrid}
        onChange={value => state.patchChoice('showInGrid', value)}
        disabled={disabled}
        descriptionId="field-display-visibility-help"
      />
      <DisplayInheritanceChoice
        legend="Formulaire"
        name={`display-form-${field.fieldId}`}
        value={state.draft.showInForm}
        onChange={value => state.patchChoice('showInForm', value)}
        disabled={disabled}
        descriptionId="field-display-visibility-help"
      />
      <DisplayInheritanceChoice
        legend="Fiche 360"
        name={`display-360-${field.fieldId}`}
        value={state.draft.showIn360}
        onChange={value => state.patchChoice('showIn360', value)}
        disabled={disabled}
        descriptionId="field-display-visibility-help"
      />
    </section>

    <section className="field-display-section" aria-labelledby="field-display-order-title">
      <h4 id="field-display-order-title">Ordre d’affichage</h4>
      <label className="field-display-order">
        <span>Ordre général facultatif</span>
        <input
          type="text"
          inputMode="numeric"
          value={state.rawDisplayOrder}
          disabled={disabled}
          aria-invalid={Boolean(state.errors.displayOrder)}
          aria-describedby={[
            'field-display-order-help',
            state.errors.displayOrder ? 'field-display-order-error' : ''
          ].filter(Boolean).join(' ')}
          onChange={event => state.patchDisplayOrder(event.target.value)}
        />
      </label>
      <p id="field-display-order-help">
        Laissez vide pour hériter. Valeur entière de 0 à 100000. Les collisions sont permises
        et aucun autre champ n’est renuméroté. L’ordre PostgreSQL et l’ordre Terrain ne changent pas.
      </p>
      {state.errors.displayOrder && <p id="field-display-order-error" className="field-display-field-error">
        {state.errors.displayOrder}
      </p>}
      {state.collision && <div className="field-display-collision" role="status">
        <AlertTriangle size={18}/>
        <span>
          Un autre champ utilise déjà cet ordre ({state.collision.technicalName}).
          La sauvegarde reste permise.
        </span>
      </div>}
    </section>

    <section className="field-display-section" aria-labelledby="field-display-readonly-title">
      <h4 id="field-display-readonly-title">Lecture seule</h4>
      <p id="field-display-readonly-help">
        Oui ajoute une restriction. Non ne retire jamais une protection existante.
        La sécurité serveur demeure prioritaire. Ce réglage ne concerne ni Terrain,
        ni les imports, ni les exports.
      </p>
      <DisplayInheritanceChoice
        legend="Lecture seule générale"
        name={`display-readonly-${field.fieldId}`}
        value={state.draft.readonlyOverride}
        onChange={value => state.patchChoice('readonlyOverride', value)}
        disabled={disabled}
        descriptionId="field-display-readonly-help"
        labels={['Hériter', 'Oui', 'Non']}
      />
    </section>

    <FieldDisplayAdminPreview
      field={field}
      localDraft={state.draft}
      storedDraft={state.initial}
      catalogFields={catalogFields}
      protectedField={state.protectedField}
      protectionReasons={state.protectionReasons}
    />

    {state.message && <div
      ref={messageRef}
      className={`field-display-message ${statusClass}`}
      role={state.status === 'error' ? 'alert' : 'status'}
      aria-live={state.status === 'error' ? 'assertive' : 'polite'}
      tabIndex={state.status === 'error' ? -1 : undefined}
    >
      {state.message}
    </div>}

    <div className="field-display-actions">
      <button
        type="button"
        className="secondary"
        disabled={!state.dirty || state.submitting}
        onClick={state.cancel}
      >
        <Undo2 size={17}/> Annuler
      </button>
      <button
        type="submit"
        disabled={!state.dirty || state.protectedField || state.submitting}
      >
        <Save size={17}/>
        {state.submitting ? 'Enregistrement…' : 'Enregistrer le brouillon'}
      </button>
    </div>
  </form>;
}
