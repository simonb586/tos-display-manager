import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {productionBrowser} from './targeted_test_browser.mjs';

const root='.vercel/output/static',origin='https://portail.groupetos.com';
const files=fs.readdirSync(root+'/assets').filter(name=>name.endsWith('.js'));
const sources=files.map(name=>({name,source:fs.readFileSync(root+'/assets/'+name,'utf8')}));
const material=sources.filter(({source})=>source.includes('resolve_repertoire_affiche')||source.includes('finaliser_installation_terrain_v1345'));
assert(material.some(({source})=>source.includes('resolve_repertoire_affiche')));
assert(material.some(({source})=>source.includes('finaliser_installation_terrain_v1345')));
assert(sources.some(({source})=>source.includes('glass-left-0')),'Preserve OCR glass/corner improvement');
for(const {source} of sources){
 assert(!/sb_secret_[A-Za-z0-9]+/.test(source),'No secret API key');
 for(const match of source.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)){
  let payload;try{payload=JSON.parse(Buffer.from(match[1],'base64url').toString());}catch{continue;}
  assert.notEqual(payload.role,'service_role','No service key');
 }
}
if(process.argv.includes('--audit-only')){console.log('PASS: automatic resolver/finalizer, retained OCR, public keys only');process.exit(0);}
const html=fs.readFileSync(root+'/index.html','utf8');
const assets=[...new Set(['/index.html',...[...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(m=>m[1]),...material.map(({name})=>'/assets/'+name)])];
const records=[];
for(const asset of assets){
 const response=await fetch(origin+asset,{headers:{'Cache-Control':'no-cache'}});assert.equal(response.status,200,asset);
 const bytes=Buffer.from(await response.arrayBuffer());assert.deepEqual(bytes,fs.readFileSync(path.join(root,asset)),asset+' matches tested build');
 records.push({asset,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
}
await productionBrowser(null,async b=>{
 await b.waitFor('/connexion|connecter/i.test(document.body.innerText)',45);
 assert.equal(b.responses.filter(r=>r.status>=400&&r.url.startsWith(origin+'/assets/')).length,0);
});
fs.writeFileSync('.cache/terrain-material/deployment.json',JSON.stringify({at:new Date().toISOString(),origin,result:'PASS',scope:'Production login, entry assets and Terrain resolver/finalizer bytes; functional tests run locally and with rollback SQL',records},null,2));
console.log('PASS: production login and Terrain assets match validated build');
