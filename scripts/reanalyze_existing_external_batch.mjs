import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {targetedAccess} from './targeted_remote_access.mjs';
import {existingSession} from './targeted_existing_session.mjs';
import {productionBrowser} from './targeted_test_browser.mjs';
const shard=Number(process.argv[2]||0),shards=Number(process.argv[3]||1),port=5187+shard;
const dir='.cache/visual-terrain-stock',progressPath=`${dir}/reanalysis-shard-${shard}.json`,selection=JSON.parse(fs.readFileSync(`${dir}/requested-review-cleanup-selection.json`));
assert.equal(selection.ids.length,204);
const access=await targetedAccess(),login=await existingSession(access,1),client=access.userClient();
assert.equal(JSON.parse(Buffer.from(client.supabaseKey.split('.')[1],'base64url')).role,'anon');
process.env.VITE_SUPABASE_URL=client.supabaseUrl;process.env.VITE_SUPABASE_PUBLISHABLE_KEY=client.supabaseKey;
const {data:photos,error}=await login.client.from('support_photos').select('*').in('id',selection.ids).order('id');assert.ifError(error);assert.equal(photos.length,204);assert(photos.every(p=>p.source==='mass_import'&&!p.import_finalized_at&&!p.movement_history_id));
if(!fs.existsSync(`${dir}/original-204-contexts.json`))fs.writeFileSync(`${dir}/original-204-contexts.json`,JSON.stringify(photos,null,2));
const previous=fs.existsSync(`${dir}/reanalysis-204-progress.json`)?JSON.parse(fs.readFileSync(`${dir}/reanalysis-204-progress.json`)):[];
const own=fs.existsSync(progressPath)?JSON.parse(fs.readFileSync(progressPath)):[];previous.push(...own);previous.splice(0,previous.length,...new Map(previous.map(r=>[r.id,r])).values());const completed=new Set(previous.filter(r=>r.ok).map(r=>r.id));const pending=photos.filter((p,i)=>i%shards===shard&&!completed.has(p.id));
const server=await createServer({server:{host:'127.0.0.1',port,strictPort:true},plugins:[{name:'reanalysis-page',configureServer(s){s.middlewares.use('/reanalysis.html',(_,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><p>Réanalyse des originaux existants. Aucune suppression ni finalisation automatique.</p>');});}}]});
await server.listen();process.env.TDM_TEST_PORTAL_ORIGIN=`http://127.0.0.1:${port}`;
try{await productionBrowser(login.session,async b=>{
 await b.send('Page.navigate',{url:`http://127.0.0.1:${port}/reanalysis.html`});await b.waitFor('document.body.innerText.includes("Réanalyse des originaux")');
 await b.evaluate(`window.batchPhotos=${JSON.stringify(pending)};window.batchProgress=[];window.batchDone=false;window.batchError=null;`);
 await b.evaluate(`void (async()=>{try{const m=await import('/src/services/photoReviewService.js');window.batchResults=await m.reanalyzeReviewPhotos(window.batchPhotos,(done,total,result)=>window.batchProgress.push({...result,done,total}));}catch(e){window.batchError=e.message;}finally{window.batchDone=true;}})();`);
 let count=0;
 while(!await b.evaluate('window.batchDone')){
  await b.pause(1000);const progress=await b.evaluate('window.batchProgress');if(progress.length!==count){count=progress.length;const all=[...previous,...progress];fs.writeFileSync(progressPath,JSON.stringify(all,null,2));if(count%10===0||count===1)console.log(`Réanalyse ${completed.size+count}/204 — originaux conservés`);}
 }
 const result=await b.evaluate('({results:window.batchResults,error:window.batchError})');assert.equal(result.error,null);
 const all=[...previous,...result.results];fs.writeFileSync(progressPath,JSON.stringify(all,null,2));
 console.log(JSON.stringify({total:all.length,successful:all.filter(r=>r.ok).length,failures:all.filter(r=>!r.ok).map(r=>({id:r.id,error:r.error})),supportConfirmed:all.filter(r=>r.recognition?.values.support).length,edtConfirmed:all.filter(r=>r.recognition?.values.edt).length,campaignConfirmed:all.filter(r=>r.recognition?.values.campaign).length,visualConfirmed:all.filter(r=>r.recognition?.values.visual).length,ready:all.filter(r=>r.recognition?.ready).length}));
});
 const after=await login.client.from('support_photos').select('id,storage_bucket,storage_path,import_finalized_at,movement_history_id').in('id',selection.ids);assert.ifError(after.error);assert.equal(after.data.length,204);for(const p of after.data){const before=photos.find(x=>x.id===p.id);assert.equal(p.storage_path,before.storage_path);assert.equal(p.storage_bucket,before.storage_bucket);assert.equal(p.import_finalized_at,before.import_finalized_at);assert.equal(p.movement_history_id,before.movement_history_id);}
 console.log('PASS: all 204 originals and previous finalization/movement states preserved');
}finally{await server.close();await login.client.auth.signOut({scope:'local'});}
