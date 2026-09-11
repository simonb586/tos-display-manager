import fs from 'node:fs';
import assert from 'node:assert/strict';
import {serverAccess,existingSession,endpoint} from './lib/businessParityRemote.mjs';
const access=await serverAccess(),sessions=[],records=[];
try {
 const admin=await existingSession(access,3);sessions.push(admin);
 const request=async(path,target,method='POST',body={})=>{
  const response=await fetch(endpoint+'/rest/v1/'+path,{method,headers:{apikey:access.anon,Authorization:'Bearer '+admin.session.access_token,'Content-Type':'application/json','x-tos-preview-user':String(target)},...(!['GET','HEAD'].includes(method)?{body:JSON.stringify(body)}:{})});
  return {status:response.status,data:await response.json()};
 };
 for(const id of [25,32,37,11]){
  console.log('Testing profile '+id);
  const actual=await existingSession(access,id);sessions.push(actual);
  const real=await actual.client.rpc('portal_dashboard_summary');assert.ifError(real.error);
  const preview=await request('rpc/portal_dashboard_summary',id);assert.equal(preview.status,200,JSON.stringify(preview.data));
  assert.deepEqual(preview.data.identity,real.data.identity);assert.deepEqual(preview.data.permission,real.data.permission);assert.deepEqual(preview.data.kpis,real.data.kpis);
  const rows=await actual.client.rpc('portal_business_rows',{p_view:'Infrastructures'});assert.ifError(rows.error);
  const pr=await request('rpc/portal_business_rows',id,'POST',{p_view:'Infrastructures'});assert.equal(pr.status,200);assert.deepEqual(pr.data,rows.data);
  const direct=await request('infrastructures?select=id,client_id&limit=1000',id,'GET');assert.equal(direct.status,200);
  if(actual.profile.client_id)assert(direct.data.every(row=>row.client_id===actual.profile.client_id));
  const deny=await request('infrastructures?id=eq.-99999999',id,'PATCH',{commentaires:'preview must not write'});assert.equal(deny.status,403);assert.equal(deny.data.message,'preview_read_only');
  const rpcDeny=await request('rpc/creer_requete_client_multi_supports_v133',id,'POST',{p_type:'Inspection',p_priorite:'Normale',p_description:'preview must not submit',p_support_ids:[]});assert.equal(rpcDeny.status,403);assert.equal(rpcDeny.data.message,'preview_read_only');
  records.push({profile:id,role:actual.profile.role,client:actual.profile.client_id,infra:rows.data.total,identity:'PASS',kpis:'PASS',rows:'PASS',previewWrites:'REFUSED'});
 }
 const client=sessions.find(s=>s.profile.id===32);
 const forged=await fetch(endpoint+'/rest/v1/rpc/portal_dashboard_summary',{method:'POST',headers:{apikey:access.anon,Authorization:'Bearer '+client.session.access_token,'Content-Type':'application/json','x-tos-preview-user':'3'},body:'{}'});assert.equal(forged.status,403);
 const noHeader=await admin.client.rpc('portal_dashboard_summary');assert.ifError(noHeader.error);assert.equal(noHeader.data.identity.profile_id,3);
 fs.writeFileSync('docs/client-business-parity/live-api.json',JSON.stringify({at:new Date().toISOString(),status:'PASS',records,forgedPreview:'REFUSED',adminIdentityPreserved:true},null,2));
 console.log(JSON.stringify({status:'PASS',records}));
} finally { for(const s of sessions)await s.client.auth.signOut({scope:'local'}); }
