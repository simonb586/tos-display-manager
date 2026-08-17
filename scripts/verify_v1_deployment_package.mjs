import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const root=process.cwd(),dir=join(root,'supabase','deployment-v1')
const expected=['00_README_DEPLOYMENT.md','01_PRODUCTION_PRECHECK.sql','02_V1_REQUIRED_MIGRATIONS.sql','02_V1_REQUIRED_MIGRATIONS_EXECUTABLE.sql','03_PRODUCTION_POSTCHECK.sql','04_V1_ROLLBACK_PLAN.md','05_V1_SMOKE_TESTS.md','06_VERCEL_DEPLOYMENT_CHECKLIST.md','07_V1_SIMPLE_GUIDE.md','08_SHA256_MANIFEST.md']
const names=await readdir(dir)
for(const name of expected)assert(names.includes(name),`fichier absent: ${name}`)
const load=name=>readFile(join(dir,name),'utf8')
const [readme,pre,order,executable,post,rollback,smoke,vercel,guide,manifest]=await Promise.all(expected.map(load))

assert.match(readme,/stratégie A/i)
assert.match(readme,/Niveau 1/i);assert.match(readme,/Niveau 2/i);assert.match(readme,/Niveau 3/i)
for(const [label,sql] of [['précontrôle',pre],['postcontrôle',post]]){
 assert.match(sql,/^\s*--[^\n]*\nBEGIN READ ONLY;/im,`${label}: BEGIN READ ONLY absent`)
 assert.match(sql,/ROLLBACK;\s*$/i,`${label}: ROLLBACK final absent`)
 const statements=sql.replace(/--.*$/gm,'')
 assert.doesNotMatch(statements,/\b(?:insert|update|delete|truncate|drop|alter|create|grant|revoke)\b/i,`${label}: mutation détectée`)
}
assert.match(pre,/\bGO\b/);assert.match(pre,/NO-GO/)
for(const [label,sql] of [['précontrôle',pre],['postcontrôle',post]])assert.doesNotMatch(sql,/order\s+by\s+signature\s*::\s*text/i,`tri invalide sur alias signature détecté dans le ${label}`)
assert.match(post,/GO POUR DÉPLOIEMENT FRONTAL/);assert.match(post,/NO-GO/)

const sequence=['V0_13_1_A_UNIVERSAL_FIELD_CATALOG.sql','V0_13_1_A3_FIELD_GENERAL_DRAFT.sql','V0_13_1_A4_2_DISPLAY_DRAFT.sql','V0_13_1_A5_VALIDATION_DRAFT.sql','V0_13_1_A6_PERMISSION_DRAFT.sql','V0_13_1_A7_TERRAIN_DRAFT.sql','V0_13_1_A8_IMPORT_EXPORT_DRAFT.sql','V0_13_1_1_C1_FIX_A9_AUDIT_TYPES.sql','V0_13_1_A9_RELATIONS_CALCULATIONS_DRAFT.sql','V0_13_1_AUTOMATION_ASSISTANT.sql']
let cursor=-1
for(const file of sequence){const next=order.indexOf(file,cursor+1);assert(next>cursor,`ordre incorrect: ${file}`);cursor=next}
assert(order.indexOf('V0_13_1_A8_IMPORT_EXPORT_DRAFT.sql')<order.indexOf('V0_13_1_1_C1_FIX_A9_AUDIT_TYPES.sql'))
assert(order.indexOf('V0_13_1_1_C1_FIX_A9_AUDIT_TYPES.sql')<order.indexOf('V0_13_1_A9_RELATIONS_CALCULATIONS_DRAFT.sql'))
assert.doesNotMatch(order,/ALTER\s+TABLE[\s\S]*VALIDATE\s+CONSTRAINT/i,'validation C1 automatique détectée')
assert.match(order,/POINT D’ARRÊT/g)

let executableCursor=-1
const executableNormalized=executable.replace(/\r\n/g,'\n')
for(const file of sequence){
 const source=await readFile(join(root,'supabase',file),'utf8')
 const sourceNormalized=source.replace(/\r\n/g,'\n')
 const marker=`SOURCE ${sequence.indexOf(file)+1}/10 : ${file}`
 const markerPosition=executableNormalized.indexOf(marker,executableCursor+1)
 assert(markerPosition>executableCursor,`section exécutable absente ou désordonnée: ${file}`)
 assert(executableNormalized.indexOf(sourceNormalized,markerPosition)>=markerPosition,`contenu source non fidèle: ${file}`)
 const digest=createHash('sha256').update(sourceNormalized).digest('hex')
 assert(manifest.includes(`${digest}  supabase/${file}`),`empreinte source incohérente: ${file}`)
 executableCursor=markerPosition
}
assert(executable.indexOf('V0_13_1_A8_IMPORT_EXPORT_DRAFT.sql')<executable.indexOf('V0_13_1_1_C1_FIX_A9_AUDIT_TYPES.sql'))
assert(executable.indexOf('V0_13_1_1_C1_FIX_A9_AUDIT_TYPES.sql')<executable.indexOf('V0_13_1_A9_RELATIONS_CALCULATIONS_DRAFT.sql'))
assert.doesNotMatch(executable,/A10|VALIDATE\s+CONSTRAINT/i,'A10 ou validation globale C1 détectée')
assert.doesNotMatch(executable,/\bTRUNCATE\b|\bDROP\s+TABLE\b/i,'suppression ou réinitialisation détectée')
assert.doesNotMatch(executable,/EXCEPTION\s+WHEN\s+OTHERS|\bretry\b|\bCONTINUE\b/i,'contournement d’erreur détecté')
assert.match(executable,/SELECT 'V1_MIGRATIONS_COMPLETE' AS verdict;\s*$/)

const all=(await Promise.all(names.map(load))).join('\n')
for(const pattern of [/service_role/i,/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,/postgres(?:ql)?:\/\//i,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,/cmdfomowtzrinywdsosy/i])assert.doesNotMatch(all,pattern,`contenu interdit: ${pattern}`)
assert.doesNotMatch(all,/localhost|127\.0\.0\.1|0\.0\.0\.0/i,'adresse locale détectée')
assert.doesNotMatch(all,/\bsupabase\s+(?:db|link|push|migration)|\bpsql\b|\bpg_dump\b/i,'commande interdite détectée')
assert.match(rollback,/frontal Vercel|déploiement Vercel/i)
for(const item of ['Administrateur','Infrastructure','fiche 360','photos','Terrain','Studio des relations','Gestionnaire des champs','stale_draft'])assert(smoke.toLocaleLowerCase('fr').includes(item.toLocaleLowerCase('fr')),`smoke test absent: ${item}`)
for(const item of ['npm install','npm run build','dist','VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY','PUBLIC_SITE_URL'])assert(vercel.includes(item),`check Vercel absent: ${item}`)
assert.match(guide,/01_PRODUCTION_PRECHECK\.sql/);assert.match(guide,/02_V1_REQUIRED_MIGRATIONS_EXECUTABLE\.sql/);assert.match(guide,/03_PRODUCTION_POSTCHECK\.sql/)
assert.match(manifest,/SHA-256/)
console.log(`Déploiement V1: ${expected.length} fichiers, stratégie A, ordre et garde-fous conformes.`)
