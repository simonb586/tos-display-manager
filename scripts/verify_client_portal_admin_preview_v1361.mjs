import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const ui = read('src/components/ClientsAccessAdmin.jsx');
const service = read('src/services/clientAccessAdminService.js');
const sql = read('supabase/V1_3_6_1_CLIENT_PORTAL_PREVIEW_VIEW_COVERAGE_PREPARED.sql');

assert.match(ui, /Voir comme l’utilisateur/);
assert.match(ui, /APERÇU ADMINISTRATEUR/);
assert.match(ui, /Vous êtes toujours connecté comme Administrateur/);
assert.match(ui, /Quitter l’aperçu/);
assert.match(ui, /resolveClientPortalViews/);
assert.match(ui, /Vues configurées/);
assert.match(ui, /Vues implémentées/);
assert.match(ui, /Vues non prises en charge/);
assert.match(service, /admin_preview_client_portal_context_v1361/);
assert.ok(!ui.includes('signInWithPassword'), 'Preview must not authenticate as target user.');
assert.ok(!ui.includes('service_role'), 'Preview must not expose service_role in browser code.');
assert.ok(!ui.includes('auth_user_id=') && !ui.includes('auth.uid()='), 'Preview UI must not rewrite auth identity.');

for (const marker of [
  'p_target_user_id',
  "a.role='Administrateur'",
  'v_client',
  'v_role',
  'role_ui_permissions',
  'client_id=v_client',
  'client_published',
  'client_visible',
  'revoke all on function public.admin_preview_client_portal_context_v1361'
]) assert.ok(sql.includes(marker), marker);

console.log('V1.3.6.1 aperçu admin: bouton, bannière, diagnostic et RPC de preview sans impersonation Auth validés.');
