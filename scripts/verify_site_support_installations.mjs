import assert from 'node:assert/strict';
import {projectSiteSupportDeployments} from '../src/lib/siteSupportDeployments.js';
import {canonicalAssignmentRows,prepareRows} from '../src/services/siteSupportBusinessService.js';
import {resolveFrameIdentifier} from '../src/lib/frameIdentifierOcr.js';
import {recognizeImportPhoto} from '../src/lib/photoImportRecognition.js';
import {summarizeCampaignHistory} from '../src/lib/campaignHistory.js';

const campaigns=[{id:1,client_id:2,nom_campagne:'Marketing',business_context:'marketing',no_edt:'WRONG'},
 {id:2,client_id:2,nom_campagne:'Communication',business_context:'operational_communication'},
 {id:3,client_id:1,nom_campagne:'Marketing',business_context:'marketing'}];
const visuals=campaigns.map(c=>({id:c.id,client_id:c.client_id,campagne_id:c.id,nom_visuel:'Visual '+c.id,format_support:'24 x 18'}));
const supports=Array.from({length:20},(_,index)=>({id:index+1,support_id:`3000-${index+1}`,client_id:2,site:'Site '+index,
 visuel_id:index<10?1:2,visuel_en_expo:index<10?'Visual 1':'Visual 2',campagne_actuelle:index<10?'Marketing':'Communication',format_affichage:'24 x 18',date_visuel_actuel:'2026-09-18T10:00:00Z',edt_associe:'EDT-'+index}));
const history=supports.map(s=>({id:s.id,client_id:2,support_id:s.support_id,campagne:s.campagne_actuelle,visuel:s.visuel_en_expo,no_edt:s.edt_associe,
 date_installation:s.date_visuel_actuel,photo_installation:'photo-'+s.id,movement_meta:{installation:{state:{visuel_id:s.visuel_id}}}}));
const current=source=>projectSiteSupportDeployments({campaigns,visuals,...source}).filter(r=>r.etat_courant==='Oui');
const rows=current({supports,history});
assert.equal(rows.filter(r=>r.business_context==='marketing').length,10);
assert.equal(rows.filter(r=>r.business_context==='operational_communication').length,10);
assert.equal(rows.length,20,'Infrastructure and history do not duplicate one installation');
const legacyTenant=current({supports,history:history.map(r=>({...r,client_id:null}))});
assert.equal(legacyTenant.length,20,'Legacy history with an exact scoped support must not duplicate installations');
assert(legacyTenant.every(r=>r.client_id===2),'Legacy tenant resolved only from scoped infrastructure');
assert.equal(rows[0].no_edt,'EDT-0','Only the movement EDT, never the global campaign EDT');
assert.equal(rows[0].date_installation,'2026-09-18T10:00:00Z');
assert.equal(current({supports,history:[...history,{...history[0],id:99,photo_installation:'second-photo'}]}).length,20);
const removed={...supports[0],visuel_id:null,visuel_en_expo:'',campagne_actuelle:''};
assert.equal(current({supports:[removed],history:[{...history[0],date_retrait:'2026-09-19'}]}).length,0,'Withdrawn display excluded');
assert.equal(current({supports:[{...removed,campagne_selon_visuel:'Aucune campagne associée au visuel'}]}).length,0,'Empty support excluded');
assert.equal(current({supports:[supports[0]],history:[]}).length,1,'Legacy display without ledger or assignment included');
const newInstallation={...supports[0],id:50,support_id:'3000-50'};
assert.equal(current({supports:[...supports,newInstallation],history}).length,21,'New installations appear on the next read');
const b={...supports[0],id:100,support_id:'B-1',client_id:1,visuel_id:3,visuel_en_expo:'Visual 3'};
assert.equal(current({supports:[b],campaigns:campaigns.filter(c=>c.client_id===1),visuals:visuals.filter(v=>v.client_id===1)}).length,1);
assert(current({supports:[b],campaigns:campaigns.filter(c=>c.client_id===1),visuals:visuals.filter(v=>v.client_id===1)}).every(r=>r.client_id===1));
assert.equal(current({supports:[{...b,visuel_id:1}],campaigns:campaigns.filter(c=>c.client_id===1),visuals:visuals.filter(v=>v.client_id===2)})[0].visual_id,undefined,'Never borrow another client visual');
assert.equal(current({supports:[{...supports[0],visuel_id:null,campagne_actuelle:'Unknown'}]})[0].business_context,null,'Unknown contexts stay unclassified');
const assignment=canonicalAssignmentRows([{id:1,client_id:2,support_id:'3000-1',campagne_id:1,visuel_attendu:'Visual 1'}],campaigns,supports,visuals)[0];
assert.equal(assignment.no_edt,null);
assert.equal(current({supports:[],assignments:[assignment]}).length,0,'Planned assignments excluded');
assert.equal(prepareRows(rows,'marketing','EDT-0',{},null).length,1,'Global EDT search');
assert.equal(prepareRows(rows,'marketing','',{format_visuel:['24 x 18']},{column:'site',direction:'asc'}).length,20);
assert.equal(summarizeCampaignHistory(history).reduce((n,r)=>n+r.nombre_supports,0),20,'History retains distinct supports');

const catalog={supports:[{support_id:'3002-7'},{support_id:'3002-8'},{support_id:'03002-7'}]};
assert.equal(resolveFrameIdentifier([{text:'3002 – 7',confidence:98,region:'upper-right'}],catalog.supports).supportId,'3002-7');
assert.equal(resolveFrameIdentifier([{text:'3002-7',confidence:65}],catalog.supports).supportId,null);
assert.equal(resolveFrameIdentifier([{text:'3002-7 3002-8',confidence:98}],catalog.supports).supportId,null);
assert.equal(resolveFrameIdentifier([{text:'03002-7',confidence:99}],catalog.supports).supportId,'03002-7');
assert.equal(resolveFrameIdentifier([{text:'3002-70',confidence:99}],catalog.supports).supportId,null);
assert.equal(recognizeImportPhoto({ocrText:'3002-7',ocrConfidence:98},catalog).values.support,'3002-7');
assert.equal(recognizeImportPhoto({ocrText:'3002-7',ocrConfidence:98,originalFilename:'3002-8.jpg'},catalog).values.support,undefined,'Conflicting filename requires review');
console.log('PASS: 10 marketing + 10 operational, current installations, withdrawal, photos, EDT, dates, Client B, search, history, OCR identifiers and ambiguity');
