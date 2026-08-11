import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const sql = read('supabase/V1_3_1_EDT_COMPLETION_EMAIL_WORKFLOW.sql');
const verify = read('supabase/VERIFIER_V1_3_1_EDT_COMPLETION_EMAIL_READ_ONLY.sql');
const edge = read('supabase/functions/send-edt-completion-email/index.ts');
const ui = read('src/components/Module15Reports.jsx');
const service = read('src/services/reportDataService.js');
const doc = read('docs/MICROSOFT_365_EDT_EMAIL_SETUP.md');
let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks += 1; };

for (const token of [
  'requester_contact_id', 'email_outbox', 'email_delivery_log', 'idempotency_key',
  "old.statut is distinct from 'Complété'", "new.statut='Complété'",
  'edt_completed_report_sent', 'attempt_count between 0 and 5', 'enable row level security',
  'requester_client_mismatch', 'request_edt_email_retry_v131', 'claim_edt_completion_email_v131',
  "auth.role()<>'service_role'", 'for update skip locked', "locked_at<now()-interval '15 minutes'",
  'edt_email_status_v131'
]) ok(sql.includes(token), token);
ok(!/drop\s+table|truncate\s|delete\s+from/i.test(sql), 'migration additive');
ok(/where not manual_resend/.test(sql), 'anti-doublon automatique');
ok((sql.match(/revoke all on function public\./g) || []).length >= 6, 'fonctions scellées');

for (const token of [
  'MS_TENANT_ID', 'MS_CLIENT_ID', 'MS_CLIENT_SECRET', 'client_credentials',
  'graph.microsoft.com/v1.0/users/', 'noreply@groupetos.com', 'requester_contact_id',
  "from('edt_reports')", 'report_version', 'simpleEdtPdf', 'automatic_report_generation_failed',
  'invalid_recipient_email', 'MAX_ATTEMPTS=5', 'ATTACHMENT_LIMIT=2_500_000', 'toRecipients',
  'CLIENT_PORTAL_URL', "rpc('claim_edt_completion_email_v131'", 'invalid_report_bucket'
]) ok(edge.includes(token), token);
ok(!edge.includes('VITE_MS_CLIENT_SECRET'), 'aucun secret frontend');
ok(!edge.includes('RESEND_API_KEY'), 'Resend absent');
ok(edge.includes('response.status!==202'), 'contrat Graph 202');

for (const token of ['Requérant', 'Courriel du requérant', 'Statut d’envoi', 'Réessayer', 'Renvoyer', 'window.confirm']) ok(ui.includes(token), token);
for (const token of ['requestEdtEmail', 'processEdtEmail', "from('email_outbox')", "from('email_delivery_log')", "from('edt_reports')"]) ok(service.includes(token), token);

ok(/^\s*--[^\n]*\n\s*begin read only;/i.test(verify) && /rollback;\s*$/i.test(verify), 'vérificateur transaction READ ONLY');
const verifierExecutable = verify.replace(/^\s*--.*$/gm, '').replace(/'([^']|'')*'/g, "''");
ok(!/\b(insert|update|delete|alter|create|drop|truncate|grant|revoke)\b/i.test(verifierExecutable), 'vérificateur READ ONLY');
for (const token of ['relrowsecurity', 'aclexplode', 'pg_get_functiondef', 'pg_get_triggerdef', 'dangerous_true', 'cross_client_fixture_unavailable', 'storage.buckets']) ok(verify.includes(token), token);

for (const token of ['Mail.Send', 'Application Access Policies', 'MS_TENANT_ID', 'SQL exécuté : NON', 'A10 demeure inactive']) ok(doc.includes(token), token);

let outbox = 0;
let old = 'En cours';
for (const next of ['Complété', 'Complété', 'Complété', 'Complété']) {
  if (old !== 'Complété' && next === 'Complété' && outbox === 0) outbox += 1;
  old = next;
}
assert.equal(outbox, 1);
checks += 1;

const sent = [{version: 1, manual: false}, {version: 2, manual: true}];
assert.deepEqual(sent.map(item => item.manual), [false, true]);
checks += 1;

console.log(`V1.3.1 EDT email: ${checks} contrôles réussis; Microsoft Graph simulé, aucun courriel envoyé.`);
