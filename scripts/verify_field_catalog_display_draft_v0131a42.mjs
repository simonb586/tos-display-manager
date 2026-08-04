import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DISPLAY_DRAFT_CONTRACT_VERSION,
  DISPLAY_DRAFT_RPC_PARAMETERS,
  displayDraftChangeSummary,
  displayDraftFromField,
  displayDraftRpcPayload,
  isProtectedDisplayDraftField,
  normalizeDisplayDraft
} from '../src/lib/fieldCatalogDisplayDraft.js';
import { validateFieldDisplayDraft } from '../src/services/fieldCatalogDisplayValidationService.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const editableField = {
  id: 88,
  tableName: 'clients',
  technicalName: 'nom_client',
  technical_name_locked: false,
  show_in_grid: null,
  show_in_form: true,
  show_in_360: false,
  display_order: null,
  readonly_override: null,
  physical: {}
};

assert.equal(DISPLAY_DRAFT_CONTRACT_VERSION, '1.0.0');
assert.deepEqual(DISPLAY_DRAFT_RPC_PARAMETERS, {
  showInGrid: 'p_show_in_grid',
  showInForm: 'p_show_in_form',
  showIn360: 'p_show_in_360',
  displayOrder: 'p_display_order',
  readonlyOverride: 'p_readonly_override'
});

const defaults = normalizeDisplayDraft({
  showInGrid: undefined,
  showInForm: undefined,
  showIn360: undefined,
  displayOrder: undefined,
  readonlyOverride: undefined
});
assert.deepEqual(defaults, {
  schemaVersion: '1.0.0',
  showInGrid: null,
  showInForm: null,
  showIn360: null,
  displayOrder: null,
  readonlyOverride: null
});

for (const key of ['showInGrid', 'showInForm', 'showIn360', 'readonlyOverride']) {
  for (const value of [null, true, false]) {
    const result = validateFieldDisplayDraft(
      editableField,
      { ...defaults, [key]: value },
      'Administrateur'
    );
    assert.equal(result.valid, true, `${key}=${value} doit être valide.`);
  }
  for (const value of ['true', 1, 0]) {
    const result = validateFieldDisplayDraft(
      editableField,
      { ...defaults, [key]: value },
      'Administrateur'
    );
    assert.equal(result.valid, false, `${key}=${value} doit être refusé.`);
  }
}

for (const value of [null, 0, 100000]) {
  assert.equal(
    validateFieldDisplayDraft(
      editableField,
      { ...defaults, displayOrder: value },
      'Administrateur'
    ).valid,
    true
  );
}
for (const value of [-1, 100001, 1.5, '4', Number.NaN, Number.POSITIVE_INFINITY]) {
  assert.equal(
    validateFieldDisplayDraft(
      editableField,
      { ...defaults, displayOrder: value },
      'Administrateur'
    ).valid,
    false,
    `displayOrder=${String(value)} doit être refusé.`
  );
}

assert.equal(
  validateFieldDisplayDraft(
    editableField,
    { ...defaults, unknownProperty: true },
    'Administrateur'
  ).valid,
  false
);
assert.equal(
  validateFieldDisplayDraft(
    editableField,
    { ...defaults, schemaVersion: '2.0.0' },
    'Administrateur'
  ).valid,
  false
);
assert.equal(validateFieldDisplayDraft(editableField, defaults, 'Client').valid, false);
assert.equal(validateFieldDisplayDraft(null, defaults, 'Administrateur').valid, false);

for (const field of [
  { ...editableField, technicalName: 'support_id' },
  { ...editableField, technicalName: 'id' },
  { ...editableField, technicalName: 'client_id' },
  { ...editableField, technicalName: 'created_at' },
  { ...editableField, technicalName: 'updated_at' },
  { ...editableField, technicalName: 'deleted_at' },
  { ...editableField, technicalName: 'auth_user_id' },
  { ...editableField, technicalName: 'photo_principale_url' },
  { ...editableField, technicalName: 'photo_miniature_url' },
  { ...editableField, technicalName: 'visuel_actuel_cadre' },
  { ...editableField, primaryKey: true },
  { ...editableField, foreignKey: true },
  { ...editableField, generated: true },
  { ...editableField, physical: { identity: true } },
  { ...editableField, system: true }
]) {
  assert.equal(isProtectedDisplayDraftField(field), true);
  assert.equal(validateFieldDisplayDraft(field, defaults, 'Administrateur').valid, false);
}

const technicalNameLockedField = {
  ...editableField,
  technical_name_locked: true
};
assert.equal(isProtectedDisplayDraftField(technicalNameLockedField), false);
assert.equal(
  validateFieldDisplayDraft(
    technicalNameLockedField,
    defaults,
    'Administrateur'
  ).valid,
  true,
  'technical_name_locked protège le nom technique, pas DisplayConfig.'
);

const fromField = displayDraftFromField(editableField);
assert.equal(fromField.showInGrid, null);
assert.equal(fromField.showInForm, true);
assert.equal(fromField.showIn360, false);
assert.equal(fromField.displayOrder, null);

assert.deepEqual(displayDraftChangeSummary(defaults, defaults), {
  changed: false,
  status: 'no_change',
  changedProperties: []
});
assert.deepEqual(
  displayDraftChangeSummary(defaults, { ...defaults, showInGrid: true }),
  {
    changed: true,
    status: 'draft_saved',
    changedProperties: ['showInGrid']
  }
);

assert.deepEqual(
  displayDraftRpcPayload(editableField, {
    ...defaults,
    showInGrid: true,
    showInForm: false,
    showIn360: null,
    displayOrder: 12,
    readonlyOverride: true
  }),
  {
    p_table_name: 'clients',
    p_field_name: 'nom_client',
    p_contract_version: '1.0.0',
    p_show_in_grid: true,
    p_show_in_form: false,
    p_show_in_360: null,
    p_display_order: 12,
    p_readonly_override: true
  }
);

const migration = await readFile(
  new URL('../supabase/V0_13_1_A4_2_DISPLAY_DRAFT.sql', import.meta.url),
  'utf8'
);
for (const required of [
  'alter table public.relation_field_config_audit',
  'save_relation_field_display_draft_v0131a42',
  'security definer',
  'set search_path = pg_catalog',
  "owner to postgres",
  "public.current_app_role() <> 'Administrateur'",
  'auth.uid()',
  "p_contract_version is distinct from '1.0.0'",
  'p_display_order < 0',
  'p_display_order > 100000',
  'physical_is_primary_key',
  'physical_is_foreign_key',
  'physical_is_generated',
  'physical_is_identity',
  "like '%\\_id'",
  "'photo_principale_url'",
  "'photo_miniature_url'",
  "'visuel_actuel_cadre'",
  "'changed', false",
  "'status', 'no_change'",
  'update public.relation_fields',
  "configuration_status = 'draft'",
  'insert into public.relation_field_config_audit',
  'configuration_type,',
  "'display'",
  "'DisplayConfig'",
  "'1.0.0'",
  'changed_properties',
  'actor_user_id',
  'transaction_id',
  "'changed', true",
  "'status', 'draft_saved'"
]) {
  assert.ok(migration.includes(required), `Garantie A4.2 absente: ${required}`);
}
assert.doesNotMatch(migration, /\bexecute\s+(format|\()/i);
assert.doesNotMatch(
  migration,
  /coalesce\s*\(\s*v_old\.technical_name_locked[\s\S]{0,100}\braise exception\b/i,
  'technical_name_locked ne doit pas bloquer DisplayConfig.'
);
assert.doesNotMatch(migration, /\b(create|drop)\s+(trigger|policy)\b/i);
assert.doesNotMatch(migration, /\b(drop|truncate|delete\s+from)\b/i);
assert.doesNotMatch(
  migration,
  /\b(update|insert\s+into|alter\s+table)\s+public\.(infrastructures|clients|bons_de_travail|suivi_des_edt|support_photos)\b/i
);
for (const previousMigration of [
  'V0_13_1_A_UNIVERSAL_FIELD_CATALOG.sql',
  'V0_13_1_A3_FIELD_GENERAL_DRAFT.sql'
]) {
  assert.doesNotMatch(migration, new RegExp(previousMigration.replaceAll('.', '\\.'), 'i'));
}

const noChangePosition = migration.indexOf("'status', 'no_change'");
const updatePosition = migration.indexOf('update public.relation_fields');
const auditPosition = migration.indexOf('insert into public.relation_field_config_audit');
assert.ok(noChangePosition > 0 && noChangePosition < updatePosition);
assert.ok(updatePosition > 0 && updatePosition < auditPosition);

const verifier = await readFile(
  new URL('../supabase/VERIFIER_V0_13_1_A4_2_DISPLAY_DRAFT.sql', import.meta.url),
  'utf8'
);
assert.match(verifier, /begin read only/i);
assert.match(verifier, /rollback/i);
assert.doesNotMatch(verifier, /^\s*(update|insert|delete|truncate|alter|create|drop)\b/im);

const writeService = await readFile(
  new URL('../src/services/fieldCatalogDisplayWriteService.js', import.meta.url),
  'utf8'
);
assert.match(writeService, /save_relation_field_display_draft_v0131a42/);
assert.doesNotMatch(writeService, /\.from\s*\(/);

async function listSources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listSources(path));
    else if (['.js', '.jsx'].includes(extname(entry.name))) files.push(path);
  }
  return files;
}

const protectedConsumers = [
  'src/main.jsx',
  'src/components/EditableField.jsx',
  'src/services/universalEditorService.js',
  'src/components/TerrainApp.jsx',
  'src/components/Support360Panel.jsx',
  'src/components/RelationsStudio.jsx',
  'src/services/relationService.js'
];
for (const path of protectedConsumers) {
  const source = await readFile(join(root, path), 'utf8');
  assert.doesNotMatch(
    source,
    /fieldCatalogDisplay|save_relation_field_display_draft_v0131a42/
  );
}

for (const path of await listSources(join(root, 'src', 'components'))) {
  const source = await readFile(path, 'utf8');
  assert.doesNotMatch(
    source,
    /fieldCatalogDisplay|save_relation_field_display_draft_v0131a42/
  );
}

console.log('Phase 13.1-A4.2 : stockage brouillon, protections et non-consommation validés.');
