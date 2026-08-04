export const DISPLAY_PREVIEW_SURFACES = Object.freeze(['grid', 'form', '360']);

export const previewFallbacks = Object.freeze({
  showInGrid: true,
  showInForm: true,
  showIn360: true,
  readonlyOverride: false,
  displayOrder: 200
});

const visibilityProperty = Object.freeze({
  grid: 'showInGrid',
  form: 'showInForm',
  360: 'showIn360'
});

const surfaceLabels = Object.freeze({
  grid: 'Grille',
  form: 'Formulaire',
  360: 'Fiche 360'
});

function demoValueFor(field) {
  const type = String(field?.functionalType || field?.field_type || '').toLowerCase();
  if (type.includes('date')) return '2026-01-15';
  if (type.includes('nombre') || type.includes('numeric') || type.includes('integer')) return '1250';
  if (type.includes('bool')) return 'Oui';
  if (type.includes('code') || type.includes('identifiant')) return 'ABC-123';
  return 'Exemple de valeur';
}

export function projectDisplayPreview({
  surface,
  field = {},
  localDraft = {},
  storedDraft = {},
  fallbacks = previewFallbacks,
  catalogFields = [],
  protectedField = false,
  protectionReasons = []
}) {
  if (!DISPLAY_PREVIEW_SURFACES.includes(surface)) {
    throw new Error('Surface de prévisualisation non supportée.');
  }
  const visibilityKey = visibilityProperty[surface];
  const localVisibility = localDraft[visibilityKey] ?? null;
  const inheritedVisibility = localVisibility === null;
  const effectiveVisibility = inheritedVisibility
    ? Boolean(fallbacks[visibilityKey])
    : localVisibility;
  const localReadonly = localDraft.readonlyOverride ?? null;
  const inheritedReadonly = localReadonly === null;
  const effectiveReadonly = protectedField || (
    inheritedReadonly ? Boolean(fallbacks.readonlyOverride) : localReadonly
  );
  const requestedOrder = localDraft.displayOrder ?? null;
  const effectivePreviewOrder = requestedOrder === null
    ? fallbacks.displayOrder
    : requestedOrder;
  const collision = requestedOrder === null
    ? null
    : catalogFields.find(candidate =>
      candidate.fieldId !== field.fieldId &&
      candidate.tableName === field.tableName &&
      candidate.display_order === requestedOrder
    ) || null;
  const previewItems = [
    { id: 'preview-before', order: 100 },
    { id: 'selected-field', order: effectivePreviewOrder },
    { id: 'preview-after', order: 300 }
  ].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));

  return {
    surface,
    surfaceLabel: surfaceLabels[surface],
    visibilityKey,
    visible: effectiveVisibility,
    inheritedVisibility,
    localVisibility,
    storedVisibility: storedDraft[visibilityKey] ?? null,
    effectiveVisibility,
    readonly: effectiveReadonly,
    inheritedReadonly,
    localReadonly,
    storedReadonly: storedDraft.readonlyOverride ?? null,
    effectiveReadonly,
    requestedOrder,
    storedOrder: storedDraft.displayOrder ?? null,
    effectivePreviewOrder,
    inheritedOrder: requestedOrder === null,
    simulatedPosition: previewItems.findIndex(item => item.id === 'selected-field') + 1,
    collision,
    protectedField,
    protectionReasons: [...new Set(protectionReasons)],
    label: field.label || field.technicalName || 'Champ sélectionné',
    demoValue: demoValueFor(field)
  };
}
