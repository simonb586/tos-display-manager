import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const root = process.cwd()
const pack = join(root, 'supabase', 'preproduction-v13.1')
const expected = [
  '00_README.md','01_PRECHECK.sql','02_MIGRATION_ORDER.md','03_POSTCHECK.sql',
  '04_ROLLBACK_PLAN.md','05_MANUAL_TESTS.md','06_GO_NO_GO_CHECKLIST.md',
  '07_VALIDATE_C1_CONSTRAINT.sql','08_SIMPLE_EXECUTION_GUIDE.md','09_SHA256_MANIFEST.md'
]
const files = await readdir(pack)
for (const name of expected) assert(files.includes(name), `fichier manquant: ${name}`)
const load = name => readFile(join(pack, name), 'utf8')
const [pre, order, post, validate, checklist, manifest] = await Promise.all([
  load('01_PRECHECK.sql'),load('02_MIGRATION_ORDER.md'),load('03_POSTCHECK.sql'),
  load('07_VALIDATE_C1_CONSTRAINT.sql'),load('06_GO_NO_GO_CHECKLIST.md'),load('09_SHA256_MANIFEST.md')
])

const sequence = [
 '01_PRECHECK.sql','V0_13_1_A_UNIVERSAL_FIELD_CATALOG.sql','VERIFIER_V0_13_1_A_UNIVERSAL_FIELD_CATALOG.sql',
 'V0_13_1_A3_FIELD_GENERAL_DRAFT.sql','VERIFIER_V0_13_1_A3_FIELD_GENERAL_DRAFT.sql',
 'V0_13_1_A4_2_DISPLAY_DRAFT.sql','VERIFIER_V0_13_1_A4_2_DISPLAY_DRAFT.sql',
 'V0_13_1_A5_VALIDATION_DRAFT.sql','VERIFIER_V0_13_1_A5_VALIDATION_DRAFT.sql',
 'V0_13_1_A6_PERMISSION_DRAFT.sql','VERIFIER_V0_13_1_A6_PERMISSION_DRAFT.sql',
 'V0_13_1_A7_TERRAIN_DRAFT.sql','VERIFIER_V0_13_1_A7_TERRAIN_DRAFT.sql',
 'V0_13_1_A8_IMPORT_EXPORT_DRAFT.sql','VERIFIER_V0_13_1_A8_IMPORT_EXPORT_DRAFT.sql',
 'V0_13_1_1_C1_FIX_A9_AUDIT_TYPES.sql','VERIFIER_V0_13_1_1_C1_FIX_A9_AUDIT_TYPES.sql',
 'V0_13_1_A9_RELATIONS_CALCULATIONS_DRAFT.sql','VERIFIER_V0_13_1_A9_RELATIONS_CALCULATIONS_DRAFT.sql','03_POSTCHECK.sql'
]
let cursor = -1
for (const token of sequence) {
  const next = order.indexOf(token, cursor + 1)
  assert(next > cursor, `ordre absent ou incorrect: ${token}`)
  cursor = next
}
assert(order.indexOf('V0_13_1_A8_IMPORT_EXPORT_DRAFT.sql') < order.indexOf('V0_13_1_1_C1_FIX_A9_AUDIT_TYPES.sql'))
assert(order.indexOf('V0_13_1_1_C1_FIX_A9_AUDIT_TYPES.sql') < order.indexOf('V0_13_1_A9_RELATIONS_CALCULATIONS_DRAFT.sql'))

for (const [name, sql] of [['précontrôle',pre],['postcontrôle',post]]) {
  assert(/^\s*--[^\n]*\nBEGIN READ ONLY;/im.test(sql), `${name}: BEGIN READ ONLY absent`)
  assert(/ROLLBACK;\s*$/i.test(sql), `${name}: ROLLBACK final absent`)
  assert(!/\b(insert|update|delete|truncate|drop|alter|create|grant|revoke)\b\s+(table|into|on|function|policy|trigger)?/i.test(sql), `${name}: SQL mutateur détecté`)
}
assert(validate.includes('NE PAS EXÉCUTER SANS AUTORISATION EXPLICITE'))
assert(/ALTER TABLE public\.relation_field_config_audit\s+VALIDATE CONSTRAINT relation_field_config_audit_type_v01311c1_check/is.test(validate))
assert(/RAISE EXCEPTION[^;]*NO-GO/is.test(validate), 'garde C1 absente')
assert(checklist.includes('NO-GO') && checklist.includes('Cet environnement n’est pas la production.'))
assert(manifest.includes('SHA-256') && manifest.includes('V0_13_1_1_C1_FIX_A9_AUDIT_TYPES.sql'))

const packageText = (await Promise.all(files.map(load))).join('\n')
const forbiddenSecrets = [
  /service_role/i,/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  /postgres(?:ql)?:\/\//i,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /cmdfomowtzrinywdsosy/i
]
for (const pattern of forbiddenSecrets) assert(!pattern.test(packageText), `contenu sensible/interdit détecté: ${pattern}`)
assert(!/\b(supabase\s+(?:db|migration|link|push|deploy)|vercel\s+deploy)\b/i.test(packageText), 'commande de déploiement/exécution détectée')
assert(!/\b13\.4\b|BLOC[- ]13\.4/i.test(packageText), 'travail d’un nouveau bloc détecté')
console.log(`Préproduction 13.1: ${expected.length} fichiers, ordre et garde-fous conformes.`)
