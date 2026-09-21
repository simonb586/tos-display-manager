import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {preview} from 'vite';
import {jsPDF} from 'jspdf';
import {targetedAccess} from './targeted_remote_access.mjs';
import {existingSession} from './targeted_existing_session.mjs';
import {productionBrowser} from './targeted_test_browser.mjs';
import {compareNatural} from '../src/lib/gridSorting.js';
const local=process.argv.includes('--local'),label=local?'local':'production';
let server;
if(local){server=await preview({preview:{host:'127.0.0.1',port:5185,strictPort:true}});process.env.TDM_TEST_PORTAL_ORIGIN='http://127.0.0.1:5185';}
const access=await targetedAccess(),records=[],name='MISSION-VISUEL-'+crypto.randomUUID(),logins=[];
const dir='.cache/visual-terrain-stock';fs.mkdirSync(dir,{recursive:true});
const clientsOnly=process.argv.includes('--clients-only');
if(clientsOnly)records.push(...JSON.parse(fs.readFileSync(`${dir}/references-${label}-browser.json`,'utf8')).records.filter(r=>!r.actor));
let visualId;const supportId='REF-'+crypto.randomUUID();let supportCreated=false;
const pdf=new jsPDF();pdf.text('Reference campagne Groupe TOS',20,25);for(let i=0;i<60;i++)pdf.text(`REFERENCE ${i}`,10+(i%4)*45,40+Math.floor(i/4)*12);
const pdfBase64=Buffer.from(pdf.output('arraybuffer')).toString('base64');
const click=(b,text,selector='button')=>b.evaluate(`[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim()===${JSON.stringify(text)}).click()`);
const navigate=async(b,label)=>{await b.waitFor(`[...document.querySelectorAll('aside button')].some(e=>e.textContent.trim().endsWith(${JSON.stringify(label)}))`,90);await b.evaluate(`[...document.querySelectorAll('aside button')].find(e=>e.textContent.trim().endsWith(${JSON.stringify(label)})).click()`)};
async function input(b,selector,value){await b.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);await b.pause(90)}
async function upload(b,type,replacement=false){await b.evaluate(`(async()=>{let file;
 if(${JSON.stringify(type)}==='pdf'){file=new File([Uint8Array.from(atob(${JSON.stringify(pdfBase64)}),c=>c.charCodeAt(0))],'mission-reference.pdf',{type:'application/pdf'});}
 else{const c=document.createElement('canvas');c.width=600;c.height=800;const x=c.getContext('2d');x.fillStyle='#ffffff';x.fillRect(0,0,600,800);for(let i=0;i<80;i++){x.fillStyle=i%2?'#ee4422':'#1155aa';x.fillRect((i*41)%550,(i*73)%750,20+i%40,30);x.fillStyle='#000000';x.font='18px Arial';x.fillText('TOS '+i,(i*29)%500,(i*83)%780);}file=new File([await new Promise(r=>c.toBlob(r,${JSON.stringify(type)}==='jpg'?'image/jpeg':'image/png'))],${JSON.stringify(type)}==='jpg'?'mission-reference.jpg':'mission-reference.png',{type:${JSON.stringify(type)}==='jpg'?'image/jpeg':'image/png'});}
 const dt=new DataTransfer();dt.items.add(file);const e=document.querySelector(${JSON.stringify(replacement?'.visual-references input[hidden]':'.visual-references input[type=file]:not([hidden])')});e.files=dt.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()`)}
try{
 if(!clientsOnly){
 const admin=await existingSession(access,1);logins.push(admin);
 console.log(label+': admin session ready');
 await productionBrowser(admin.session,async b=>{
  await navigate(b,'Campagne — Visuels et formats');await b.waitFor("document.querySelectorAll('.visuals-compact-table tbody tr').length>0");
  assert.equal(await b.evaluate("document.querySelectorAll('.visuals-compact-table .visual-references,input[type=file]').length"),0);
  await click(b,'Créer un visuel');await b.waitFor("!!document.querySelector('form.v74-form')");
  assert.equal(b.responses.some(r=>r.url.includes('/vendor/opencv-')),false,'Opening form must not load OpenCV');
  await b.evaluate(`window.setVisualField=(text,value)=>{const label=[...document.querySelectorAll('form.v74-form > label')].find(e=>e.firstChild.textContent.trim()===text);const e=label.querySelector('input,select');Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));}`);
  await b.evaluate("setVisualField('Campagne','11')");await b.pause(100);
  await b.evaluate(`setVisualField('Nom du visuel',${JSON.stringify(name)})`);await b.pause(100);
  await b.evaluate("setVisualField('Format exact du support','20 x 28')");await b.pause(100);
  await upload(b,'image');await upload(b,'jpg');await upload(b,'pdf');
  assert(await b.evaluate("document.querySelector('.visual-references').textContent.includes('mission-reference.jpg')"));
  await click(b,'Enregistrer');await b.waitFor(`!![...document.querySelectorAll('.visuals-compact-table tbody tr')].find(e=>e.textContent.includes(${JSON.stringify(name)}))`);
  const created=await admin.client.from('campagne_visuels_formats').select('id').eq('nom_visuel',name).single();assert.ifError(created.error);visualId=created.data.id;
  const edit=async()=>{await b.waitFor(`[...document.querySelectorAll('.visuals-compact-table tbody tr')].find(e=>e.textContent.includes(${JSON.stringify(name)}))?.querySelector('button')?.disabled===false`);await b.evaluate(`[...document.querySelectorAll('.visuals-compact-table tbody tr')].find(e=>e.textContent.includes(${JSON.stringify(name)})).querySelector('button').click()`);await b.waitFor("!!document.querySelector('form .visual-references input[type=file]:not([hidden])')")};
  await edit();
  await click(b,'Enregistrer les modifications');await b.waitFor("!document.querySelector('form.v74-form')");await edit();
  await b.waitFor("document.querySelector('.visual-references')?.textContent.includes('mission-reference.pdf')");
  assert(await b.evaluate("document.querySelector('.visual-references').textContent.includes('mission-reference.png')"));
  await b.waitFor("[...document.querySelectorAll('.visual-references img')].some(e=>e.complete&&e.naturalWidth>0)");
  const refs=await admin.client.from('campagne_visuels_formats').select('reference_assets').eq('id',visualId).single();assert.ifError(refs.error);assert.equal(refs.data.reference_assets.length,3);
  assert(refs.data.reference_assets.every(a=>a.pages[0].features.points.length>0));
  const original=refs.data.reference_assets.find(a=>a.name==='mission-reference.jpg');
  await b.evaluate("[...document.querySelectorAll('.visual-references>div')].find(d=>d.textContent.includes('mission-reference.jpg')).querySelector('button').click()");await upload(b,'jpg',true);await b.waitFor("document.querySelector('.visual-references').textContent.includes('Références enregistrées.')");
  const replaced=await admin.client.from('campagne_visuels_formats').select('reference_assets').eq('id',visualId).single();assert.ifError(replaced.error);assert(replaced.data.reference_assets.find(a=>a.id===original.id).archived);assert.equal(replaced.data.reference_assets.filter(a=>!a.archived).length,3);
  await b.evaluate("window.confirm=()=>true;[...document.querySelectorAll('.visual-references>div')].find(d=>d.textContent.includes('mission-reference.jpg')).querySelectorAll('button')[1].click()");await b.waitFor("[...document.querySelectorAll('.visual-references button')].filter(b=>b.textContent==='Supprimer la référence').length===2");
  await click(b,'Enregistrer les modifications');await b.waitFor("!document.querySelector('form.v74-form')");
  for(const ignoreCache of [false,true]){await b.send('Page.reload',{ignoreCache});await b.waitFor("document.querySelectorAll('aside button').length>2",90);await navigate(b,'Campagne — Visuels et formats');await b.waitFor(`!![...document.querySelectorAll('.visuals-compact-table tbody tr')].find(e=>e.textContent.includes(${JSON.stringify(name)}))`);await edit();assert(await b.evaluate("document.querySelector('.visual-references').textContent.includes('mission-reference.pdf')"));await click(b,'Annuler');}
  records.push({view:'Visuels',compact:true,create:true,edit:true,image:true,pdf:true,reopen:true,remove:true,retry:true,cachedReload:true,hardRefresh:true});
  for(const width of [1440,1024,390]){await b.send('Emulation.setDeviceMetricsOverride',{width,height:800,deviceScaleFactor:1,mobile:width<600});await b.pause(200);const metrics=await b.evaluate("(()=>{const t=document.querySelector('.visual-table-scroll'),a=t.querySelector('tbody td:last-child');t.scrollLeft=t.scrollWidth;return {viewport:innerWidth,body:document.documentElement.scrollWidth,actions:getComputedStyle(a).position,overflow:getComputedStyle(t).overflowX}})()");assert.equal(metrics.actions,'sticky');assert.equal(metrics.overflow,'auto');assert(metrics.body<=metrics.viewport+1,JSON.stringify(metrics));records.push({width,...metrics});}
  await b.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  const support=await access.admin.from('infrastructures').insert({support_id:supportId,client_id:2,visuel_id:visualId,visuel_campagne:name,format_affichage:'20 x 28',site:'Visual reference workflow fixture'});assert.ifError(support.error);supportCreated=true;
  await navigate(b,'Infrastructures');await b.waitFor("!!document.querySelector('[aria-label=\"Recherche globale — Infrastructures\"]')",90);
  await input(b,'[aria-label="Recherche globale — Infrastructures"]',supportId);
  await b.waitFor(`[...document.querySelectorAll('.professional-grid tbody tr')].some(r=>r.textContent.includes('${supportId}'))`);
  await b.evaluate(`[...document.querySelectorAll('.professional-grid tbody tr')].find(r=>r.textContent.includes('${supportId}')).click()`);
  await b.waitFor("!!document.querySelector('.support360-module img')",60);
  await b.waitFor("[...document.querySelectorAll('.support360-module img')].some(i=>i.complete&&i.naturalWidth>0)");
  assert(await b.evaluate("document.querySelector('.support360-module').textContent.includes('mission-reference.pdf')"));
  const current=await admin.client.from('infrastructures').select('photo_principale_url').eq('support_id',supportId).single();assert.ifError(current.error);assert.equal(current.data.photo_principale_url,null);
  records.push({infrastructure360Reference:true,mainPhotoPreserved:true,jpg:true,png:true,pdf:true,replace:true});
  await b.evaluate("document.querySelector('.drawer .close').click()");await navigate(b,'Campagne — Visuels et formats');
  await b.waitFor(`[...document.querySelectorAll('.visuals-compact-table tbody tr')].some(r=>r.textContent.includes(${JSON.stringify(name)}))`);
  await b.evaluate(`[...document.querySelectorAll('.visuals-compact-table tbody tr')].find(r=>r.textContent.includes(${JSON.stringify(name)})).querySelector('button.danger').click()`);
  await b.waitFor("document.body.textContent.includes('archivé')");
  const archived=await admin.client.from('campagne_visuels_formats').select('actif,reference_assets').eq('id',visualId).single();assert.ifError(archived.error);assert.equal(archived.data.actif,false);assert.equal(archived.data.reference_assets.length,4);records.push({deleteVisualArchivesUsedReferences:true});
  const unexpected=b.errors.filter(e=>!e.includes('ERR_BLOCKED_BY_CLIENT'));assert.deepEqual(unexpected,[]);
 },{initSource:'window.confirm=()=>true;'});
 }
 console.log('PASS: create JPG/PNG/PDF, replace/archive reference, reopen, delete reference and desktop/laptop/mobile scroll/actions');
}finally{
 if(supportCreated){const deleted=await access.admin.from('infrastructures').delete().eq('support_id',supportId).eq('site','Visual reference workflow fixture');assert.ifError(deleted.error);}
 if(!visualId){const row=await access.admin.from('campagne_visuels_formats').select('id').eq('nom_visuel',name).maybeSingle();assert.ifError(row.error);visualId=row.data?.id;}
 if(visualId){
  const row=await access.admin.from('campagne_visuels_formats').select('id,nom_visuel,reference_assets').eq('id',visualId).single();assert.ifError(row.error);assert.equal(row.data.nom_visuel,name);
  const paths=row.data.reference_assets.map(a=>a.storage_path);if(paths.length){const removed=await access.admin.storage.from('visual-references').remove(paths);assert.ifError(removed.error);}
  const cleared=await access.admin.from('campagne_visuels_formats').update({reference_assets:[]}).eq('id',visualId).eq('nom_visuel',name);assert.ifError(cleared.error);
  const removed=await access.admin.from('campagne_visuels_formats').delete().eq('id',visualId).eq('nom_visuel',name);assert.ifError(removed.error);
 }
 for(const login of logins)await login.client.auth.signOut({scope:'local'});
 fs.writeFileSync(`${dir}/references-${label}-browser.json`,JSON.stringify({at:new Date().toISOString(),records},null,2));
 if(server)await new Promise(resolve=>server.httpServer.close(resolve));
}
