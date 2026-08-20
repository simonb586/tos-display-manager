import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const service = read('src/services/clientPortalService.js');
const sql = read('supabase/V1_3_6_1_CLIENT_PORTAL_PREVIEW_VIEW_COVERAGE_PREPARED.sql');

for (const section of ['poster_directory','information_centers','information_centers_issues','stops','vehicles_trains']) {
  assert.ok(service.includes(section), `${section} must be an allowed client portal section.`);
  assert.ok(sql.includes(`'${section}'`), `${section} must be handled server-side.`);
}

for (const marker of [
  'auth.uid()',
  'public.utilisateurs',
  'v_client',
  'v_role',
  'public.campagnes_maitres',
  'public.campagnes_supports',
  'public.client_can_access_campaign_v120',
  'client_published',
  'client_visible',
  'public.infrastructures'
]) assert.ok(sql.includes(marker), marker);

assert.ok(!service.includes('client_id:'), 'Frontend must not pass client_id as authority.');
assert.ok(!service.includes('role:'), 'Frontend must not pass role as authority.');
assert.ok(!sql.includes('alter table public.infrastructures add column'), 'Do not add client_id to infrastructures.');

console.log('V1.3.6.1 périmètre données Client: client réel, campagnes, supports et infrastructures restent dérivés côté serveur.');
