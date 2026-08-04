import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  displayOrderCollision,
  displayProtectionReasons,
  parseDisplayOrderInput
} from '../src/lib/fieldCatalogDisplayPresentation.js';
import {
  displayDraftChangeSummary,
  displayDraftFromField,
  normalizeDisplayDraft
} from '../src/lib/fieldCatalogDisplayDraft.js';
import { validateFieldDisplayDraft } from '../src/services/fieldCatalogDisplayValidationService.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFile(join(root, path), 'utf8');

const editableField = {
  id: 'field-row-id',
  fieldId: 'clients.nom',
  tableName: 'clients',
  technicalName: 'nom',
  technical_name_locked: true,
  physical: {}
};
const inherited = displayDraftFromField(editableField);
assert.deepEqual(inherited, {
  schemaVersion: '1.0.0',
  showInGrid: null,
  showInForm: null,
  showIn360: null,
  displayOrder: null,
  readonlyOverride: null
});
assert.equal(validateFieldDisplayDraft(editableField, inherited, 'Administrateur').valid, true);
assert.deepEqual(displayProtectionReasons(editableField), []);

for (const [property, value] of [
  ['showInGrid', true],
  ['showInGrid', false],
  ['showInForm', true],
  ['showInForm', false],
  ['showIn360', true],
  ['showIn360', false],
  ['readonlyOverride', true],
  ['readonlyOverride', false]
]) {
  const candidate = normalizeDisplayDraft({ ...inherited, [property]: value });
  const summary = displayDraftChangeSummary(inherited, candidate);
  assert.equal(summary.changed, true);
  assert.deepEqual(summary.changedProperties, [property]);
}
assert.equal(displayDraftChangeSummary(inherited, normalizeDisplayDraft(inherited)).changed, false);

for (const [raw, value] of [['', null], ['   ', null], ['0', 0], ['100000', 100000]]) {
  assert.deepEqual(parseDisplayOrderInput(raw), { valid: true, value, error: '' });
}
for (const raw of ['-1', '100001', '1.5', '1e3']) {
  assert.equal(parseDisplayOrderInput(raw).valid, false, `${raw} doit être refusé.`);
}

const fields = [
  editableField,
  { fieldId: 'clients.code', tableName: 'clients', technicalName: 'code', display_order: 7 }
];
assert.equal(displayOrderCollision(editableField, fields, 7)?.fieldId, 'clients.code');
assert.equal(displayOrderCollision(editableField, fields, 8), null);

for (const protectedVariant of [
  { technicalName: 'support_id' },
  { technicalName: 'photo_principale_url' },
  { technicalName: 'photo_miniature_url' },
  { technicalName: 'visuel_actuel_cadre' },
  { primaryKey: true },
  { foreignKey: true },
  { generated: true },
  { physical: { identity: true } },
  { system: true }
]) {
  const field = { ...editableField, technical_name_locked: false, ...protectedVariant };
  assert.ok(displayProtectionReasons(field).length > 0);
  assert.equal(validateFieldDisplayDraft(field, inherited, 'Administrateur').valid, false);
}

const paths = {
  tab: 'src/components/field-catalog/FieldCatalogDisplayTab.jsx',
  choice: 'src/components/field-catalog/display/DisplayInheritanceChoice.jsx',
  dialog: 'src/components/field-catalog/display/UnsavedDisplayDraftDialog.jsx',
  hook: 'src/hooks/useFieldDisplayDraft.js',
  drawer: 'src/components/field-catalog/FieldCatalogDrawer.jsx',
  service: 'src/services/fieldCatalogDisplayWriteService.js',
  css: 'src/features/v13/field-catalog-display.css'
};
const sources = Object.fromEntries(
  await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await read(path)]))
);
const ui = [sources.tab, sources.choice, sources.dialog, sources.hook, sources.drawer].join('\n');

for (const token of [
  'Brouillon sans effet immédiat',
  'Grille',
  'Formulaire',
  'Fiche 360',
  'Lecture seule générale',
  'Aucun changement à enregistrer.',
  'Vos modifications locales ont été conservées.',
  'Continuer l’édition',
  'Abandonner les changements',
  'Enregistrer le brouillon'
]) assert.ok(ui.includes(token), `État ou libellé A4.4 absent : ${token}`);

assert.match(sources.choice, /<fieldset/);
assert.match(sources.choice, /<legend>/);
assert.match(sources.choice, /type="radio"/);
assert.match(sources.choice, /aria-describedby=\{descriptionId\}/);
assert.match(sources.tab, /aria-invalid=\{Boolean\(state\.errors\.displayOrder\)\}/);
assert.match(sources.tab, /aria-live=\{state\.status === 'error' \? 'assertive' : 'polite'\}/);
assert.match(sources.tab, /aria-busy=\{state\.submitting\}/);
assert.match(sources.tab, /messageRef\.current\?\.focus\(\)/);
assert.match(sources.tab, /tabIndex=\{state\.status === 'error' \? -1 : undefined\}/);
assert.match(sources.dialog, /role="dialog"/);
assert.match(sources.dialog, /aria-modal="true"/);
assert.match(sources.dialog, /firstButtonRef\.current\?\.focus\(\)/);
assert.match(sources.dialog, /event\.key === 'Escape'/);
assert.match(sources.dialog, /event\.key !== 'Tab'/);
assert.match(sources.dialog, /document\.activeElement === first/);
assert.match(sources.dialog, /document\.activeElement === last/);
assert.match(sources.dialog, /returnFocus\?\.current\?\.focus\?\.\(\)/);
assert.match(sources.drawer, /inert=\{pendingAction \? '' : undefined\}/);
assert.match(sources.drawer, /if \(!saved\) return/);

assert.match(sources.hook, /if \(submittingRef\.current \|\| protectedField\) return false/);
assert.ok(
  sources.hook.indexOf('submittingRef.current = true') <
    sources.hook.indexOf('await saveFieldDisplayDraft'),
  'La garde synchrone doit précéder le premier appel asynchrone.'
);
assert.match(sources.hook, /if \(!summary\.changed\)/);
assert.match(sources.hook, /setInitial\(validation\.normalized\)/);
assert.match(sources.hook, /if \(requestId !== requestRef\.current\) return false/);
assert.match(sources.hook, /setDraft\(initial\)/);
assert.doesNotMatch(sources.hook, /setTimeout|setInterval|debounce|retry/i);

assert.equal((sources.service.match(/\.rpc\s*\(/g) || []).length, 1);
assert.doesNotMatch(sources.service, /\.from\s*\(|\.update\s*\(|\.insert\s*\(|\.upsert\s*\(/);
assert.doesNotMatch(sources.service, /retry|setTimeout|setInterval/i);
assert.match(sources.hook, /catch \(error\)/);
assert.match(sources.hook, /Vos modifications locales ont été conservées\./);
assert.doesNotMatch(sources.hook, /setDraft\([^)]*\)[\s\S]{0,160}catch \(error\)/);

for (const forbiddenAction of ['Activer', 'Publier', 'Appliquer', 'Déployer', 'Synchroniser']) {
  assert.doesNotMatch(ui, new RegExp(`>\\s*${forbiddenAction}\\s*<`, 'i'));
}
assert.doesNotMatch(ui, /supabase|\.rpc\s*\(|\.from\s*\(/i);
assert.match(sources.css, /min-height:44px/);
assert.match(sources.css, /focus-visible/);
assert.match(sources.css, /@media\(max-width:700px\)/);
assert.match(sources.css, /\.field-display-choice>div\{grid-template-columns:1fr\}/);

const protectedConsumers = [
  'src/main.jsx',
  'src/components/EditableField.jsx',
  'src/services/universalEditorService.js',
  'src/components/TerrainApp.jsx',
  'src/components/Support360Panel.jsx',
  'src/components/RelationsStudio.jsx',
  'src/services/relationService.js'
];
const displayConsumptionPattern =
  /DisplayConfig|showInGrid|show_in_grid|showInForm|show_in_form|showIn360|show_in_360|readonlyOverride|readonly_override/;
for (const path of protectedConsumers) {
  assert.doesNotMatch(await read(path), displayConsumptionPattern, `Consommation interdite : ${path}`);
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  }));
  return nested.flat();
}
const allowedDisplayConfigFiles = new Set([
  ...Object.values(paths),
  'src/lib/fieldCatalog.js',
  'src/lib/fieldCatalogDisplayDraft.js',
  'src/lib/fieldCatalogDisplayPresentation.js',
  'src/services/fieldCatalogDisplayValidationService.js',
  'src/features/v13/field-contracts/contracts.js',
  'src/features/v13/field-contracts/validation.js'
]);
for (const absolutePath of await sourceFiles(join(root, 'src'))) {
  if (!['.js', '.jsx'].includes(extname(absolutePath))) continue;
  const path = relative(root, absolutePath).replaceAll('\\', '/');
  if (path.startsWith('src/src/') || allowedDisplayConfigFiles.has(path)) continue;
  assert.doesNotMatch(
    await readFile(absolutePath, 'utf8'),
    displayConsumptionPattern,
    `Consommation DisplayConfig hors périmètre administratif : ${path}`
  );
}

console.log('Phase 13.1-A4.4 : validation locale, accessibilité et non-consommation vérifiées.');
