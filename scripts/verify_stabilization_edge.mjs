import fs from 'node:fs';
import vm from 'node:vm';
import {transform} from 'esbuild';
import assert from 'node:assert/strict';
const results=[];
async function fixture(name,options={}){
 const calls=[];let handler;
 const user=options.noUser?null:{id:'target-auth',email:'target@example.test',email_confirmed_at:options.activated?'2026-09-01':null};
 const callerProfile=options.missingProfile?null:{id:1,auth_user_id:'actor',role:Object.hasOwn(options,'role')?options.role:'Administrateur',statut:options.inactive?'Désactivé':'Actif',client_id:options.global?null:2};
 const targetProfile={id:2,auth_user_id:user?.id||null,role:'Client',client_id:options.foreignTarget?3:2,nom:'Fixture',courriel:'target@example.test'};
 const auth={getUser:async()=>({data:{user:options.unauthenticated?null:{id:'actor',email:'actor@example.test'}}}),admin:{listUsers:async()=>({data:{users:user?[user]:[]}}),getUserById:async()=>({data:{user}}),inviteUserByEmail:async(email,args)=>{calls.push({method:'inviteUserByEmail',email,args});return {data:{user:{id:'target-auth'}},error:options.mailError?{message:'SMTP fixture failure'}:null}}}};
 const admin={auth,from(table){let operation='select';const filters={};const chain={select(){return chain},order(){return chain},or(){throw Error('Email fallback is forbidden for caller identity')},eq(key,value){filters[key]=value;return chain},upsert(){operation='update';return chain},update(){operation='update';return chain},maybeSingle(){if(table==='clients')return Promise.resolve({data:options.missingClient?null:{id:filters.id}});if(table==='client_member_invitations')return Promise.resolve({data:{id:7,client_id:options.foreign?3:2,email:'target@example.test',requested_role:'Client',status:'pending'}});return Promise.resolve({data:filters.auth_user_id==='actor'?callerProfile:targetProfile})},single(){return Promise.resolve({data:{id:1},error:options.profileError?{message:'Profile write failure'}:null})},then(resolve,reject){return Promise.resolve({data:operation==='select'?[targetProfile]:null,error:operation==='update'&&options.profileError?{message:'Profile write failure'}:null}).then(resolve,reject)}};return chain}};
 const shared=fs.readFileSync('supabase/functions/_shared/canonicalUser.ts','utf8').replace(/^export /gm,'');
 const source=shared+'\n'+fs.readFileSync(`supabase/functions/${name}/index.ts`,'utf8').replace(/^import .*;\r?$/gm,'');
 const {code}=await transform(source,{loader:'ts',format:'iife'});
 vm.runInNewContext(code,{createClient:()=>admin,Response,URL,console:{error(){}},Deno:{env:{get:key=>key.includes('URL')?'https://fixture.example.test':'fixture-key'},serve:fn=>{handler=fn}}});
 return {calls,run:async(method='POST',body={})=>{const res=await handler(new Request('https://fixture.example.test',{method,headers:{Authorization:'Bearer fixture','Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify({action:'resend_invite',email:'target@example.test',nom:'Fixture',role:'Client',client_id:2,...body})}:{})}));return {status:res.status,payload:await res.json()}}};
}
for(const name of ['invite-user','manage-user']){
 for(const [label,options,expected]of [['pending',{},200],['global internal admin',{global:true},200],['never invited',{noUser:true},200],['activated',{activated:true},409],['mail failure',{mailError:true},name==='invite-user'?400:500],['profile failure',{profileError:true},500],['unauthenticated',{unauthenticated:true},401],['unauthorized role',{role:'Client'},403],['NULL role',{role:null},403],['NULL profile',{missingProfile:true},403],['inactive profile',{inactive:true},403],['invalid owner',{missingClient:true},403],['foreign target',{foreignTarget:true},403]]){
  const f=await fixture(name,options),r=await f.run();assert.equal(r.status,expected,`${name}: ${label} ${JSON.stringify(r)}`);if(expected===200){assert.equal(f.calls.length,1);assert.ok(f.calls[0].args.redirectTo.endsWith('/accept-invitation'))}results.push({name:`${name}: ${label}`,result:'PASS_EDGE_MOCK'});
 }
 const f=await fixture(name);assert.equal((await f.run('GET')).status,405);assert.equal(f.calls.length,0);results.push({name:`${name}: GET never sends`,result:'PASS_EDGE_MOCK'});
}
const foreign=await fixture('invite-user',{role:'Client-Admin',foreign:true});assert.equal((await foreign.run('POST',{origin:'client-admin',invitation_id:7})).status,403);assert.equal(foreign.calls.length,0);results.push({name:'Client-Admin foreign invitation denied before Auth',result:'PASS_EDGE_MOCK'});
fs.writeFileSync('docs/stabilization-local/edge-results.json',JSON.stringify({results,limits:'Real Edge handler, mocked Auth/database/mail. Expiration, token rotation, single use and RLS require Auth/Postgres integration.'},null,2));
console.log(`${results.length} Edge handler cases PASS; no mail or network.`);
