import fs from 'node:fs';
import vm from 'node:vm';
import {transform} from 'esbuild';
import assert from 'node:assert/strict';
async function load(file,extra){let source=fs.readFileSync(file,'utf8').replace(/^import .*;\r?\n/gm,'');source=source.replaceAll('import.meta.env','({})');const {code}=await transform(source,{loader:'js',format:'cjs'});const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports,console:{log(){},warn(){}},setTimeout,Date,...extra});return module.exports}
const queue=[];
const table=await load('src/services/dataService.js',{supabaseConfigured:true,supabase:{from(){return {select(){return {range(){return new Promise(resolve=>queue.push(resolve))}}}}}}});
const first=table.loadTable('infrastructures');table.clearTableCache();const second=table.loadTable('infrastructures');
queue[1]({data:[{client_id:3}],error:null});await second;queue[0]({data:[{client_id:2}],error:null});await first;
assert.equal((await table.loadTable('infrastructures')).rows[0].client_id,3,'Old scope cannot repopulate table cache');
const slow=table.loadTable('infrastructures',[],{force:true}),fast=table.loadTable('infrastructures',[],{force:true});queue[3]({data:[{client_id:4}],error:null});await fast;queue[2]({data:[{client_id:3}],error:null});await slow;assert.equal((await table.loadTable('infrastructures')).rows[0].client_id,4,'Old force refresh cannot replace newer cache');
let sign;const photo=await load('src/services/photoAccessService.js',{supabaseConfigured:true,storageLocationFromPhotoRecord:()=>({bucket:'support-photos',path:'fixture'}),supabase:{storage:{from(){return {createSignedUrl(){return new Promise(resolve=>{sign=resolve})}}}}}});
const pending=photo.getSignedPhotoUrl({});photo.clearSignedPhotoUrlCache();sign({data:{signedUrl:'EXO-SIGNED-URL'},error:null});await assert.rejects(pending,/Session photo/);
console.log('Table cache invalidation, competing refreshes and stale signed-photo rejection PASS.');
