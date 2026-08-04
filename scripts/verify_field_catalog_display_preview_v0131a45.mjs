import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DISPLAY_PREVIEW_SURFACES,
  previewFallbacks,
  projectDisplayPreview
} from '../src/lib/displayAdminPreviewProjection.mjs';

const field = {
  fieldId: 'clients.nom',
  tableName: 'clients',
  technicalName: 'nom',
  label: 'Nom',
  functionalType: 'texte',
  technical_name_locked: true
};
const storedDraft = {
  showInGrid: false,
  showInForm: false,
  showIn360: false,
  displayOrder: 80,
  readonlyOverride: true
};
const inheritedDraft = {
  showInGrid: null,
  showInForm: null,
  showIn360: null,
  displayOrder: null,
  readonlyOverride: null
};

assert.deepEqual(DISPLAY_PREVIEW_SURFACES, ['grid', 'form', '360']);
assert.deepEqual(previewFallbacks, {
  showInGrid: true,
  showInForm: true,
  showIn360: true,
  readonlyOverride: false,
  displayOrder: 200
});

for (const surface of DISPLAY_PREVIEW_SURFACES) {
  const first = projectDisplayPreview({
    surface, field, localDraft: inheritedDraft, storedDraft
  });
  const second = projectDisplayPreview({
    surface, field, localDraft: inheritedDraft, storedDraft
  });
  assert.deepEqual(first, second, `${surface} doit être déterministe.`);
  assert.equal(first.visible, true);
  assert.equal(first.inheritedVisibility, true);
  assert.equal(first.storedVisibility, false);
  assert.equal(first.readonly, false);
  assert.equal(first.inheritedReadonly, true);
  assert.equal(first.requestedOrder, null);
  assert.equal(first.effectivePreviewOrder, 200);
  assert.equal(first.inheritedOrder, true);
  assert.equal(first.demoValue, 'Exemple de valeur');
}

for (const [surface, property] of [
  ['grid', 'showInGrid'],
  ['form', 'showInForm'],
  ['360', 'showIn360']
]) {
  const hidden = projectDisplayPreview({
    surface,
    field,
    localDraft: { ...inheritedDraft, [property]: false },
    storedDraft
  });
  assert.equal(hidden.visible, false);
  assert.equal(hidden.inheritedVisibility, false);
  const shown = projectDisplayPreview({
    surface,
    field,
    localDraft: { ...inheritedDraft, [property]: true },
    storedDraft
  });
  assert.equal(shown.visible, true);
  assert.equal(shown.inheritedVisibility, false);
}

const localUnsaved = projectDisplayPreview({
  surface: 'grid',
  field,
  localDraft: {
    ...inheritedDraft,
    showInGrid: true,
    readonlyOverride: false,
    displayOrder: 7
  },
  storedDraft,
  catalogFields: [
    field,
    { fieldId: 'clients.code', tableName: 'clients', technicalName: 'code', display_order: 7 }
  ]
});
assert.equal(localUnsaved.localVisibility, true);
assert.equal(localUnsaved.storedVisibility, false);
assert.equal(localUnsaved.effectiveVisibility, true);
assert.equal(localUnsaved.requestedOrder, 7);
assert.equal(localUnsaved.storedOrder, 80);
assert.equal(localUnsaved.simulatedPosition, 1);
assert.equal(localUnsaved.collision.technicalName, 'code');

const readonly = projectDisplayPreview({
  surface: 'form',
  field,
  localDraft: { ...inheritedDraft, readonlyOverride: true },
  storedDraft
});
assert.equal(readonly.effectiveReadonly, true);

const protectedPreview = projectDisplayPreview({
  surface: '360',
  field: { ...field, technicalName: 'support_id' },
  localDraft: { ...inheritedDraft, readonlyOverride: false },
  storedDraft,
  protectedField: true,
  protectionReasons: ['Identifiant protégé', 'Identifiant protégé']
});
assert.equal(protectedPreview.visible, true);
assert.equal(protectedPreview.readonly, true);
assert.deepEqual(protectedPreview.protectionReasons, ['Identifiant protégé']);

const technicalNameLockedOnly = projectDisplayPreview({
  surface: 'grid',
  field,
  localDraft: { ...inheritedDraft, readonlyOverride: false },
  storedDraft,
  protectedField: false
});
assert.equal(technicalNameLockedOnly.protectedField, false);
assert.equal(technicalNameLockedOnly.readonly, false);

assert.equal(projectDisplayPreview({
  surface: 'grid',
  field: { ...field, functionalType: 'date' },
  localDraft: inheritedDraft
}).demoValue, '2026-01-15');
assert.equal(projectDisplayPreview({
  surface: 'grid',
  field: { ...field, functionalType: 'nombre' },
  localDraft: inheritedDraft
}).demoValue, '1250');
assert.equal(projectDisplayPreview({
  surface: 'grid',
  field: { ...field, functionalType: 'booléen' },
  localDraft: inheritedDraft
}).demoValue, 'Oui');
assert.throws(
  () => projectDisplayPreview({ surface: 'business-grid' }),
  /Surface de prévisualisation non supportée/
);

const files = {
  preview: '../src/components/field-catalog/display/FieldDisplayAdminPreview.jsx',
  projector: '../src/lib/displayAdminPreviewProjection.mjs',
  tab: '../src/components/field-catalog/FieldCatalogDisplayTab.jsx',
  hook: '../src/hooks/useFieldDisplayDraft.js',
  css: '../src/features/v13/field-catalog-display.css'
};
const sources = Object.fromEntries(
  await Promise.all(Object.entries(files).map(async ([key, path]) => [
    key,
    await readFile(new URL(path, import.meta.url), 'utf8')
  ]))
);
const previewSources = `${sources.preview}\n${sources.projector}`;

for (const text of [
  'Prévisualisation',
  'Aperçu simulé du brouillon. Aucun effet sur l’application.',
  'Prévisualisation administrative seulement — aucune configuration active.',
  'Grille',
  'Formulaire',
  'Fiche 360',
  'Valeur locale actuelle',
  'Valeur enregistrée',
  'Valeur effective simulée',
  'Hérité dans cet aperçu',
  'Ce champ serait masqué',
  'Exemple de valeur',
  'ABC-123',
  'Texte de démonstration'
]) assert.ok(previewSources.includes(text), `Texte A4.5 absent : ${text}`);

assert.match(sources.preview, /useState\('grid'\)/);
assert.match(sources.preview, /role="tablist"/);
assert.match(sources.preview, /role="tab"/);
assert.match(sources.preview, /aria-selected=/);
assert.match(sources.preview, /event\.key === 'ArrowRight'/);
assert.match(sources.preview, /event\.key === 'ArrowLeft'/);
assert.match(sources.preview, /event\.key === 'Home'/);
assert.match(sources.preview, /event\.key === 'End'/);
assert.match(sources.preview, /onKeyDown=/);
assert.match(sources.preview, /role="tabpanel"/);
assert.match(sources.preview, /aria-labelledby=/);
assert.match(sources.preview, /aria-describedby=/);
assert.match(sources.preview, /readOnly=\{model\.effectiveReadonly\}/);
assert.match(sources.preview, /localDraft/);
assert.match(sources.preview, /storedDraft/);
assert.match(sources.tab, /localDraft=\{state\.draft\}/);
assert.match(sources.tab, /storedDraft=\{state\.initial\}/);
assert.doesNotMatch(sources.hook, /displayAdminPreviewProjection|FieldDisplayAdminPreview/);

assert.doesNotMatch(previewSources, /supabase|\.rpc\s*\(|\.from\s*\(/i);
assert.doesNotMatch(previewSources, /fieldCatalogDisplayWriteService|saveFieldDisplayDraft/);
assert.doesNotMatch(previewSources, /\.update\s*\(|\.insert\s*\(|\.upsert\s*\(/);
assert.doesNotMatch(previewSources, /fetch\s*\(|XMLHttpRequest|WebSocket/);
assert.doesNotMatch(sources.projector, /react|service|component/i);

for (const forbiddenAction of ['Activer', 'Publier', 'Appliquer', 'Déployer', 'Synchroniser']) {
  assert.doesNotMatch(
    sources.preview,
    new RegExp(`>\\s*${forbiddenAction}\\s*<`, 'i'),
    `Action interdite détectée : ${forbiddenAction}`
  );
}
assert.match(sources.css, /\.field-display-preview-tabs button:focus-visible/);
assert.match(sources.css, /@media\(max-width:700px\)/);
assert.match(sources.css, /\.field-display-preview-tabs\{flex-direction:column\}/);

for (const path of [
  '../src/main.jsx',
  '../src/components/EditableField.jsx',
  '../src/services/universalEditorService.js',
  '../src/components/TerrainApp.jsx',
  '../src/components/Support360Panel.jsx',
  '../src/components/RelationsStudio.jsx',
  '../src/services/relationService.js'
]) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  assert.doesNotMatch(
    source,
    /FieldDisplayAdminPreview|displayAdminPreviewProjection|projectDisplayPreview/
  );
}

console.log('Phase 13.1-A4.5 : prévisualisation administrative simulée et isolée validée.');
