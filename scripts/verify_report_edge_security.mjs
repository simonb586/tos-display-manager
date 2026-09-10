import fs from 'node:fs';
import vm from 'node:vm';
import {transform} from 'esbuild';
import assert from 'node:assert/strict';
const records=[];
async function fixture(name,options={}){
 let handler;const calls=[],providerRequests=[];
 const actor=options.missing?null:{id:1,auth_user_id:'actor',role:Object.hasOwn(options,'role')?options.role:'Coordonnateur',statut:options.inactive?'Désactivé':'Actif',client_id:options.global?null:2};
 const api={auth:{getUser:async()=>({data:{user:options.anon?null:{id:'actor'}},error:null})},from(table){
  const chain={select(){return chain},eq(){return chain},maybeSingle:async()=>({error:options.queryError?{}:null,data:table==='utilisateurs'?actor:table==='clients'?(options.invalidClient?null:{id:2}):table==='suivi_des_edt'?{id:7,no_edt:'EDT-A',client_id:options.foreign?3:2,campagne_id:8}:table==='campagnes_maitres'?{id:8,client_id:options.badCampaign?4:options.foreign?3:2}:table==='communications_finales'?{id:9,edt_id:7,client_id:options.badReport?4:options.foreign?3:2,report_path:options.badPath?'EDT-B/file.pdf':'EDT-A/file.pdf',report_snapshot:{}}:null})};return chain;
 },rpc:async(name)=>{calls.push(name);return {data:[],error:null}},storage:{from(){return {download:async path=>{calls.push('download:'+path);return {data:new Blob(['%PDF-1.4 fixture']),error:null}}}}}};
 const source=['_shared/canonicalUser.ts','_shared/reportAuthorization.ts',name+'/index.ts'].map(f=>fs.readFileSync('supabase/functions/'+f,'utf8').replace(/^import .*;\r?$/gm,'').replace(/^export /gm,'')).join('\n')+(name==='send-edt-completion-email'?'\nglobalThis.__reportSend=sendReport;globalThis.__reportPortal=canUseReportPortal;':'');
 const {code}=await transform(source,{loader:'ts',format:'iife'});
 const context={createClient:()=>api,Response,URL,URLSearchParams,Uint8Array,TextEncoder,console,Deno:{env:{get:key=>key==='EDT_EMAIL_WORKER_SECRET'||(key==='RESEND_API_KEY'&&options.noProviderKey)?undefined:'fixture'},serve:fn=>handler=fn},btoa:v=>Buffer.from(v,'binary').toString('base64'),fetch:async(url,request)=>{calls.push('email');providerRequests.push({url,...request});return new Response(JSON.stringify(options.providerFailure?{name:'fixture_error'}:{id:'fixture'}),{status:options.providerFailure?403:200})}};
 vm.runInNewContext(code,context);
 const run=async(method='POST',body={})=>{const r=await handler(new Request('https://fixture.invalid',{method,headers:{Authorization:'Bearer fixture'},...(method==='POST'?{body:JSON.stringify({edt_id:7,communicationId:9,recipients:['service@groupetos.com'],reportPath:'EDT-A/file.pdf',...body})}:{})}));return {status:r.status,body:await r.json()}};
 return {run,calls,providerRequests,send:context.__reportSend,portal:context.__reportPortal};
}
for(const fn of ['send-final-report','send-edt-completion-email']){
 for(const [label,options]of [['Client',{role:'Client'}],['Client-Admin',{role:'Client-Admin'}],['NULL role',{role:null}],['NULL profile',{missing:true}],['inactive',{inactive:true}],['foreign client',{foreign:true}],['NULL client staff',{global:true}],['invalid client',{invalidClient:true}],['inconsistent campaign',{badCampaign:true}],['database error',{queryError:true}]]){
  const f=await fixture(fn,options),r=await f.run();assert.equal(r.status,403,fn+' '+label+JSON.stringify(r));assert.deepEqual(f.calls,[]);records.push({name:fn+' '+label,result:'PASS'});
 }
 for(const [label,options]of [['scoped staff',{}],['global Admin',{global:true,role:'Administrateur'}]]){
  const f=await fixture(fn,options),r=await f.run();assert.equal(r.status,200,JSON.stringify(r));assert(f.calls.length>0);records.push({name:fn+' '+label,result:'PASS'});
 }
 for(const method of ['GET','HEAD']){const f=await fixture(fn);const r=await f.run(method);assert.equal(r.status,405);assert.deepEqual(f.calls,[]);records.push({name:fn+' '+method,result:'PASS'});}
 const f=await fixture(fn,{anon:true});const r=await f.run();assert([401,403].includes(r.status));assert.deepEqual(f.calls,[]);records.push({name:fn+' anon',result:'PASS'});
}
for(const options of [{badPath:true},{badReport:true}]){const f=await fixture('send-final-report',options);assert.equal((await f.run()).status,403);assert.deepEqual(f.calls,[]);records.push({name:'send-final-report '+JSON.stringify(options),result:'PASS'});}
{const f=await fixture('send-final-report');assert.equal((await f.run('POST',{reportPath:'EDT-B/file.pdf'})).status,403);assert.deepEqual(f.calls,[]);records.push({name:'untrusted frontend path',result:'PASS'});}
{const f=await fixture('send-edt-completion-email');assert.equal((await f.run('POST',{edt_id:null})).status,403);assert.deepEqual(f.calls,[]);records.push({name:'staff global queue refused before claim',result:'PASS'});}
const message={toRecipients:[{emailAddress:{address:'service@groupetos.com'}}],subject:'Fixture',body:{content:'<p>Fixture</p>'},text:'Fixture',attachments:[{name:'fixture.pdf',contentType:'application/pdf',contentBytes:'JVBERi0='}]};
{const f=await fixture('send-edt-completion-email');assert.equal(await f.send(message,'edt-report/1/2'),'fixture');assert.equal(await f.send(message,'edt-report/1/2'),'fixture');const [a,b]=f.providerRequests;assert.equal(a.url,'https://api.resend.com/emails');assert.equal(a.headers['Idempotency-Key'],b.headers['Idempotency-Key']);const body=JSON.parse(a.body);assert.equal(body.from,'noreply@groupetos.com');assert.deepEqual(body.to,['service@groupetos.com']);assert.equal(body.attachments[0].content,'JVBERi0=');records.push({name:'Resend noreply, recipients, PDF and stable retry key',result:'PASS'});}
for(const options of [{providerFailure:true},{noProviderKey:true}]){const f=await fixture('send-edt-completion-email',options);await assert.rejects(()=>f.send(message,'edt-report/1/2'));records.push({name:'Resend failure '+JSON.stringify(options),result:'PASS'});}

const portalFixture=await fixture('send-edt-completion-email');
for(const scenario of ['authorized Client','authorized Client-Admin','missing report view','missing campaign grant','wrong tenant','inactive','missing auth','internal role','unpublished EDT','unpublished campaign','hidden report','query error']){
 const contact={auth_user_id:'contact',role:scenario==='authorized Client-Admin'?'Client-Admin':'Client',statut:'Actif',client_id:2};const edt={client_visible:true},campaign={id:8,client_id:2,client_published:true},report={status:'ready',client_visible:true};
 if(scenario==='wrong tenant')contact.client_id=3;if(scenario==='inactive')contact.statut='Inactive';if(scenario==='missing auth')contact.auth_user_id=null;if(scenario==='internal role')contact.role='Administrateur';if(scenario==='unpublished EDT')edt.client_visible=false;if(scenario==='unpublished campaign')campaign.client_published=false;if(scenario==='hidden report')report.client_visible=false;
 const admin={from(table){const chain={select(){return chain},eq(){return chain},maybeSingle:async()=>({data:{visible_tables:scenario==='missing report view'?['Photos']:['Rapports EDT']},error:scenario==='query error'?{}:null}),then(resolve){return Promise.resolve({data:scenario==='missing campaign grant'?[]:[{user_id:'contact'}],error:null}).then(resolve)}};return chain}};
 assert.equal(await portalFixture.portal(admin,contact,edt,campaign,report,'https://portal.example.invalid'),scenario.startsWith('authorized'),scenario);records.push({name:'Report delivery portal eligibility '+scenario,result:'PASS'});
}
fs.mkdirSync('docs/stabilization-local/certification/remote/final-resume',{recursive:true});fs.writeFileSync('docs/stabilization-local/certification/remote/final-resume/report-edge-local.json',JSON.stringify({at:new Date().toISOString(),records,limits:'Real handlers; mocked Auth, database, storage and provider; no actual email.'},null,2));
console.log(records.length+' report Edge cases PASS; no email');
