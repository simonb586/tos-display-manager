import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  groupSchemaFieldNames,
  groupSchemaMetadata,
  normalizeSchemaMetadata
} from '../src/lib/schemaMetadata.js';

const sample = [
  {
    table_name: 'infrastructures',
    column_name: 'support_id',
    data_type: 'text',
    udt_name: 'text',
    ordinal_position: 2,
    is_nullable: true,
    column_default: null,
    character_maximum_length: null,
    numeric_precision: null,
    numeric_scale: null,
    is_primary_key: false,
    is_unique: true,
    is_foreign_key: false,
    foreign_table_name: null,
    foreign_column_name: null,
    is_generated: false,
    generation_expression: null,
    is_identity: false
  },
  {
    table_name: 'bons_de_travail',
    column_name: 'edt_id',
    data_type: 'bigint',
    udt_name: 'int8',
    ordinal_position: 14,
    is_nullable: true,
    column_default: null,
    character_maximum_length: null,
    numeric_precision: 64,
    numeric_scale: 0,
    is_primary_key: false,
    is_unique: false,
    is_foreign_key: true,
    foreign_table_name: 'suivi_des_edt',
    foreign_column_name: 'id',
    is_generated: false,
    generation_expression: null,
    is_identity: false
  }
];

assert.deepEqual(
  groupSchemaFieldNames(sample),
  {
    infrastructures: ['support_id'],
    bons_de_travail: ['edt_id']
  },
  'Le contrat historique table -> noms de champs doit rester intact.'
);

const normalized = normalizeSchemaMetadata(sample[1]);
assert.equal(normalized.tableName, 'bons_de_travail');
assert.equal(normalized.columnName, 'edt_id');
assert.equal(normalized.dataType, 'bigint');
assert.equal(normalized.numericPrecision, 64);
assert.equal(normalized.foreignKey, true);
assert.equal(normalized.foreignTable, 'suivi_des_edt');
assert.equal(normalized.foreignColumn, 'id');

const grouped = groupSchemaMetadata(sample);
assert.equal(grouped.infrastructures[0].columnName, 'support_id');
assert.equal(grouped.infrastructures[0].unique, true);
assert.equal(grouped.bons_de_travail[0].foreignKey, true);

const serviceSource = await readFile(
  new URL('../src/services/schemaService.js', import.meta.url),
  'utf8'
);
assert.match(serviceSource, /list_public_schema_fields['"]/);
assert.match(serviceSource, /list_public_schema_fields_v0131a/);

const migration = await readFile(
  new URL('../supabase/V0_13_1_A_UNIVERSAL_FIELD_CATALOG.sql', import.meta.url),
  'utf8'
);
for (const required of [
  'alter table public.relation_fields',
  'add column if not exists',
  'configuration_status',
  "default 'unconfigured'",
  'physical_is_primary_key',
  'physical_is_foreign_key',
  'physical_foreign_table',
  'physical_generation_expression',
  'list_public_schema_fields_v0131a',
  'refresh_relation_field_physical_metadata_v0131a'
]) {
  assert.ok(migration.includes(required), `Fondation SQL absente : ${required}`);
}
assert.doesNotMatch(migration, /\bdrop\s+(table|column)\b/i);
assert.doesNotMatch(migration, /\btruncate\b/i);
assert.doesNotMatch(migration, /\bdelete\s+from\b/i);
assert.doesNotMatch(migration, /schema_bloc1/i);
assert.doesNotMatch(
  migration,
  /select\s+public\.refresh_relation_field_physical_metadata_v0131a\s*\(/i,
  'La migration ne doit pas lancer automatiquement la synchronisation des lignes.'
);

const verifier = await readFile(
  new URL('../supabase/VERIFIER_V0_13_1_A_UNIVERSAL_FIELD_CATALOG.sql', import.meta.url),
  'utf8'
);
assert.match(verifier, /begin read only/i);
assert.match(verifier, /rollback/i);
assert.doesNotMatch(verifier, /\b(insert|update|delete|truncate)\b/i);

console.log('Phase 13.1-A1 : 31 contrôles du catalogue universel réussis.');
