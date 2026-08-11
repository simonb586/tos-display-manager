import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync('supabase/V1_3_1_1_EDT_EMAIL_WORKFLOW_RECOVERY.sql', 'utf8');
const verifier = fs.readFileSync('supabase/VERIFIER_V1_3_1_1_EDT_EMAIL_WORKFLOW_RECOVERY_READ_ONLY.sql', 'utf8');
const executable = migration.replace(/^\s*--.*$/gm, '').replace(/'([^']|'')*'/g, "''");
let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks += 1; };

ok(/^\s*--[^\n]*\n(?:\s*--[^\n]*\n)*\s*begin;/i.test(migration), 'migration transactionnelle');
ok(/commit;\s*$/i.test(migration), 'commit final');
ok(!/\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b|\bcascade\b/i.test(executable), 'aucune opération destructive interdite');
ok(/add column if not exists requester_contact_id bigint/i.test(migration), 'colonne additive');
ok((migration.match(/create (?:unique )?index if not exists/gi) || []).length >= 5, 'index idempotents');
ok(/pg_constraint/.test(migration) && /pg_get_constraintdef/.test(migration), 'contraintes inspectées');

for (const policy of ['email_outbox_staff_read_v131', 'email_delivery_staff_read_v131']) {
  const drop = migration.indexOf(`drop policy if exists ${policy}`);
  const create = migration.indexOf(`create policy ${policy}`);
  ok(drop >= 0 && create > drop, `policy convergente ${policy}`);
}

for (const trigger of ['validate_edt_requester_v131', 'enqueue_edt_completion_email_v131', 'edt_email_activity_v131']) {
  const drop = migration.lastIndexOf(`drop trigger if exists ${trigger}`);
  const create = migration.lastIndexOf(`create trigger ${trigger}`);
  ok(drop >= 0 && create > drop, `trigger convergent ${trigger}`);
}

for (const fn of [
  ['validate_edt_requester_v131', ''], ['enqueue_edt_completion_email_v131', ''],
  ['request_edt_email_retry_v131', 'bigint,boolean'], ['edt_email_status_v131', 'bigint'],
  ['claim_edt_completion_email_v131', 'bigint,integer'], ['edt_email_activity_v131', '']
]) {
  const create = migration.indexOf(`create or replace function public.${fn[0]}`);
  const revoke = migration.indexOf(`revoke all on function public.${fn[0]}(${fn[1]})`);
  ok(create >= 0 && revoke > create, `CREATE avant REVOKE ${fn[0]}`);
}

for (const token of [
  'security definer set search_path=public,pg_temp', "auth.role()<>'service_role'",
  "auth.uid() is null", "('Administrateur','Coordonnateur')", 'for update skip locked',
  "old.statut is distinct from 'Complété'", "new.statut='Complété'",
  'email_outbox_automatic_completion_uq', 'email_delivery_log_success_uq',
  'enable row level security', 'revoke all on public.email_outbox,public.email_delivery_log from public,anon,authenticated'
]) ok(migration.includes(token), token);

ok(/^\s*--[^\n]*\n\s*begin read only;/i.test(verifier), 'vérificateur BEGIN READ ONLY');
ok(/rollback;\s*$/i.test(verifier), 'vérificateur ROLLBACK');
const verifierExecutable = verifier.replace(/^\s*--.*$/gm, '').replace(/'([^']|'')*'/g, "''");
ok(!/\b(insert|update|delete|alter|create|drop|truncate|grant|revoke)\b/i.test(verifierExecutable), 'vérificateur sans écriture');
for (const token of ['PRESENT_AND_CONFORMING', 'PRESENT_BUT_MISMATCHED', 'MISSING', 'aclexplode', 'pg_get_functiondef', 'pg_get_triggerdef', 'cross_client_fixture_unavailable', 'storage.buckets', 'activity_events']) ok(verifier.includes(token), token);

console.log(`V1.3.1.1 recovery: ${checks} contrôles statiques réussis; aucun SQL exécuté.`);
