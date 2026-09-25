import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {productionBrowser} from './targeted_test_browser.mjs';

const root='.vercel/output/static',origin='https://portail.groupetos.com';
const files=fs.readdirSync(root+'/assets');
const ocr=files.filter(name=>name.endsWith('.js')&&fs.readFileSync(root+'/assets/'+name,'utf8').includes('glass-left-0'));
assert.equal(ocr.length,1,'Exactly one canonical OCR implementation in the release');
const localHtml=fs.readFileSync(root+'/index.html','utf8');
const entry=[...localHtml.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(m=>m[1]);
const assets=['/index.html',...entry,...ocr.map(name=>'/assets/'+name),...files.filter(name=>/^worker\.min-.*\.js$/.test(name)).map(name=>'/assets/'+name)];
for(const name of files.filter(name=>name.endsWith('.js'))){
 const source=fs.readFileSync(root+'/assets/'+name,'utf8');
 assert(!/sb_secret_[A-Za-z0-9]+/.test(source),'No secret API key in release');
 for(const match of source.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)){
  let payload;try{payload=JSON.parse(Buffer.from(match[1],'base64url').toString());}catch{continue;}
  assert.notEqual(payload.role,'service_role','No service key in release');
 }
}
if(process.argv.includes('--audit-only')){console.log('PASS: canonical OCR asset and no private API key in release');process.exit(0);}
const records=[];
for(const asset of assets){
 const response=await fetch(origin+asset,{headers:{'Cache-Control':'no-cache'}});assert.equal(response.status,200,asset);
 const bytes=Buffer.from(await response.arrayBuffer());assert.deepEqual(bytes,fs.readFileSync(path.join(root,asset)),asset+' matches the tested build');
 records.push({asset,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
}
await productionBrowser(null,async b=>{
 await b.waitFor('/connexion|connecter/i.test(document.body.innerText)',45);
 assert.equal(b.responses.filter(r=>r.status>=400&&r.url.startsWith(origin+'/assets/')).length,0);
});
fs.writeFileSync('.cache/visual-terrain-stock/ocr-corner-deployment.json',JSON.stringify({at:new Date().toISOString(),origin,result:'PASS',scope:'Production login and exact published HTML, entry assets, OCR chunk and worker; OCR fixtures run locally',records},null,2));
console.log('PASS: production login, published entry/OCR/worker bytes match the validated build');
