import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  FIELD_CATALOG_FUNCTIONAL_TYPES,
  fieldDraftChanged,
  fieldGeneralDraft,
  isProtectedCatalogField
} from '../src/lib/fieldCatalogDraft.js';
import { validateFieldGeneralDraft } from '../src/services/fieldCatalogValidationService.js';

assert.deepEqual(FIELD_CATALOG_FUNCTIONAL_TYPES, [
  'short_text','long_text','number','currency','date','datetime','boolean',
  'single_select','multi_select','photo','file','relation','calculated'
]);

const editableField = {
  id: 42,
  fieldId: '["clients","nom_client"]',
  tableName: 'clients',
  technicalName: 'nom_client',
  label: 'Nom du client',
  field_type: 'short_text',
  help_text: '',
  display_order: 2,
  physical: {}
};
const initial = fieldGeneralDraft(editableField);
assert.equal(initial.tableName, 'clients');
assert.equal(initial.technicalName, 'nom_client');
assert.equal(fieldDraftChanged(initial, { ...initial, fieldLabel: 'Client' }), true);
assert.equal(fieldDraftChanged(initial, { ...initial }), false);

for (const patch of [
  { fieldLabel: 'Client' },
  { fieldType: 'long_text' },
  { helpText: 'Nom officiel' },
  { displayOrder: '4' }
]) {
  const result = validateFieldGeneralDraft(editableField, { ...initial, ...patch }, 'Administrateur');
  assert.equal(result.valid, true, `Modification valide refusée : ${JSON.stringify(patch)}`);
}

assert.equal(validateFieldGeneralDraft(editableField, initial, 'Coordonnateur').errors.role.length > 0, true);
assert.equal(validateFieldGeneralDraft(editableField, { ...initial, fieldType: 'script' }, 'Administrateur').errors.fieldType.length > 0, true);
assert.equal(validateFieldGeneralDraft(editableField, { ...initial, tableName: 'infrastructures' }, 'Administrateur').errors.tableName.length > 0, true);
assert.equal(validateFieldGeneralDraft(editableField, { ...initial, technicalName: 'autre' }, 'Administrateur').errors.technicalName.length > 0, true);
assert.equal(validateFieldGeneralDraft({ ...editableField, id: 'physical:clients.nom' }, initial, 'Administrateur').errors.field.length > 0, true);

for (const protectedField of [
  { ...editableField, technicalName: 'support_id' },
  { ...editableField, technicalName: 'client_id' },
  { ...editableField, technicalName: 'photo_principale_url', tableName: 'infrastructures' },
  { ...editableField, technicalName: 'photo_miniature_url', tableName: 'infrastructures' },
  { ...editableField, technicalName: 'visuel_actuel_cadre', tableName: 'infrastructures' },
  { ...editableField, primaryKey: true },
  { ...editableField, system: true }
]) assert.equal(isProtectedCatalogField(protectedField), true);

const component = await readFile(new URL('../src/components/field-catalog/FieldCatalogGeneralTab.jsx', import.meta.url), 'utf8');
const drawer = await readFile(new URL('../src/components/field-catalog/FieldCatalogDrawer.jsx', import.meta.url), 'utf8');
const manager = await readFile(new URL('../src/components/FieldCatalogManager.jsx', import.meta.url), 'utf8');
const writeService = await readFile(new URL('../src/services/fieldCatalogWriteService.js', import.meta.url), 'utf8');
const validationService = await readFile(new URL('../src/services/fieldCatalogValidationService.js', import.meta.url), 'utf8');
const combined = [component, drawer, manager, writeService, validationService].join('\n');

assert.match(component, /Enregistrer le brouillon/);
assert.match(component, /Annuler/);
assert.match(component, /setDraft\(initial\)/);
assert.match(component, /beforeunload/);
assert.match(drawer, /window\.confirm/);
assert.match(component, /readOnly aria-readonly="true"/);
assert.match(component, /value="Brouillon"/);
assert.doesNotMatch(combined, />\s*Activer\s*</);
assert.match(writeService, /save_relation_field_general_draft_v0131a3/);
assert.match(writeService, /validateFieldGeneralDraft/);
assert.match(writeService, /p_table_name: field\.tableName/);
assert.match(writeService, /p_field_name: field\.technicalName/);
assert.match(manager, /catalog\.invalidate\(\)/);
assert.doesNotMatch(writeService, /\.from\(/, 'Le service doit écrire uniquement par la RPC contrôlée.');

const migration = await readFile(new URL('../supabase/V0_13_1_A3_FIELD_GENERAL_DRAFT.sql', import.meta.url), 'utf8');
for (const required of [
  'create table if not exists public.relation_field_config_audit',
  'security definer',
  "public.current_app_role() <> 'Administrateur'",
  'auth.uid() is null',
  'from public.relation_fields',
  'table_name = p_table_name',
  'field_name = p_field_name',
  'for update',
  'Type fonctionnel invalide',
  "configuration_status = 'draft'",
  'insert into public.relation_field_config_audit',
  'old_values',
  'new_values',
  'changed_by',
  'changed_at',
  "'draft'",
  'revoke all on public.relation_field_config_audit',
  'grant execute on function public.save_relation_field_general_draft_v0131a3'
]) assert.ok(migration.includes(required), `Protection SQL manquante : ${required}`);

assert.doesNotMatch(migration, /\bexecute\s+(format|\()/i, 'Aucun SQL dynamique n’est permis.');
assert.doesNotMatch(migration, /\b(alter|update|insert into|delete from)\s+public\.(infrastructures|clients|bons_de_travail|suivi_des_edt)\b/i);
assert.doesNotMatch(migration, /create policy|drop policy/i);
assert.doesNotMatch(migration, /configuration_status\s*=\s*'active'/i);
assert.match(migration, /set field_label = trim\(p_field_label\),[\s\S]*field_type = p_field_type,[\s\S]*help_text = [\s\S]*display_order = p_display_order,[\s\S]*configuration_status = 'draft'/);
assert.doesNotMatch(migration, /set[\s\S]{0,500}(table_name|field_name)\s*=/i, 'La RPC ne doit jamais renommer le champ ou sa table.');

const verifier = await readFile(new URL('../supabase/VERIFIER_V0_13_1_A3_FIELD_GENERAL_DRAFT.sql', import.meta.url), 'utf8');
assert.match(verifier, /begin read only/i);
assert.match(verifier, /rollback/i);
assert.doesNotMatch(verifier, /^\s*(update|insert|delete|truncate)\b/im);

for (const file of [
  '../src/components/RelationsStudio.jsx', '../src/services/relationService.js',
  '../src/components/EditableField.jsx', '../src/services/universalEditorService.js',
  '../src/components/TerrainApp.jsx', '../src/components/Support360Panel.jsx',
  '../src/lib/utils.js'
]) {
  const source = await readFile(new URL(file, import.meta.url), 'utf8');
  assert.doesNotMatch(source, /save_relation_field_general_draft_v0131a3|fieldCatalogWriteService/);
}

console.log('Phase 13.1-A3 : 58 contrôles de configuration générale en brouillon réussis.');
