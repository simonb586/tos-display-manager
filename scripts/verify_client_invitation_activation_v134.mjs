import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const invite = read('supabase/functions/invite-user/index.ts');
const manage = read('supabase/functions/manage-user/index.ts');
const main = read('src/main.jsx');
const activation = read('src/components/AccountActivation.jsx');
const state = read('src/services/accountActivationService.js');
const profile = read('src/services/authProfileService.js');
const vercel = JSON.parse(read('vercel.json'));

assert.match(invite, /auth\.admin\.inviteUserByEmail/);
assert.match(invite, /Deno\.env\.get\('CLIENT_PORTAL_URL'\)/);
assert.match(invite, /`\$\{publicSiteUrl\(\)\}\/accept-invitation`/);
assert.match(manage, /`\$\{publicSiteUrl\(\)\}\/accept-invitation`/);
assert.match(main, /pathname\.replace[\s\S]*'\/set-password'/);
assert.match(main, /if \(isSetPasswordRoute\) return <AccountActivation/);
const activationRouteIndex = main.indexOf('if (isSetPasswordRoute) return <AccountActivation');
assert.ok(activationRouteIndex < main.indexOf('if (!session) return', activationRouteIndex), 'activation avant Login');
assert.match(activation, /Créer votre mot de passe/);
assert.match(activation, /Nouveau mot de passe/);
assert.match(activation, /Confirmer le mot de passe/);
assert.match(activation, /Créer mon mot de passe/);
assert.match(activation, /auth\.getSession\(\)/);
assert.match(activation, /auth\.updateUser\(\{[\s\S]*password/);
assert.match(activation, /disabled=\{!valid \|\| busy\}/);
assert.match(activation, /Cette invitation a expiré ou n’est plus valide\./);
assert.match(activation, /Lien d’activation invalide ou expiré\./);
assert.match(activation, /Ce compte est déjà activé\./);
assert.match(state, /metadata\.account_activated === false/);
assert.match(state, /status\.includes\('invitation'\)/);
assert.match(main, /getCurrentProfile\(\{ \.\.\.session, user: authData\.user \}\)/);
assert.match(main, /setRole\(nextProfile\.role\)/);
assert.doesNotMatch(activation, /setRole|setClient|client_id\s*=/);
assert.match(profile, /\/update-password/);
assert.deepEqual(vercel.rewrites, [{ source: '/(.*)', destination: '/index.html' }]);
for (const frontend of [main, activation, state, profile]) {
  assert.doesNotMatch(frontend, /SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|service_role/i);
}
for (const role of ['Client', 'Client-Admin']) assert.ok(main.includes(`'${role}'`), role);

console.log('V1.3.4 invitation Client/Client-Admin : contrat d’activation validé.');
