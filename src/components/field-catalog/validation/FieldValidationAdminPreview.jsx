import React from 'react';

export default function FieldValidationAdminPreview({ field, draft, compatible, protectedField }) {
  const type = field?.functionalType || 'non défini';
  const inherited = Object.values(draft).every(value => value === null);
  return <section className="field-validation-preview" aria-labelledby="validation-preview-title">
    <h4 id="validation-preview-title">Prévisualisation</h4>
    <p>Prévisualisation administrative simulée — aucune règle active.</p>
    {protectedField && <p role="note">Champ protégé : aperçu en lecture seule.</p>}
    {inherited && <p>Hérité dans cet aperçu.</p>}
    <div className="field-validation-preview-card">
      <strong>{field.label}</strong><span>Type : {type}</span>
      {draft.requiredOverride === true && <span>Exemple requis</span>}
      {draft.requiredOverride !== true && <span>Exemple facultatif ou hérité</span>}
      {compatible.includes('minimumLength') && <span>Texte fictif : Exemple de valeur</span>}
      {compatible.includes('minimumValue') && <span>Nombre fictif : 1250</span>}
      {compatible.includes('allowedValues') && <span>Choix fictif : {draft.allowedValues?.[0] ?? 'ABC-123'}</span>}
      {(draft.minimumLength !== null || draft.maximumLength !== null) &&
        <span>Longueur simulée : {draft.minimumLength ?? '—'} à {draft.maximumLength ?? '—'}</span>}
      {(draft.minimumValue !== null || draft.maximumValue !== null) &&
        <span>Bornes simulées : {draft.minimumValue ?? '—'} à {draft.maximumValue ?? '—'}</span>}
      {draft.errorMessages && <span>Message fictif : {Object.values(draft.errorMessages)[0]}</span>}
    </div>
  </section>;
}
