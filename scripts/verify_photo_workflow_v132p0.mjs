import assert from 'node:assert/strict';
import fs from 'node:fs';
import { generatePhotoIdentity, normalizePhotoType, resolvePhotoAssociations, shouldUpdateCurrentVisual } from '../src/lib/photoWorkflow.js';

const normal=generatePhotoIdentity({supportId:'2000-1',capturedAt:'2026-08-04T12:00:00-04:00',type:'installation',campaignCode:'Pépsi été',edt:'EDT4218',sequence:1,originalFilename:'preuve.JPEG'});
assert.equal(normal.normalizedFilename,'2000-1-20260804-INSTALLATION-PEPSI-ETE-EDT4218-001.jpg');
assert.equal(normal.storagePath,'supports/2000-1/2026/PEPSI-ETE/INSTALLATION/2000-1-20260804-INSTALLATION-PEPSI-ETE-EDT4218-001.jpg');
assert.equal(normal.originalFilename,'preuve.JPEG');
assert.match(generatePhotoIdentity({supportId:'A B/Ç',capturedAt:'2026-01-02',type:'autre',sequence:9,originalFilename:'a.png'}).normalizedFilename,/^A-B-C-20260102-AUTRE-NONE-NONE-009\.png$/);
assert.notEqual(generatePhotoIdentity({supportId:'1',type:'autre',sequence:1,originalFilename:'a.jpg'}).normalizedFilename,generatePhotoIdentity({supportId:'1',type:'autre',sequence:2,originalFilename:'a.jpg'}).normalizedFilename);
assert.equal(normalizePhotoType('Autre photo'),'autre');
assert.throws(()=>normalizePhotoType('inconnu'));
assert.deepEqual(resolvePhotoAssociations({supportId:'1',type:'inspection',activeCampaigns:[{id:1}],candidateEdts:[]}).ok,true);
assert.equal(resolvePhotoAssociations({supportId:'',type:'inspection'}).reason,'SUPPORT_REQUIRED');
assert.equal(resolvePhotoAssociations({supportId:'1',type:'inspection',activeCampaigns:[{id:1},{id:2}]}).reason,'CAMPAIGN_AMBIGUOUS');
assert.equal(resolvePhotoAssociations({supportId:'1',type:'inspection',candidateEdts:['1','2']}).reason,'EDT_AMBIGUOUS');
assert.equal(resolvePhotoAssociations({supportId:'1',type:'installation'}).reason,'EDT_REQUIRED');
assert.equal(resolvePhotoAssociations({supportId:'1',type:'enjeu'}).ok,true);
assert.equal(shouldUpdateCurrentVisual('inspection'),true);
for(const type of ['enjeu','autre','installation','retrait'])assert.equal(shouldUpdateCurrentVisual(type),false);

const service=fs.readFileSync('src/services/photoWorkflowService.js','utf8');
assert.match(service,/upsert:false/);assert.match(service,/rollbackUploadedPhoto/);assert.match(service,/original_filename/);assert.match(service,/uploaded_by/);
const migration=fs.readFileSync('supabase/V1_0_1_BLOC_13_2_P0_PHOTO_WORKFLOW.sql','utf8');
for(const field of ['edt_id','original_filename','normalized_filename','storage_bucket','captured_at','uploaded_at','uploaded_by','intervention_id','inspection_id','issue_id','is_current_visual','replaced_photo_id','metadata'])assert.ok(migration.includes(field),field);
assert.match(migration,/date_visuel_actuel/);assert.doesNotMatch(migration,/create policy|drop policy/i);
const deletion=fs.readFileSync('src/services/photoLibraryService.js','utf8');
assert.match(deletion,/storageLocationFromPhotoRecord/);assert.match(deletion,/photo_action_log/);assert.match(deletion,/verifyPhotoDeletion/);
console.log('Bloc 13.2-P0 : normalisation, associations, historique, rollback, visuel et suppression validés.');
