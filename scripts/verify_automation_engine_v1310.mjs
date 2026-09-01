import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const migration=read('supabase/migrations/20260901190142_automation_execution_engine_v1310.sql');
const hardening=read('supabase/migrations/20260901191556_automation_security_hardening_v1310.sql');
const service=read('src/services/automationService.js');
const ui=read('src/components/AutomationAssistant.jsx');
const catalog=read('src/config/automationCatalog.js');
const styles=read('src/features/v13/automation-assistant.css');
let checks=0;
const ok=(condition,message)=>{assert.ok(condition,message);checks+=1;};

for(const token of [
  'automation_resource_states','automation_bindings','relation_execution_logs_automation_idempotency_uidx',
  'correlation_id','execution_depth','idempotency_key','MAX_EXECUTION_DEPTH',
  'execute_automation_event_v1310','tdm_automation_source_trigger_v1310','test_automation_definition_v1310',
  'set_automation_status_v1310','set_automation_binding_status_v1310','set_automation_resource_status_v1310',
  "security definer set search_path=''",'ADMIN_REQUIRED','from public,anon'
]) ok(migration.includes(token),`migration: ${token}`);

for(const label of [
  'Téléversement d’une photo','Suppression d’une photo','Retrait d’un visuel','Désactiver',
  'Réactiver','Déclencheur','Priorité','Dernière modification'
]) ok(`${migration}\n${ui}`.includes(label),`accent: ${label}`);

ok((migration.match(/'13900000-0000-4000-8000-0000000000\d\d'/g)||[]).length>=15,'15 modèles canoniques');
ok((migration.match(/insert into public\.automation_bindings/g)||[]).length===1,'liaisons moteur uniques');
ok(migration.includes("'poster_inventory','Inventaire d’affiches','inactive'"),'inventaire absent explicitement inactif');
ok(migration.includes("'{configuration_only}',to_jsonb(not c.executable)"),'configuration/exécution distinguées');
ok(migration.includes("on conflict (automation_definition_id,idempotency_key)"),'idempotence appliquée');
ok(migration.includes("coalesce(b.resource_status,'inactive')<>'active'")&&migration.includes("'Bloquée'"),'destination inactive bloquée');
ok(migration.includes('exception when others')&&migration.includes("'error',sqlerrm"),'erreur isolée');

for(const token of ['listAutomationEngineState','setAutomationStatus','setAutomationBindingStatus','setAutomationResourceStatus','testAutomationDefinition'])
  ok(service.includes(token),`service: ${token}`);
for(const token of ['Statut modèle','Statut relation','État destination','Dernière exécution','Dernier résultat','Tester','Mettre en pause'])
  ok(ui.includes(token),`UI: ${token}`);
const executionLogProjection=service.match(/from\('relation_execution_logs'\)[\s\S]*?\.select\('([^']+)'\)/)?.[1] || '';
ok(executionLogProjection.split(',').includes('rule_id'),'contrat journaux: relation_execution_logs.rule_id canonique');
ok(!executionLogProjection.split(',').includes('relation_rule_id'),'contrat journaux: relation_rule_id interdit');
ok(!ui.includes('tdm-disabled-view-templates'),'aucun statut de vue dans localStorage');
for(const token of ['automation-config-table','automation-engine-table','automation-views-table','automation-name-cell','automation-actions-cell','automation-mode-cell'])
  ok(ui.includes(token),`grille UI: ${token}`);
for(const token of ['table-layout:fixed','height:72px','vertical-align:middle','position:sticky','right:0','flex-wrap:nowrap','-webkit-line-clamp:2','overflow:auto'])
  ok(styles.includes(token),`alignement UI: ${token}`);
ok(catalog.includes("['paused', 'En pause']"),'statut en pause canonique');
ok(hardening.includes('drop policy if exists relation_test_logs_authenticated_read'),'journal de test réservé aux administrateurs');
ok(hardening.includes("alter function public.approve_automation_definition_v0131(uuid) set search_path=''"),'ancienne approbation durcie');
ok(hardening.includes('from public,anon'),'ancienne approbation refusée à PUBLIC et anon');

console.log(`V1.3.10 moteur d’automatisations : ${checks} contrôles réussis.`);
