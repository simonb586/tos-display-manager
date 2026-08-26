import assert from 'node:assert/strict';import fs from'node:fs';
const sql=fs.readFileSync('supabase/V1_3_6_2_EXO_DATA_OWNERSHIP_CLIENT_PORTAL_SCOPE_PREPARED.sql','utf8'),verifier=fs.readFileSync('supabase/VERIFIER_V1_3_6_2_EXO_DATA_OWNERSHIP_CLIENT_PORTAL_SCOPE_READ_ONLY.sql','utf8');
for(const domain of['infrastructures','campagnes_maitres','campagnes_supports','campagne_visuels_formats','support_photos','suivi_des_edt','edt_phases','enjeux_terrain','bons_de_travail','requetes_clients'])assert.ok(sql.includes(domain),domain);
for(const marker of['CLIENT_REQUIRED','CROSS_CLIENT_ASSIGNMENT_DENIED','client_ownership_summary_v1362','infrastructures_client_support_v1362_idx','auth.uid()','revoke all'])assert.ok(sql.includes(marker),marker);assert.doesNotMatch(sql+verifier,/unaccent\s*\(/i);assert.match(verifier,/to_jsonb\(i\)->>'client_id'/);
assert.match(verifier,/STRICTEMENT READ ONLY/);assert.doesNotMatch(verifier,/\b(insert|update|delete|alter|drop|create|truncate)\s+(into|table|from|public\.)/i);
console.log('V1.3.6.2 ownership PASS.');
