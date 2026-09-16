import assert from 'node:assert/strict';
import fs from 'node:fs';
import {targetedAccess} from './targeted_remote_access.mjs';
import {fixtureSession} from './targeted_test_accounts.mjs';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
const access=await targetedAccess(),results=[];
for(const role of ['Client','Client-Admin']){
 const a=await fixtureSession(access,{role,clientId:2,profileId:-94912});
 try{
  const {data,error}=await a.client.rpc('photo_inventory_read',{p_filters:{deleted_at:null},p_limit:4});assert.ifError(error);assert(data.rows.length>1);assert(!JSON.stringify(data.rows).includes('@'));
  await offlineBrowser('scripts/fixtures/photo-export-mission-entry.jsx',async b=>{
   await b.evaluate(`window.exportInput=${JSON.stringify(data.rows)}`);await b.evaluate('exportChecks(exportInput).then(r=>window.exportResult=r).catch(e=>window.exportError=e.message)');
   await b.waitFor('Boolean(window.exportResult||window.exportError)');assert.equal(await b.evaluate('window.exportError'),undefined);
   const result=await b.evaluate('window.exportResult');for(const item of Object.values(result))assert.equal(item.authorEmail,false);
   assert.equal(result.zip.files.length,2);assert.deepEqual(b.exceptions,[]);results.push({role,result:'PASS',exports:result});
  },{realServices:['photoLibraryService.js','finalReportService.js'],supabaseSource:"export const supabaseConfigured=true;export const supabase={storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'}})})}};"});
 }finally{await a.cleanup();}
}
fs.writeFileSync('docs/photo-inventory-mission/export-tests.json',JSON.stringify({results,scope:'Actual export functions with actual client API rows; ZIP image fetch uses a deterministic image, actual original bytes tested separately'},null,2));console.log('Client and Client-Admin: actual CSV/XLSX/PDF/ZIP exports contain no internal author email PASS');
