import assert from 'node:assert/strict';
import fs from 'node:fs';
import {recognizeImportPhoto,importRecognitionCounts} from '../src/lib/photoImportRecognition.js';
import {canEditBusinessView} from '../src/lib/businessCapabilities.js';
const catalog={
 supports:[{support_id:'VH-1000-12',client_id:2,format_affichage:'20 x 28 Portrait'},{support_id:'VH-1001-12',client_id:2,format_affichage:'20 x 28'},{support_id:'OTHER-1',client_id:1,format_affichage:'20 x 28'}],
 edts:[{id:1,client_id:2,campagne_id:7},{id:2,client_id:2,campagne_id:8}],
 phases:[{id:11,edt_id:1,phase_type:'installation',date_debut_prevue:'2026-06-01'},{id:12,edt_id:1,phase_type:'retrait',date_debut_prevue:'2026-06-15'},{id:21,edt_id:2,phase_type:'installation',date_debut_prevue:'2026-07-01'}],
 links:[{support_id:'VH-1000-12',edt_id:1},{support_id:'VH-1000-12',edt_id:2}],
 campaigns:[{id:7,client_id:2,business_context:'marketing'},{id:8,client_id:2,business_context:'operational_communication'}],
 visuals:[{id:70,client_id:2,campagne_id:7,format_support:'20 × 28'},{id:80,client_id:2,campagne_id:8,format_support:'99 x 99',is_out_of_frame:true},{id:90,client_id:1,campagne_id:7,format_support:'20 x 28'}],associations:[]
};
const reference=(visual_id,campaign_id=7,confirmed=true)=>({visual_id,campaign_id,client_id:2,confirmed,score:100});
const photo={visualReferenceMatches:[reference(70)],originalFilename:'VH-1000-12_01.jpg',capturedAt:'2026-06-01T12:00:00Z',capturedAtSource:'EXIF'};
const tests=[];const check=(label,fn)=>{fn();tests.push({test:label,result:'PASS'});};
check('Client history remains readonly with wildcard capability; unrelated Infrastructure editing preserved',()=>{const p={visible_tables:['*'],capabilities:{'*':{update:true}}};assert(!canEditBusinessView('Client-Admin',p,'Historique des campagnes'));assert(!canEditBusinessView('Client-Admin',p,'Photos et inventaire'));assert(canEditBusinessView('Client-Admin',p,'Infrastructures'));assert(canEditBusinessView('Administrateur',p,'Historique des campagnes'));});
check('Exact installation date, no prior support/visual relation',()=>{const r=recognizeImportPhoto(photo,catalog);assert.equal(r.ready,true);assert.equal(r.values.type,'installation');assert.equal(r.values.visual,70);});
check('Exact removal date',()=>assert.equal(recognizeImportPhoto({...photo,capturedAt:'2026-06-15T12:00:00Z'},catalog).values.type,'retrait'));
check('All support EDTs and operational out-of-frame visual',()=>assert.equal(recognizeImportPhoto({...photo,visualReferenceMatches:[reference(80,8)],capturedAt:'2026-07-01T12:00:00Z'},catalog).values.visual,80));
check('Overlapping EDT dates remain ambiguous',()=>{const r=recognizeImportPhoto(photo,{...catalog,phases:[...catalog.phases,{id:22,edt_id:2,phase_type:'installation',date_debut_prevue:'2026-06-01'}]});assert.equal(r.states.edt,'TO_REVIEW');assert.equal(r.ready,false);});
check('Visual ambiguity preserves all certain context',()=>{const r=recognizeImportPhoto({...photo,visualReferenceMatches:[reference(70,7,false),reference(71,7,false)]},{...catalog,visuals:[...catalog.visuals,{...catalog.visuals[0],id:71}]});assert.deepEqual(r.pending,['campaign','visual']);assert.equal(r.values.edt,1);});
check('No support: original remains unidentified',()=>{const r=recognizeImportPhoto({...photo,originalFilename:'blurred.jpg'},catalog);assert(r.unidentified);assert(!r.ready);});
check('Two support identifiers never guessed',()=>assert.equal(recognizeImportPhoto({...photo,originalFilename:'VH-1000-12_VH-1001-12.jpg'},catalog).states.support,'TO_REVIEW'));
check('No matching EDT does not imply without-EDT installation',()=>{const r=recognizeImportPhoto({...photo,originalFilename:'VH-1001-12.jpg'},catalog);assert.equal(r.states.edt,'TO_REVIEW');assert(!r.values.withoutEdt);});
check('Manual support correction reruns dependencies',()=>assert(recognizeImportPhoto({...photo,originalFilename:'blurred.jpg'},catalog,{support:'VH-1000-12'}).ready));
check('Manual without-EDT is explicit',()=>{const r=recognizeImportPhoto({...photo,originalFilename:'VH-1001-12.jpg'},catalog,{withoutEdt:true,campaign:7,visual:70});assert(r.ready);assert.equal(r.states.edt,'NOT_APPLICABLE');});
check('Unknown and file modification dates require review',()=>{for(const source of ['IMPORT_DATE','FILE_METADATA'])assert.equal(recognizeImportPhoto({...photo,capturedAtSource:source},catalog).states.date,'TO_REVIEW');});
check('Inspection and issue do not become movements',()=>{for(const type of ['inspection','enjeu']){const r=recognizeImportPhoto(photo,catalog,{type});assert(r.ready);assert.equal(r.values.edt,null);assert.equal(r.values.visual,null);}});
check('Foreign visual cannot be selected manually',()=>assert.equal(recognizeImportPhoto(photo,catalog,{visual:90}).states.visual,'TO_REVIEW'));
check('One eligible visual is insufficient without a generic reference match',()=>assert.equal(recognizeImportPhoto({...photo,visualReferenceMatches:[]},catalog).states.visual,'TO_REVIEW'));
check('Reference conflicting with EDT remains unresolved',()=>assert.equal(recognizeImportPhoto({...photo,visualReferenceMatches:[reference(80,8)]},catalog).states.visual,'TO_REVIEW'));
const lot=Array.from({length:48},(_,i)=>{const variant=i%6;const input={...photo,visualReferenceMatches:variant===2?[reference(70,7,false),reference(71,7,false)]:photo.visualReferenceMatches,originalFilename:variant===0?'unknown-'+i+'.jpg':photo.originalFilename,capturedAt:variant===1?'2026-08-01T12:00:00Z':photo.capturedAt};const c=variant===2?{...catalog,visuals:[...catalog.visuals,{...catalog.visuals[0],id:71}]}:catalog;const manual=variant===3?{type:'inspection'}:variant===4?{type:'enjeu'}:{};return {id:i,recognition:recognizeImportPhoto(input,c,manual)};});
const counts=importRecognitionCounts(lot);assert.equal(lot.length,48);assert.equal(counts.review,24);assert.equal(counts.unidentified,8);assert.equal(counts.automatic,8);assert.equal(counts.ready,24);
fs.mkdirSync('docs/photo-inventory-mission',{recursive:true});fs.writeFileSync('docs/photo-inventory-mission/recognition-tests.json',JSON.stringify({tests,representativeBatch:counts,scope:'Pure recognition; persistence and movement tests are separate'},null,2));
console.log(tests.length+' recognition scenarios PASS; mixed batch 48: '+JSON.stringify(counts));
