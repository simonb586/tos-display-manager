import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const root='.vercel/output/static',origin='https://portail.groupetos.com';
const response=await fetch(origin+'/?release=site-support-installations');assert.equal(response.status,200);
const html=await response.text();assert.equal(html,fs.readFileSync(root+'/index.html','utf8'));
const assets=[...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)].map(m=>m[1]);
const records=[];
for(const asset of assets){
 const r=await fetch(new URL(asset,origin));assert.equal(r.status,200);
 const bytes=Buffer.from(await r.arrayBuffer());assert.deepEqual(bytes,fs.readFileSync(root+asset));
 records.push({asset,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
}
fs.writeFileSync('docs/site-support-installations/deployment.json',JSON.stringify({at:new Date().toISOString(),result:'PASS',commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),origin,htmlMatchesBuild:true,records},null,2));
console.log('PASS: production HTML and initial assets match validated Vercel build');
