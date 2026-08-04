import React, { useMemo, useState } from 'react';
import {
  DISPLAY_PREVIEW_SURFACES,
  previewFallbacks,
  projectDisplayPreview
} from '../../../lib/displayAdminPreviewProjection.mjs';

const viewLabels = {
  grid: 'Grille',
  form: 'Formulaire',
  360: 'Fiche 360'
};

const triStateLabel = value => value === null ? 'Hérité dans cet aperçu' : value ? 'Oui' : 'Non';
const orderLabel = value => value === null ? 'Position par défaut simulée' : String(value);

function PreviewFacts({ model }) {
  return <dl className="field-display-preview-facts">
    <div><dt>Valeur locale actuelle</dt><dd>{triStateLabel(model.localVisibility)}</dd></div>
    <div><dt>Valeur enregistrée</dt><dd>{triStateLabel(model.storedVisibility)}</dd></div>
    <div><dt>Valeur effective simulée</dt><dd>{model.effectiveVisibility ? 'Affiché' : 'Masqué'}</dd></div>
    <div><dt>Ordre simulé</dt><dd>{orderLabel(model.requestedOrder)} — position {model.simulatedPosition}</dd></div>
    <div><dt>Édition simulée</dt><dd>{model.effectiveReadonly ? 'Lecture seule' : 'Modifiable dans cet aperçu'}</dd></div>
  </dl>;
}

function HiddenMessage({ surface }) {
  return <p className="field-display-preview-hidden" role="status">
    Ce champ serait masqué dans {surface === 'grid' ? 'la grille' : surface === 'form' ? 'le formulaire' : 'la fiche 360'}.
  </p>;
}

function GridPreview({ model }) {
  if (!model.visible) return <HiddenMessage surface="grid"/>;
  const selected = <div className="field-display-preview-column selected" key="selected">
    <strong>{model.label}</strong>
    <span>{model.demoValue}</span>
    <span>{model.effectiveReadonly ? 'Cellule en lecture seule' : 'Cellule fictive modifiable'}</span>
  </div>;
  const columns = [
    <div className="field-display-preview-column" key="before"><strong>Colonne exemple A</strong><span>ABC-123</span></div>,
    selected,
    <div className="field-display-preview-column" key="after"><strong>Colonne exemple B</strong><span>Texte de démonstration</span></div>
  ];
  const selectedIndex = model.simulatedPosition - 1;
  const ordered = columns.filter(item => item !== selected);
  ordered.splice(selectedIndex, 0, selected);
  return <div className="field-display-preview-grid" aria-label="Grille fictive">{ordered}</div>;
}

function FormPreview({ model }) {
  if (!model.visible) return <HiddenMessage surface="form"/>;
  return <div className="field-display-preview-form" aria-label="Formulaire fictif">
    <label>Champ exemple précédent<input value="ABC-123" readOnly/></label>
    <label>
      {model.label}
      <input
        defaultValue={model.demoValue}
        readOnly={model.effectiveReadonly}
        aria-readonly={model.effectiveReadonly}
        aria-describedby="field-display-preview-input-help"
      />
    </label>
    <p id="field-display-preview-input-help">
      Saisie fictive locale uniquement. Les protections métier réelles resteraient prioritaires.
    </p>
    <label>Champ exemple suivant<input value="Texte de démonstration" readOnly/></label>
  </div>;
}

function Preview360({ model }) {
  return <div className="field-display-preview-360" aria-label="Fiche 360 fictive">
    <section><strong>Identité</strong><span>ABC-123</span></section>
    {model.visible
      ? <section className="selected">
        <strong>{model.label}</strong>
        <span>{model.demoValue}</span>
        <small>{model.effectiveReadonly ? 'Lecture seule simulée' : 'Présentation simulée modifiable'}</small>
      </section>
      : <HiddenMessage surface="360"/>}
    <section><strong>Informations complémentaires</strong><span>Texte de démonstration</span></section>
  </div>;
}

export default function FieldDisplayAdminPreview({
  field,
  localDraft,
  storedDraft,
  catalogFields,
  protectedField,
  protectionReasons
}) {
  const [surface, setSurface] = useState('grid');
  const model = useMemo(() => projectDisplayPreview({
    surface,
    field,
    localDraft,
    storedDraft,
    fallbacks: previewFallbacks,
    catalogFields,
    protectedField,
    protectionReasons
  }), [
    surface, field, localDraft, storedDraft, catalogFields, protectedField, protectionReasons
  ]);

  function selectViewFromKeyboard(event, currentView) {
    const currentIndex = DISPLAY_PREVIEW_SURFACES.indexOf(currentView);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % DISPLAY_PREVIEW_SURFACES.length;
    else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + DISPLAY_PREVIEW_SURFACES.length) % DISPLAY_PREVIEW_SURFACES.length;
    } else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = DISPLAY_PREVIEW_SURFACES.length - 1;
    else return;
    event.preventDefault();
    const nextView = DISPLAY_PREVIEW_SURFACES[nextIndex];
    setSurface(nextView);
    event.currentTarget.parentElement
      ?.querySelector(`#field-display-preview-tab-${nextView}`)
      ?.focus();
  }

  return <section className="field-display-preview" aria-labelledby="field-display-preview-title">
    <header>
      <h4 id="field-display-preview-title">Prévisualisation</h4>
      <p>Aperçu simulé du brouillon. Aucun effet sur l’application.</p>
    </header>
    <p className="field-display-preview-banner" role="note">
      Prévisualisation administrative seulement — aucune configuration active.
    </p>
    {protectedField && <p className="field-display-preview-protected">
      Champ protégé : configuration non modifiable. L’aperçu demeure en lecture seule.
    </p>}
    <div className="field-display-preview-tabs" role="tablist" aria-label="Surface fictive prévisualisée">
      {DISPLAY_PREVIEW_SURFACES.map(view => <button
        key={view}
        type="button"
        role="tab"
        id={`field-display-preview-tab-${view}`}
        aria-selected={surface === view}
        aria-controls={`field-display-preview-panel-${view}`}
        tabIndex={surface === view ? 0 : -1}
        onClick={() => setSurface(view)}
        onKeyDown={event => selectViewFromKeyboard(event, view)}
      >
        {viewLabels[view]}
      </button>)}
    </div>
    <div
      className="field-display-preview-panel"
      role="tabpanel"
      id={`field-display-preview-panel-${surface}`}
      aria-labelledby={`field-display-preview-tab-${surface}`}
    >
      {(model.inheritedVisibility || model.inheritedReadonly || model.inheritedOrder) &&
        <p className="field-display-preview-inherited">Hérité dans cet aperçu : fallback local simulé, sans règle métier active.</p>}
      <PreviewFacts model={model}/>
      {model.collision && <p className="field-display-preview-collision">
        Collision permise avec {model.collision.technicalName}. La position montrée reste simulée.
      </p>}
      {surface === 'grid' && <GridPreview model={model}/>}
      {surface === 'form' && <FormPreview model={model}/>}
      {surface === '360' && <Preview360 model={model}/>}
    </div>
  </section>;
}
