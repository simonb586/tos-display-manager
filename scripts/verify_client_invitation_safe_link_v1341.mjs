import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { acceptInvitation, invitationErrorMessage, readInvitationParameters } from '../src/services/invitationAcceptanceService.js';

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const tokenHash = 'abcdefghijklmnopqrstuvwxyz_1234567890-ABC';
let verifyCalls = 0;
const auth = {
  async verifyOtp(input) {
    verifyCalls += 1;
    assert.deepEqual(input, { token_hash: tokenHash, type: 'invite' });
    return { data: { session: { user: { id: 'invited-user' } } }, error: null };
  },
  async getSession() { return { data: { session: null } }; }
};

for (let index = 0; index < 3; index += 1) {
  const parsed = readInvitationParameters({ search: `?token_hash=${tokenHash}&type=invite&role=Administrateur&client_id=999` });
  assert.equal(parsed.valid, true);
  assert.equal(parsed.tokenHash, tokenHash);
}
assert.equal(verifyCalls, 0, 'GET non consommant');
const session = await acceptInvitation({ auth }, tokenHash);
assert.equal(verifyCalls, 1, 'clic consommant une seule fois');
assert.equal(session.user.id, 'invited-user', 'session créée avant /set-password');

assert.equal(readInvitationParameters({ search: '?type=invite' }).valid, false);
assert.equal(readInvitationParameters({ search: `?token_hash=${tokenHash}&type=recovery` }).valid, false);
assert.match(invitationErrorMessage({ code: 'otp_expired' }), /expiré/);
assert.match(invitationErrorMessage({ message: 'Token already been used' }), /déjà été utilisé/);
assert.match(invitationErrorMessage({ code: 'validation_failed' }), /invalide/);

const component = read('src/components/InvitationAcceptance.jsx');
const service = read('src/services/invitationAcceptanceService.js');
const main = read('src/main.jsx');
const activation = read('src/components/AccountActivation.jsx');
const activationService = read('src/services/accountActivationService.js');
const inviteUser = read('supabase/functions/invite-user/index.ts');
const manageUser = read('supabase/functions/manage-user/index.ts');

assert.match(main, /isAcceptInvitationRoute[\s\S]*InvitationAcceptance/);
assert.match(main, /isSetPasswordRoute[\s\S]*AccountActivation/);
assert.match(component, /attemptActive\.current/);
assert.match(component, /window\.location\.assign\('\/set-password'\)/);
assert.doesNotMatch(component, /params\.get\(['"](?:role|client_id|organisation|auth_user_id)/i);
assert.doesNotMatch(service, /params\.get\(['"](?:role|client_id|organisation|auth_user_id)/i);
assert.equal((service.match(/verifyOtp/g) || []).length, 1);
assert.doesNotMatch(service, /exchangeCodeForSession|updateUser|service_role/i);
assert.match(activation, /getSession\(\)[\s\S]*updateUser\(\{[\s\S]*password/);
assert.match(activation, /completeClientInvitationActivation/);
assert.match(activationService, /complete_client_activation/);
assert.match(inviteUser, /clientAdminOrigin[\s\S]*role='Client'[\s\S]*clientId=Number\(callerProfile\.client_id\)/);
assert.match(inviteUser, /cross_client_denied/);
assert.match(inviteUser, /CLIENT_PORTAL_URL/);
assert.match(inviteUser, /\/accept-invitation/);
assert.match(manageUser, /resend_invite[\s\S]*\/accept-invitation/);
assert.match(manageUser, /email_confirmed_at[\s\S]*\/update-password/);

console.log('SUCCESS — invitation V1.3.4.1 : GET non consommant, clic unique, session, renvoi, activation Client et isolation vérifiés.');
