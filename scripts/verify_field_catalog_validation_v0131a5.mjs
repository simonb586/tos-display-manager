import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  EMPTY_VALIDATION_CONFIG,
  normalizeValidationConfig,
  validationConfigChanged,
  validationProtectionReasons,
  compatibleValidationKeys
} from '../src/lib/fieldCatalogValidationDraft.js';

const valid = candidate => {
  const result = normalizeValidationConfig(candidate);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  return result.normalized;
};
const invalid = (candidate, field) => {
  const result = normalizeValidationConfig(candidate);
  assert.equal(result.valid, false);
  assert.ok(result.errors[field]);
};

assert.deepEqual(valid({}), EMPTY_VALIDATION_CONFIG);
assert.equal(valid({ requiredOverride:false }).requiredOverride,false);
assert.equal(valid({ minimumLength:0 }).minimumLength,0);
for (const requiredOverride of [null,true,false]) valid({ requiredOverride });
invalid({ requiredOverride:'false' },'requiredOverride');
invalid({ requiredOverride:1 },'requiredOverride');
for (const value of [null,0,5]) valid({ minimumLength:value, maximumLength:value });
for (const value of [-1,1.2,'2']) invalid({ minimumLength:value },'minimumLength');
invalid({ minimumLength:2,maximumLength:1 },'maximumLength');
assert.equal(Array.from('😀').length,1);
for (const value of [null,0,5,-2,1.25]) valid({ minimumValue:value, maximumValue:value });
for (const value of ['2',NaN,Infinity,-Infinity]) invalid({ minimumValue:value },'minimumValue');
invalid({ minimumValue:2,maximumValue:1 },'maximumValue');

assert.deepEqual(valid({ allowedValues:[] }).allowedValues,[]);
assert.deepEqual(valid({ allowedValues:['1',1,true,'true'] }).allowedValues,['1',1,true,'true']);
for (const value of [[null],[{}],[[1]],['x'.repeat(501)]]) invalid({ allowedValues:value },'allowedValues');
invalid({ allowedValues:['a','a'] },'allowedValues');
invalid({ allowedValues:Array.from({length:101},(_,i)=>i) },'allowedValues');
invalid({ allowedValues:['é'.repeat(33000)] },'allowedValues');
assert.equal(validationConfigChanged({allowedValues:[1,2]},{allowedValues:[2,1]}),true);

for (const key of ['requiredOverride','minimumLength','maximumLength','minimumValue','maximumValue','allowedValues']) {
  assert.equal(valid({errorMessages:{[key]:' Message valide '}}).errorMessages[key],'Message valide');
}
invalid({errorMessages:{unknown:'Non'}},'errorMessages');
invalid({errorMessages:{requiredOverride:1}},'errorMessages');
invalid({errorMessages:{requiredOverride:'  '}},'errorMessages');
valid({errorMessages:{requiredOverride:'x'.repeat(300)}});
invalid({errorMessages:{requiredOverride:'x'.repeat(301)}},'errorMessages');
for (const text of ['<b>Non</b>','<script>alert(1)</script>','javascript:alert(1)','${danger}','{{danger}}']) {
  invalid({errorMessages:{requiredOverride:text}},'errorMessages');
}
invalid({unknown:true},'contract');

const ordinary={id:1,fieldId:'clients.nom',tableName:'clients',technicalName:'nom',
  functionalType:'short_text',technical_name_locked:true,physical:{}};
assert.deepEqual(validationProtectionReasons(ordinary),[]);
assert.deepEqual(compatibleValidationKeys(ordinary),
  ['requiredOverride','minimumLength','maximumLength','allowedValues','errorMessages']);
for (const field of [
  {...ordinary,technicalName:'support_id'},
  {...ordinary,primaryKey:true},
  {...ordinary,foreignKey:true},
  {...ordinary,generated:true},
  {...ordinary,physical:{identity:true}},
  {...ordinary,system:true},
  {...ordinary,functionalType:'calculated'},
  {...ordinary,is_virtual:true}
]) assert.ok(validationProtectionReasons(field).length);

const paths={
  migration:'../supabase/V0_13_1_A5_VALIDATION_DRAFT.sql',
  verifier:'../supabase/VERIFIER_V0_13_1_A5_VALIDATION_DRAFT.sql',
  service:'../src/services/fieldCatalogValidationWriteService.js',
  hook:'../src/hooks/useFieldValidationDraft.js',
  tab:'../src/components/field-catalog/FieldCatalogValidationTab.jsx',
  preview:'../src/components/field-catalog/validation/FieldValidationAdminPreview.jsx',
  registry:'../src/components/field-catalog/tabRegistry.js',
  css:'../src/features/v13/field-catalog-validation.css'
};
const src=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([key,path])=>[
  key,await readFile(new URL(path,import.meta.url),'utf8')
])));
assert.match(src.migration,/alter table public\.relation_field_config_audit[\s\S]*actor_app_role[\s\S]*event_type/);
assert.match(src.migration,/normalize_validation_config_v0131a5/);
assert.match(src.migration,/save_relation_field_validation_draft_v0131a53/);
assert.match(src.migration,/p_expected_updated_at timestamptz/);
assert.match(src.migration,/security definer[\s\S]*set search_path = pg_catalog/i);
assert.match(src.migration,/owner to postgres/);
assert.match(src.migration,/revoke all[\s\S]*from public, anon/i);
assert.match(src.migration,/grant execute[\s\S]*to authenticated/i);
assert.match(src.migration,/auth\.uid\(\)/);
assert.match(src.migration,/current_app_role\(\)/);
assert.match(src.migration,/for update/i);
assert.match(src.migration,/stale_draft/);
assert.match(src.migration,/validation_draft_saved/);
assert.match(src.migration,/configuration_status = 'draft'/);
assert.doesNotMatch(src.migration,/\bexecute\s+(?!on\s+function)|\bformat\s*\(/i);
assert.doesNotMatch(src.migration,/\bdrop\s+(table|column)|truncate|delete\s+from/i);
assert.match(src.verifier,/begin read only/i);
assert.match(src.verifier,/rollback;/i);
assert.doesNotMatch(src.verifier,/\b(select|perform|call)\s+(?:\*\s+from\s+)?public\.save_relation_field_validation_draft_v0131a53\s*\(/i);

assert.equal((src.service.match(/\.rpc\s*\(/g)||[]).length,1);
assert.match(src.service,/p_expected_updated_at/);
assert.doesNotMatch(src.service,/\.from\s*\(|\.update\s*\(|\.insert\s*\(|\.upsert\s*\(|retry|setTimeout/i);
assert.match(src.hook,/submittingRef\.current/);
assert.match(src.hook,/requestRef\.current/);
assert.match(src.hook,/stale_draft/);
assert.match(src.hook,/\[field\?\.fieldId, field\?\.updated_at\]/);
assert.match(src.hook,/validationConfigChanged/);
assert.doesNotMatch(src.hook,/setTimeout|setInterval|debounce|retry/i);
assert.match(src.registry,/id:\s*'validation'/);
for(const text of ['Validation','Brouillon sans effet immédiat','Exigence','Longueur minimale',
  'Valeur minimale','Valeurs permises','Messages d’erreur','Enregistrer le brouillon']){
  assert.ok(src.tab.includes(text),`Texte UX absent: ${text}`);
}
assert.match(src.tab,/aria-describedby=\{state\.errors\.minimumLength/);
assert.match(src.tab,/role=\{\['error','stale_draft'\]/);
assert.match(src.tab,/alertRef\.current\?\.focus\(\)/);
assert.match(src.tab,/Recharger le brouillon/);
assert.match(src.preview,/Prévisualisation administrative simulée/);
assert.doesNotMatch(`${src.tab}\n${src.preview}`,/supabase|supabase\.rpc\s*\(|supabase\.from\s*\(/i);
for(const action of ['Activer','Publier','Appliquer','Déployer','Synchroniser']){
  assert.doesNotMatch(src.tab,new RegExp(`>\\s*${action}\\s*<`,'i'));
}
assert.match(src.css,/min-height:44px/);
assert.match(src.css,/:focus-visible/);
assert.match(src.css,/@media\(max-width:700px\)/);

for(const path of [
  '../src/main.jsx','../src/components/EditableField.jsx','../src/services/universalEditorService.js',
  '../src/components/TerrainApp.jsx','../src/components/Support360Panel.jsx',
  '../src/components/RelationsStudio.jsx','../src/services/relationService.js'
]){
  const source=await readFile(new URL(path,import.meta.url),'utf8');
  assert.doesNotMatch(source,/ValidationConfig|requiredOverride|minimumLength|maximumLength|minimumValue|maximumValue|allowedValues|errorMessages|FieldCatalogValidationTab/);
}
console.log('Phase 13.1-A5 : ValidationConfig 1.0.0, sécurité, UI et isolation validées.');
