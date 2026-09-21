import fs from 'node:fs';
import {createServer} from 'vite';
import {productionBrowser} from './targeted_test_browser.mjs';
const dir='.cache/visual-terrain-stock';
const server=await createServer({server:{host:'127.0.0.1',port:5187,strictPort:true},plugins:[{name:'diagnostic-photos',configureServer(s){s.middlewares.use('/diagnostic-sample',(req,res)=>{const id=req.url.replace(/\D/g,'');if(!['0','70','140'].includes(id)){res.statusCode=404;res.end();return;}res.setHeader('Content-Type','image/jpeg');res.end(fs.readFileSync(`${dir}/sample-${id}.jpg`));});}}]});
await server.listen();process.env.TDM_TEST_PORTAL_ORIGIN='http://127.0.0.1:5187';const results=[];
try{await productionBrowser(null,async b=>{
 await b.evaluate(`window.supportCatalog=${fs.readFileSync(dir+'/ocr-supports.json','utf8')}`);
 for(const id of [0,70,140]){
  await b.evaluate(`window.ocrDiagnostic=null;window.ocrDiagnosticError=null;(async()=>{try{const m=await import('/src/services/frameIdentifierOcrService.js');const blob=await fetch('/diagnostic-sample/${id}').then(r=>r.blob());window.ocrDiagnostic=await m.readFrameIdentifier(new File([blob],'sample.jpg',{type:'image/jpeg'}),window.supportCatalog);}catch(e){window.ocrDiagnosticError=e.message;}})();`);
  await b.waitFor('window.ocrDiagnostic!==null||window.ocrDiagnosticError!==null',90);
  const result=await b.evaluate('({result:window.ocrDiagnostic,error:window.ocrDiagnosticError})');results.push({id,...result});console.log(id,JSON.stringify(result));
 }
 fs.writeFileSync(dir+'/ocr-real-samples.json',JSON.stringify({results,errors:b.errors,responses:b.responses.filter(r=>r.status>=400)},null,2));
});}finally{await server.close();}
