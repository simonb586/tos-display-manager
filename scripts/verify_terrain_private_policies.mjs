import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(path.join(os.tmpdir(),'tdm-rpc-test-runtime/node_modules/@electric-sql/pglite/dist/index.js')));
const db=new PGlite(),records=[];
const uid='91000000-0000-4000-8000-000000090001';
await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table utilisateurs(auth_user_id uuid,role text,statut text,client_id bigint);create table clients(id bigint);create table infrastructures(support_id text,client_id bigint,photo_principale_url text,photo_miniature_url text);create table inspections_terrain(photo_path text,photo_url text);
create table campagnes_maitres(id bigint,client_id bigint,client_published boolean);create table client_campaign_access(client_id bigint,campaign_id bigint,user_id uuid);
create table support_photos(id bigint,campagne_id bigint,client_visible boolean,client_id bigint,support_id text,source text,review_status text,storage_bucket text,storage_path text,photo_url text,deleted_at timestamptz);
create table storage.objects(bucket_id text,name text,owner_id text,created_at timestamptz default now());
grant usage on schema public,auth,storage to anon,authenticated;grant all on storage.objects to anon,authenticated;
alter table storage.objects enable row level security;
create policy deliberately_broad_legacy on storage.objects for all to public using(true) with check(true);
create policy support_photos_delete_admin_v0129_lot3 on support_photos for delete to authenticated using(true);`);
await db.exec(fs.readFileSync('supabase/migrations/20260909112153_canonical_photo_role_authorization.sql','utf8'));
await db.exec(fs.readFileSync('supabase/prepared/20260909113049_terrain_photos_private_policies_prepared.sql','utf8'));
async function test({role='Client',client=1,owner=1,action='read',anon=false,missingUid=false,inactive=false,duplicate=false,published=true,visible=true,grant=true,registered=true,path='S/a.jpg',uploader=uid,bucket='terrain-photos',incoherent=false,support='S',old=false,inspection=false,campaignless=false,deleted=false,expected,label}){
 await db.exec(`begin;insert into clients values(1),(2);insert into infrastructures(support_id,client_id) values('${support}',${owner===null?'NULL':owner});
 insert into utilisateurs values('${uid}',${role===null?'NULL':"'"+role+"'"},'${inactive?'Inactif':'Actif'}',${client===null?'NULL':client});
 ${duplicate?`insert into utilisateurs select * from utilisateurs;`:''}
 insert into campagnes_maitres values(1,${owner||1},${published});${grant?`insert into client_campaign_access values(${owner||1},1,'${uid}');`:''}
 ${registered?`insert into support_photos(id,campagne_id,client_visible,client_id,support_id,storage_bucket,storage_path) values(1,1,${visible},${owner||1},'${support}','terrain-photos','${path}');`:''}
 insert into storage.objects(bucket_id,name,owner_id) values('${bucket}','${path}','${uploader}');
 ${incoherent?`update support_photos set client_id=2;`:''}${old?`update storage.objects set created_at=now()-interval '1 day';`:''}${inspection?`insert into inspections_terrain values('${path}',null);`:''}
 ${campaignless?'update support_photos set campagne_id=null;':''}${deleted?'update support_photos set deleted_at=now();':''}
 select set_config('request.jwt.claim.sub','${missingUid||anon?'':uid}',true);
 select set_config('request.jwt.claims','{"user_metadata":{"role":"Administrateur"}}',true);set local role ${anon?'anon':'authenticated'};`);
 let allowed=false;
 try {
  if(action==='read')allowed=(await db.query('select * from storage.objects')).rows.length===1;
  if(action==='insert')allowed=(await db.query(`insert into storage.objects(bucket_id,name,owner_id) values('${bucket}','${path}','${uploader}') returning *`)).rows.length===1;
  if(action==='delete')allowed=(await db.query('delete from storage.objects returning *')).rows.length===1;
  if(action==='update')allowed=(await db.query("update storage.objects set name='S/renamed.jpg' returning *")).rows.length===1;
 } catch(e){if(e.code!=='42501')throw e;}
 await db.exec('rollback');assert.equal(allowed,expected,label||JSON.stringify({role,client,owner,action}));records.push({role,client,owner,action,label,expected,result:'PASS'});
}
for(const role of [null,'Client','Client-Admin','Installateur','Coordonnateur','Administrateur'])for(const owner of [1,2])for(const action of ['read','insert','delete','update'])await test({role,owner,action,expected:owner===1&&(action==='read'?role!==null:action==='insert'?['Installateur','Coordonnateur','Administrateur'].includes(role):action==='delete'?role==='Administrateur':false)});
for(const extra of [{anon:true},{missingUid:true},{inactive:true},{duplicate:true},{owner:null},{client:null,role:'Client'}])for(const action of ['read','insert','delete','update'])await test({...extra,action,expected:false,label:JSON.stringify(extra)});
for(const extra of [{published:false},{visible:false},{grant:false},{registered:false}])await test({...extra,expected:false,label:JSON.stringify(extra)});
for(const role of ['Client','Client-Admin']){
 await test({role,campaignless:true,grant:false,expected:true,label:'existing visible infrastructure photo without campaign'});
 await test({role,campaignless:true,client:2,expected:false,label:'campaignless photo wrong client'});
 await test({role,campaignless:true,visible:false,expected:false,label:'campaignless hidden photo'});
 await test({role,campaignless:true,deleted:true,expected:false,label:'deleted campaignless photo'});
 await test({role,deleted:true,expected:false,label:'deleted campaign photo'});
}
for(const role of ['Administrateur','Coordonnateur','Installateur'])for(const action of ['read','insert','delete','update'])await test({role,client:null,action,registered:false,expected:action!=='update',label:'global internal + unregistered rollback'});
await test({role:'Installateur',registered:false,action:'delete',uploader:'other',expected:false,label:'rollback uploader mismatch'});
for(const p of ['S/../other.jpg','S//other.jpg','S/%2e%2e/other.jpg','MISSING/a.jpg'])await test({role:'Administrateur',path:p,expected:false,label:'invalid path'});
await test({role:'Client',path:'supports/S/2026/NONE/INSPECTION/a.jpg',expected:true,label:'canonical path'});
await test({role:'Installateur',registered:false,action:'delete',old:true,expected:false,label:'old unregistered historical object preserved'});
await test({role:'Installateur',registered:false,action:'delete',inspection:true,expected:false,label:'inspection reference prevents rollback deletion'});
await test({role:'Client-Admin',grant:false,expected:true,label:'Client-Admin published own client without individual grant'});
const raw=JSON.parse(fs.readFileSync('docs/stabilization-local/certification/remote/photo-private/terrainAssetAudit.json','utf8'));const result=JSON.parse(raw.content[0].text).result;const assets=JSON.parse(result.slice(result.indexOf('\n[')+1,result.lastIndexOf('\n</untrusted')))[0].audit.objects;
for(const asset of assets){const support=asset.path.split('/')[0];for(const role of ['Installateur','Client'])await test({role,path:asset.path,support,registered:Boolean(asset.metadata_matches?.length),expected:role==='Installateur'||Boolean(asset.metadata_matches?.length),label:'existing object '+asset.path});await test({role:'Client',client:2,path:asset.path,support,expected:false,label:'Client B cannot read EXO '+asset.path});}
await test({role:'Administrateur',incoherent:true,expected:false,label:'incoherent photo client denied to internal Admin'});
await test({role:'Client',incoherent:true,expected:false,label:'incoherent photo client denied to Client'});
for(const anon of [true,false])for(const action of ['read','insert','delete','update'])await test({bucket:'other-fixture-bucket',anon,action,expected:true,label:'other bucket existing policy preserved'});
await db.close();fs.writeFileSync('docs/stabilization-local/certification/remote/photo-private/storage-local.json',JSON.stringify({records,total:records.length,remoteApplied:false},null,2));console.log(records.length+' prepared Storage RLS cases PASS');
