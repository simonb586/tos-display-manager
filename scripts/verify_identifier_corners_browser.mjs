import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {productionBrowser} from './targeted_test_browser.mjs';

const dir='.cache/visual-terrain-stock';
const server=await createServer({server:{host:'127.0.0.1',port:5187,strictPort:true,hmr:false},plugins:[{
 name:'identifier-fixtures',configureServer(s){
  s.middlewares.use('/ocr-test',(_,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><p>Local support identifier recognition tests: frame and glass corners.</p>');});
  s.middlewares.use('/ocr-sample',(req,res)=>{const id=req.url.slice(1);if(!['0','70','140'].includes(id)){res.statusCode=404;res.end();return;}res.setHeader('Content-Type','image/jpeg');res.end(fs.readFileSync(`${dir}/sample-${id}.jpg`));});
 }
}]});
await server.listen();process.env.TDM_TEST_PORTAL_ORIGIN='http://127.0.0.1:5187/ocr-test';
const results=[];
try{
 await productionBrowser(null,async b=>{
  await b.evaluate(`(async()=>{window.ocrModule=await import('/src/services/frameIdentifierOcrService.js');window.supportCatalog=${fs.readFileSync(dir+'/ocr-supports.json','utf8')}})()`);
  const cases=[
   {name:'small top-right frame',x:2370,y:240,w:3024,h:4032,text:'3002-7',font:32},
   {name:'right glass',x:2220,y:700,w:3024,h:4032,text:'VH-VAUD-16',font:38},
   {name:'left glass',x:100,y:280,w:3024,h:4032,text:'3002-7',font:34},
   {name:'left glass lower sticker',x:100,y:1250,w:3024,h:4032,text:'3002-7',font:34},
   {name:'band boundary',x:2250,y:405,w:3024,h:4032,text:'VH-VAUD-16',font:36},
   {name:'landscape left glass',x:80,y:300,w:4032,h:3024,text:'3002-7',font:38},
   {name:'unknown label',x:2370,y:240,w:3024,h:4032,text:'9999-9',font:36,expected:null}
  ];
  for(const fixture of cases){
   await b.evaluate(`window.ocrResult=null;window.ocrError=null;void(async()=>{try{
    const f=${JSON.stringify(fixture)},c=document.createElement('canvas');c.width=f.w;c.height=f.h;const ctx=c.getContext('2d');
    ctx.fillStyle='#b7c3c5';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#eadfc3';ctx.fillRect(c.width*.15,c.height*.3,c.width*.7,c.height*.6);
    ctx.fillStyle='#353939';ctx.font=f.font+'px Arial';ctx.fillText(f.text,f.x,f.y);
    const file=new File([await new Promise(r=>c.toBlob(r,'image/jpeg',.88))],'external.jpg',{type:'image/jpeg'});
    const start=performance.now();const r=await window.ocrModule.readFrameIdentifier(file,[{support_id:'3002-7'},{support_id:'3002-8'},{support_id:'VH-VAUD-16'}]);
    window.ocrResult={supportId:r.supportId,candidates:r.candidates,milliseconds:Math.round(performance.now()-start)};
   }catch(e){window.ocrError=e.message;}})();`);
   await b.waitFor('window.ocrResult!==null||window.ocrError!==null',65);
   const outcome=await b.evaluate('({result:window.ocrResult,error:window.ocrError})');
   results.push({name:fixture.name,expected:fixture.expected===null?null:fixture.text,...outcome});console.log(JSON.stringify(results.at(-1)));
  }
  for(const [id,expected] of [[0,'CA-SCON-13'],[70,'SJ-SROS-10'],[140,'VH-BEAC-06']]){
   await b.evaluate(`window.ocrResult=null;window.ocrError=null;void(async()=>{try{const blob=await fetch('/ocr-sample/${id}').then(r=>r.blob());const start=performance.now();const r=await window.ocrModule.readFrameIdentifier(new File([blob],'external.jpg',{type:'image/jpeg'}),window.supportCatalog);window.ocrResult={supportId:r.supportId,candidates:r.candidates,milliseconds:Math.round(performance.now()-start)};}catch(e){window.ocrError=e.message;}})();`);
   await b.waitFor('window.ocrResult!==null||window.ocrError!==null',65);
   const outcome=await b.evaluate('({result:window.ocrResult,error:window.ocrError})');results.push({name:'real-'+id,expected,allowManual:id===0,...outcome});console.log(JSON.stringify(results.at(-1)));
  }
  await b.evaluate('window.ocrModule.releaseFrameIdentifierOcr()');
 });
 fs.writeFileSync(`${dir}/ocr-corner-results.json`,JSON.stringify({at:new Date().toISOString(),results},null,2));
 for(const r of results){
  assert.equal(r.error,null,r.name);
  if(r.allowManual&&r.result.supportId===null)assert.equal(r.result.candidates[0]?.support_id,r.expected,r.name+' must retain the correct manual candidate');
  else assert.equal(r.result.supportId,r.expected,r.name);
 }
 console.log('PASS: frame, both glass sides, boundary, landscape, unknown and real-photo non-regression (difficult real-0 may require manual review)');
}finally{await server.close();}
