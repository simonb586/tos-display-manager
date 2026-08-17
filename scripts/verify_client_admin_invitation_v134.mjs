import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(path,'utf8');
const edge=read('supabase/functions/invite-user/index.ts');
const service=read('src/services/clientPortalService.js');
const activation=read('src/components/AccountActivation.jsx');
const activationService=read('src/services/accountActivationService.js');
const sql=read('supabase/V1_2_0_MODULE_17_CLIENT_PORTAL_SECURITY_PREPARED.sql');

for(const token of [
  "rpc('client_admin_invite_member_v120'",
  "supabase.functions.invoke('invite-user'",
  "origin:'client-admin'",
  'invitation_id:invitation.invitation_id',
  "error?.code!=='23505'",
  ".from('client_member_invitations')",
  ".eq('status','pending')"
])assert.ok(service.includes(token),token);
for(const token of [
  "clientAdminOrigin=body.origin==='client-admin'",
  "callerProfile.role!=='Client-Admin'",
  "role='Client'",
  'clientId=Number(callerProfile.client_id)',
  "organisation=String(callerProfile.organisation||'')",
  ".from('client_member_invitations')",
  "businessInvite.requested_role!=='Client'",
  "businessInvite.status!=='pending'",
  "error:'cross_client_denied'",
  'auth.admin.inviteUserByEmail',
  "auth.resend({type:'invite'",
  'Un compte existe déjà pour cette adresse.',
  "`${publicSiteUrl()}/accept-invitation`",
  "body.action==='complete_client_activation'",
  ".update({status:'accepted'})"
])assert.ok(edge.includes(token),token);
assert.ok(edge.indexOf("role='Client'")>edge.indexOf('clientAdminOrigin'), 'rôle Client imposé après lecture du payload');
assert.doesNotMatch(service,/client_id\s*:/);
assert.doesNotMatch(service,/role\s*:/);
assert.match(sql,/unique\(client_id,email,status\)/);
assert.match(sql,/requested_role text not null default 'Client' check\(requested_role='Client'\)/);
assert.match(sql,/where auth_user_id=auth\.uid\(\) and statut='Actif' and role='Client-Admin'/);
assert.match(activation,/completeClientInvitationActivation/);
assert.match(activationService,/action: 'complete_client_activation'/);
for(const frontend of [service,activation,activationService])assert.doesNotMatch(frontend,/SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY/);
console.log('V1.3.4 Client-Admin → Client : RPC, Edge Auth, isolation, anti-doublon, renvoi et activation validés.');
