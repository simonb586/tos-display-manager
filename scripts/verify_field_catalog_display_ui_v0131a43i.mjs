import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  displayOrderCollision,
  displayProtectionReasons,
  parseDisplayOrderInput
} from '../src/lib/fieldCatalogDisplayPresentation.js';

for (const [raw, expected] of [
  ['', { valid: true, value: null, error: '' }],
  ['   ', { valid: true, value: null, error: '' }],
  ['0', { valid: true, value: 0, error: '' }],
  ['100000', { valid: true, value: 100000, error: '' }]
]) assert.deepEqual(parseDisplayOrderInput(raw), expected);

for (const raw of ['-1', '100001', '1.5', '1,5', '1e3', 'NaN', 'Infinity', 'abc']) {
  const result = parseDisplayOrderInput(raw);
  assert.equal(result.valid, false, `${raw} doit être refusé.`);
  assert.equal(result.error, 'L’ordre doit être un entier entre 0 et 100000.');
}

const baseField = {
  fieldId: 'clients.nom',
  tableName: 'clients',
  technicalName: 'nom',
  technical_name_locked: true,
  physical: {}
};
assert.deepEqual(displayProtectionReasons(baseField), []);

const protectedField = {
  ...baseField,
  technicalName: 'support_id',
  primaryKey: true,
  foreignKey: true,
  generated: true,
  physical: { identity: true },
  system: true
};
assert.deepEqual(displayProtectionReasons(protectedField), [
  'Identifiant métier protégé',
  'Nom technique se terminant par _id',
  'Clé primaire',
  'Clé étrangère',
  'Colonne générée',
  'Colonne identity',
  'Champ système'
]);
assert.equal(new Set(displayProtectionReasons(protectedField)).size, displayProtectionReasons(protectedField).length);

const catalogFields = [
  baseField,
  { fieldId: 'clients.code', tableName: 'clients', technicalName: 'code', display_order: 12 },
  { fieldId: 'orders.code', tableName: 'orders', technicalName: 'code', display_order: 12 }
];
assert.equal(displayOrderCollision(baseField, catalogFields, null), null);
assert.equal(displayOrderCollision(baseField, catalogFields, 12).fieldId, 'clients.code');
assert.equal(displayOrderCollision(baseField, catalogFields, 18), null);

const files = {
  tab: '../src/components/field-catalog/FieldCatalogDisplayTab.jsx',
  choice: '../src/components/field-catalog/display/DisplayInheritanceChoice.jsx',
  dialog: '../src/components/field-catalog/display/UnsavedDisplayDraftDialog.jsx',
  hook: '../src/hooks/useFieldDisplayDraft.js',
  drawer: '../src/components/field-catalog/FieldCatalogDrawer.jsx',
  manager: '../src/components/FieldCatalogManager.jsx',
  registry: '../src/components/field-catalog/tabRegistry.js',
  css: '../src/features/v13/field-catalog-display.css'
};
const sources = Object.fromEntries(
  await Promise.all(Object.entries(files).map(async ([key, path]) => [
    key,
    await readFile(new URL(path, import.meta.url), 'utf8')
  ]))
);
const combinedUi = [
  sources.tab,
  sources.choice,
  sources.dialog,
  sources.hook,
  sources.drawer,
  sources.manager
].join('\n');

for (const required of [
  'Affichage',
  'Brouillon sans effet immédiat',
  'Grille',
  'Formulaire',
  'Fiche 360',
  'Hériter',
  'Afficher',
  'Masquer',
  'Lecture seule générale',
  'Oui',
  'Non',
  'Annuler',
  'Enregistrer le brouillon',
  'Aucun changement à enregistrer.',
  'Brouillon enregistré.',
  'Vos modifications locales ont été conservées.',
  'Un autre champ utilise déjà cet ordre',
  'Ce champ est protégé et ne peut pas être configuré.'
]) assert.ok(combinedUi.includes(required), `Élément UX absent: ${required}`);

assert.match(sources.registry, /id:\s*['"]display['"]/);
assert.match(sources.registry, /label:\s*['"]Affichage['"]/);
assert.match(sources.manager, /catalogFields=\{fields\}/);
assert.match(sources.tab, /fieldStatusLabel/);
assert.match(sources.tab, /aria-busy/);
assert.match(sources.tab, /aria-live/);
assert.match(sources.tab, /fieldset|DisplayInheritanceChoice/);
assert.match(sources.choice, /<fieldset/);
assert.match(sources.choice, /<legend>/);
assert.match(sources.choice, /type="radio"/);
assert.match(sources.dialog, /role="dialog"/);
assert.match(sources.dialog, /aria-modal="true"/);
assert.match(sources.dialog, /event\.key === 'Escape'/);
assert.match(sources.dialog, /event\.key !== 'Tab'/);
assert.match(sources.drawer, /inert=/);
assert.match(sources.drawer, /saveAndContinue/);
assert.match(sources.drawer, /discardAndContinue/);
assert.match(sources.drawer, /continueEditing/);

assert.match(sources.hook, /submittingRef\.current/);
assert.match(sources.hook, /requestRef\.current/);
assert.match(sources.hook, /displayDraftChangeSummary/);
assert.match(sources.hook, /if \(!summary\.changed\)/);
assert.match(sources.hook, /saveFieldDisplayDraft/);
assert.match(sources.hook, /setInitial\(validation\.normalized\)/);
assert.match(sources.hook, /window\.addEventListener\('beforeunload'/);
assert.match(sources.hook, /setDraft\(initial\)/);
assert.doesNotMatch(sources.hook, /setTimeout|setInterval|debounce/i);

for (const forbiddenAction of ['Activer', 'Publier', 'Appliquer', 'Déployer', 'Synchroniser']) {
  assert.doesNotMatch(
    combinedUi,
    new RegExp(`>\\s*${forbiddenAction}\\s*<`, 'i'),
    `Action interdite détectée: ${forbiddenAction}`
  );
}
assert.doesNotMatch(combinedUi, /supabase|\.rpc\s*\(|\.from\s*\(/i);
assert.doesNotMatch(sources.tab, /saveFieldDisplayDraft|fieldCatalogDisplayWriteService/);
assert.match(sources.hook, /fieldCatalogDisplayWriteService/);
assert.match(sources.css, /min-height:44px/);
assert.match(sources.css, /focus-visible/);
assert.match(sources.css, /@media\(max-width:700px\)/);

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
    /FieldCatalogDisplayTab|useFieldDisplayDraft|DisplayConfig|showInGrid|show_in_grid/
  );
}

console.log('Phase 13.1-A4.3-I : interface Affichage, accessibilité et isolation validées.');
