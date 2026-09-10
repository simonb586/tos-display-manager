import assert from'node:assert/strict';
import fs from'node:fs';

const migration=fs.readFileSync('supabase/migrations/20260901145601_terrain_issue_client_derivation_v138.sql','utf8');
const main=fs.readFileSync('src/main.jsx','utf8');

for(const marker of [
  'derive_terrain_issue_client_v138',
  'from public.infrastructures i',
  'i.support_id = new.support_id',
  'new.client_id := v_client_id',
  'terrain_issue_client_ownership_required',
  'terrain_issue_client_ownership_mismatch',
  "set search_path = ''",
  'security invoker',
  'revoke all on function public.derive_terrain_issue_client_v138() from public, anon',
  'before insert or update of support_id, client_id'
])assert.ok(migration.toLowerCase().includes(marker.toLowerCase()),marker);

assert.doesNotMatch(migration,/new\.client_id\s*:=\s*2\b/i);
assert.doesNotMatch(migration,/update\s+public\.enjeux_terrain\s+set\s+client_id/i);
assert.match(main,/'Enjeux des cadres et supports': \{ table: 'enjeux_des_cadres_et_supports', loader: loadInternalIssues/);
// The canonical view now merges history and Terrain. Execute its production
// normalization/merge contracts instead of requiring a Terrain-only table.
await import('./verify_internal_issues_restoration_v1310.mjs');
console.log('V1.3.8 Terrain enjeux : dérivation statique et fusion locale Historique/Terrain PASS.');
