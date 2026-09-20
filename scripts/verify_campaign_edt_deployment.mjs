import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root='.vercel/output/static',origin='https://portail.groupetos.com';
const response=await fetch(`${origin}/?release=campaign-edt-${Date.now()}`);
assert.equal(response.status,200);
const html=await response.text();
assert.equal(html,fs.readFileSync(`${root}/index.html`,'utf8'));
assert.match(response.headers.get('cache-control')||'',/no-cache|must-revalidate|max-age=0/);
const assets=new Set([...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)].map(m=>m[1]));
const vendor=fs.readdirSync(`${root}/vendor`).filter(name=>/^opencv-.*\.js$/.test(name));
assert.equal(vendor.length,1);
assets.add(`/vendor/${vendor[0]}`);
const workers=fs.readdirSync(`${root}/assets`).filter(name=>/^pdf\.worker.*\.mjs$/.test(name));
assert.ok(workers.length>0,'PDF worker must be deployed');
workers.forEach(name=>assets.add(`/assets/${name}`));
const records=[];
for(const asset of assets){
 const r=await fetch(new URL(asset,origin));
 assert.equal(r.status,200,asset);
 assert.match(r.headers.get('content-type')||'',asset.endsWith('.css')?/text\/css/:/javascript/,asset);
 const bytes=Buffer.from(await r.arrayBuffer());
 assert.deepEqual(bytes,fs.readFileSync(root+asset),asset);
 if(asset.startsWith('/vendor/'))assert.match(r.headers.get('cache-control')||'',/immutable/);
 records.push({asset,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),cacheControl:r.headers.get('cache-control')});
}
fs.mkdirSync('.cache/campaign-edt',{recursive:true});
fs.writeFileSync('.cache/campaign-edt/deployment.json',JSON.stringify({at:new Date().toISOString(),result:'PASS',commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),origin,htmlMatchesBuild:true,records},null,2));
console.log('PASS: production HTML, initial assets, OpenCV and PDF worker match the validated build and cache policy');
