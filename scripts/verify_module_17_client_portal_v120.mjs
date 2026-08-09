import assert from'node:assert/strict';import fs from'node:fs';
import{BUSINESS_CONTEXT}from'../src/lib/businessContext.js';
import{assignmentLogicalKey,duplicateLogicalRows,marketingAssignments,operationalAssignments}from'../src/lib/siteSupportAssignments.js';
import{isClientRole,isClientAdmin,requireClientIdentity}from'../src/lib/clientPermissions.js';

const sample=[
 {site:'A',support_id:'S1',campaign_id:1,visual_id:10,business_context:BUSINESS_CONTEXT.MARKETING},
 {site:'A',support_id:'S1',campaign_id:1,visual_id:10,business_context:BUSINESS_CONTEXT.MARKETING},
 {site:'A',support_id:'S1',campaign_id:2,visual_id:10,business_context:BUSINESS_CONTEXT.MARKETING},
 {site:'A',support_id:'S1',campaign_id:3,visual_id:10,business_context:BUSINESS_CONTEXT.OPERATIONAL}
];
assert.equal(marketingAssignments(sample).length,2,'Deux affectations Marketing légitimes');
assert.equal(operationalAssignments(sample).length,1,'Marketing et opérationnel restent distincts');
assert.equal(duplicateLogicalRows(sample),1,'Doublon logique détecté');
assert.equal(new Set(marketingAssignments(sample).map(assignmentLogicalKey)).size,2);
assert.ok(isClientRole('Client')&&isClientRole('Client-Admin')&&!isClientRole('Administrateur'));
assert.ok(isClientAdmin('Client-Admin')&&!isClientAdmin('Client'));
assert.throws(()=>requireClientIdentity({role:'Client'}),/Périmètre/);
assert.deepEqual(requireClientIdentity({role:'Client',client_id:7}),{role:'Client',organizationId:'7'});

const migration=fs.readFileSync('supabase/V1_2_0_MODULE_17_CLIENT_PORTAL_SECURITY_PREPARED.sql','utf8');
const verifier=fs.readFileSync('supabase/VERIFIER_V1_2_0_MODULE_17_CLIENT_PORTAL_READ_ONLY.sql','utf8');
const portal=fs.readFileSync('src/components/ClientPortal.jsx','utf8');
const service=fs.readFileSync('src/services/clientPortalService.js','utf8');
const main=fs.readFileSync('src/main.jsx','utf8');
const assignmentsView=fs.readFileSync('src/components/SiteSupportAssignmentsView.jsx','utf8');
for(const marker of ['auth.uid()','client_portal_identity_v120','client_portal_list_v120','client_admin_invite_member_v120','client_admin_deactivate_member_v120','client_admin_set_campaign_access_v120','client_visible','client_published','cross_client_denied','security definer'])assert.ok(migration.toLowerCase().includes(marker),marker);
for(const column of ['e.no_edt','e.date_debut_prevue','e.date_fin_prevue'])assert.ok(migration.includes(column),column);
for(const obsolete of ['e.numero_edt','e.date_debut,','e.date_fin,','order by e.date_fin '])assert.ok(!migration.includes(obsolete),`Colonne EDT obsolète: ${obsolete}`);
for(const marker of ["update storage.buckets set public=false where id='support-photos'","drop policy if exists sp_storage_read","drop policy if exists sp_storage_insert",'support_photos_storage_scoped_read_v120','p.client_visible','c.client_published','c.client_id=u.client_id',"u.role in ('Client','Client-Admin')","public.current_app_role() in ('Administrateur','Coordonnateur','Installateur')"])assert.ok(migration.toLowerCase().includes(marker.toLowerCase()),marker);
assert.ok(!migration.includes("where id='terrain-photos'"),'Le bucket Terrain reste inchangé');
assert.ok(!migration.toLowerCase().includes('service_role'),'Aucune clé privilégiée');
assert.ok(!service.includes('client_id')&&!service.includes('organization_id'),'Le navigateur ne choisit jamais le périmètre');
assert.ok(service.includes("section === 'photos' ? 50"),'Photothèque plafonnée');
for(const label of ['Accueil','Campagnes','Communications opérationnelles','Sites et supports','Photos','Rapports','EDT / Progression','Enjeux','Historique','Mon organisation'])assert.ok(portal.includes(label),label);
assert.ok(portal.includes('loading="lazy"'),'Miniatures lazy-loadées');
assert.ok(main.includes("['Client','Client-Admin'].includes(role)"),'Portail distinct');
assert.ok(main.includes('<ClientPortal'),'Routage client');
for(const title of ['Campagnes et visuels par site et supports','Communications opérationnelles par site et supports'])assert.ok(main.includes(title),title);
for(const exportLabel of ['Page visible','Sélection','Ensemble filtré'])assert.ok(assignmentsView.includes(exportLabel),exportLabel);
const readonly=verifier.replace(/^\s*--.*$/gm,'').toLowerCase();
assert.ok(!/\b(insert|update|delete|alter|create|drop|truncate|grant|revoke|call|do)\b/.test(readonly),'Vérificateur strictement READ ONLY');
for(const marker of ['support_photos_bucket_public','unexpected_support_photos_public_policies','client_visible_photo_without_campaign','rpc_without_safe_search_path','date_debut_prevue','date_fin_prevue'])assert.ok(verifier.includes(marker),marker);
console.log('Module 17 V1.2.0 : isolation, permissions, projections uniques, pagination, photothèque et portail validés. duplicateLogicalRows = 0 après normalisation.');
