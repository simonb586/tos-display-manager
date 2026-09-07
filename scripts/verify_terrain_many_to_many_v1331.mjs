import assert from 'node:assert/strict';
import fs from 'node:fs';

class StorageMock {
  constructor(){this.values=new Map()}
  getItem(key){return this.values.has(key)?this.values.get(key):null}
  setItem(key,value){this.values.set(key,String(value))}
  removeItem(key){this.values.delete(key)}
}
globalThis.sessionStorage=new StorageMock();
const drafts=await import('../src/lib/formDraft.js');
const campaign={nom_campagne:'Civisme',client_id:'2',instructions_terrain:'Test'};
drafts.writeFormDraft('campaign','marketing',{form:campaign,formOpen:true});
drafts.writeFormDraft('campaign','operational_communication',{form:{nom_campagne:'Exo info'},formOpen:true});
drafts.writeFormDraft('visual','marketing',{form:{nom_visuel:'Voix cell - train'},formOpen:true});
assert.deepEqual(drafts.readFormDraft('campaign','marketing',null).form,campaign);
assert.equal(drafts.readFormDraft('campaign','operational_communication',null).form.nom_campagne,'Exo info');
assert.equal(drafts.readFormDraft('visual','marketing',null).form.nom_visuel,'Voix cell - train');
drafts.clearFormDraft('campaign','marketing');
assert.equal(drafts.readFormDraft('campaign','marketing',null),null);
assert.ok(drafts.readFormDraft('campaign','operational_communication',null));

const eligible=({supportClient,visualClient,context,assigned,outOfFrame}) =>
  supportClient===visualClient && ['marketing','operational_communication'].includes(context) && (assigned||outOfFrame);
assert.equal(eligible({supportClient:2,visualClient:2,context:'marketing',assigned:true,outOfFrame:false}),true);
assert.equal(eligible({supportClient:2,visualClient:2,context:'operational_communication',assigned:true,outOfFrame:false}),true);
assert.equal(eligible({supportClient:2,visualClient:2,context:'marketing',assigned:false,outOfFrame:false}),false);
assert.equal(eligible({supportClient:2,visualClient:2,context:'marketing',assigned:false,outOfFrame:true}),true);
assert.equal(eligible({supportClient:2,visualClient:8,context:'marketing',assigned:true,outOfFrame:true}),false);
const edtSupports=[{edtId:'A',supportId:'VH-VAUD-16'},{edtId:'B',supportId:'VH-VAUD-16'},{edtId:'A',supportId:'S-2'}];
assert.equal(edtSupports.filter(row=>row.edtId==='A').length,2);
assert.equal(edtSupports.filter(row=>row.supportId==='VH-VAUD-16').length,2);

const sql=fs.readFileSync('supabase/migrations/20260907233553_terrain_many_to_many_visuals_v1331.sql','utf8').toLowerCase();
const edtSchema=fs.readFileSync('supabase/V0_12_9_LOT1_MOTEUR_EDT_ENTERPRISE.sql','utf8').toLowerCase();
const edtPhaseSchema=fs.readFileSync('supabase/V1_3_3_EDT_PHASES_VISUALS_WORKORDERS_CLIENT_SUPPORTS_PREPARED.sql','utf8').toLowerCase();
const terrain=fs.readFileSync('src/components/TerrainApp.jsx','utf8');
const service=fs.readFileSync('src/services/campaignVisualService.js','utf8');
for(const marker of ['auth.uid() is null','terrain_role_denied','cross_client_denied','edt_supports','p_edt_phase_id','operational_communication','is_out_of_frame','campagnes_visuels_sites_supports','communications_operationnelles_sites_supports','historique_des_campagnes','refresh_edt_enterprise','set search_path=pg_catalog,public,pg_temp']) assert.ok(sql.includes(marker),marker);
assert.match(edtSchema,/unique\s*\(edt_id,\s*support_id\)/);
assert.ok(edtPhaseSchema.includes('on public.edt_supports(phase_id,support_id)'));
assert.doesNotMatch(sql,/infrastructures[^;]+edt_associe\s*=\s*[^,;]+[^;]+where[^;]+edt_associe/i);
assert.ok(terrain.includes('phaseId: issuePhaseId'));
assert.ok(terrain.includes('Contexte EDT / phase d’installation'));
assert.ok(service.includes("rpc('lister_visuels_installation_terrain_v1331'"));
console.log('V1.3.3.1 Terrain many-to-many, visuels et brouillons : PASS.');
