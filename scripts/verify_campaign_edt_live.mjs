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
if(local){server=await preview({preview:{host:'127.0.0.1',port:5186,strictPort:true}});process.env.TDM_TEST_PORTAL_ORIGIN='http://127.0.0.1:5186';}
const access=await targetedAccess(),records=[],name='MISSION-VISUEL-'+crypto.randomUUID(),logins=[];
const dir='.cache/campaign-edt';fs.mkdirSync(dir,{recursive:true});
const clientsOnly=process.argv.includes('--clients-only');
if(clientsOnly)records.push(...JSON.parse(fs.readFileSync(`${dir}/${label}-browser.json`,'utf8')).records.filter(r=>!r.actor));
let visualId;
const pdf=new jsPDF();pdf.text('Reference campagne Groupe TOS',20,25);for(let i=0;i<60;i++)pdf.text(`REFERENCE ${i}`,10+(i%4)*45,40+Math.floor(i/4)*12);
const pdfBase64=Buffer.from(pdf.output('arraybuffer')).toString('base64');
const click=(b,text,selector='button')=>b.evaluate(`[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim()===${JSON.stringify(text)}).click()`);
const navigate=async(b,label)=>{await b.waitFor(`[...document.querySelectorAll('aside button')].some(e=>e.textContent.trim().endsWith(${JSON.stringify(label)}))`,90);await b.evaluate(`[...document.querySelectorAll('aside button')].find(e=>e.textContent.trim().endsWith(${JSON.stringify(label)})).click()`)};
async function input(b,selector,value){await b.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);await b.pause(90)}
async function upload(b,type){await b.evaluate(`(async()=>{let file;
 if(${JSON.stringify(type)}==='pdf'){file=new File([Uint8Array.from(atob(${JSON.stringify(pdfBase64)}),c=>c.charCodeAt(0))],'mission-reference.pdf',{type:'application/pdf'});}
 else{const c=document.createElement('canvas');c.width=600;c.height=800;const x=c.getContext('2d');x.fillStyle='#ffffff';x.fillRect(0,0,600,800);for(let i=0;i<80;i++){x.fillStyle=i%2?'#ee4422':'#1155aa';x.fillRect((i*41)%550,(i*73)%750,20+i%40,30);x.fillStyle='#000000';x.font='18px Arial';x.fillText('TOS '+i,(i*29)%500,(i*83)%780);}file=new File([await new Promise(r=>c.toBlob(r,'image/png'))],'mission-reference.png',{type:'image/png'});}
 const dt=new DataTransfer();dt.items.add(file);const e=document.querySelector('.visual-references input[type=file]');e.files=dt.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()`)}
try{
 if(!clientsOnly){
 const admin=await existingSession(access,1);logins.push(admin);
 console.log(label+': admin session ready');
 await productionBrowser(admin.session,async b=>{
  for(const view of ['Campagnes maîtres','Communications opérationnelles']){
   console.log(label+': '+view);
   await navigate(b,view);await b.waitFor("!!document.querySelector('.campaign-list')");
   assert.equal(await b.evaluate("[...document.querySelectorAll('.campaign-list button')].some(e=>/Fiche du (visuel|thème)/.test(e.textContent))"),false);records.push({view,shortcutAbsent:true});
  }
  await navigate(b,'Campagne — Visuels et formats');await b.waitFor("document.querySelectorAll('.visuals-compact-table tbody tr').length>0");
  assert.equal(await b.evaluate("document.querySelectorAll('.visuals-compact-table .visual-references,input[type=file]').length"),0);
  await click(b,'Créer un visuel');await b.waitFor("!!document.querySelector('form.v74-form')");
  assert.equal(b.responses.some(r=>r.url.includes('/vendor/opencv-')),false,'Opening form must not load OpenCV');
  await b.evaluate(`window.setVisualField=(text,value)=>{const label=[...document.querySelectorAll('form.v74-form > label')].find(e=>e.firstChild.textContent.trim()===text);const e=label.querySelector('input,select');Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));}`);
  await b.evaluate("setVisualField('Campagne','11')");await b.pause(100);
  await b.evaluate(`setVisualField('Nom du visuel',${JSON.stringify(name)})`);await b.pause(100);
  await b.evaluate("setVisualField('Format exact du support','20 x 28')");await b.pause(100);
  await click(b,'Enregistrer');await b.waitFor(`!![...document.querySelectorAll('.visuals-compact-table tbody tr')].find(e=>e.textContent.includes(${JSON.stringify(name)}))`);
  const created=await admin.client.from('campagne_visuels_formats').select('id').eq('nom_visuel',name).single();assert.ifError(created.error);visualId=created.data.id;
  const edit=async()=>{await b.waitFor(`[...document.querySelectorAll('.visuals-compact-table tbody tr')].find(e=>e.textContent.includes(${JSON.stringify(name)}))?.querySelector('button')?.disabled===false`);await b.evaluate(`[...document.querySelectorAll('.visuals-compact-table tbody tr')].find(e=>e.textContent.includes(${JSON.stringify(name)})).querySelector('button').click()`);await b.waitFor("!!document.querySelector('form .visual-references input[type=file]')")};
  await edit();
  console.log(label+': visual created; testing failed loader and retry');
  await b.send('Network.setBlockedURLs',{urls:['*/vendor/opencv-*']});await upload(b,'image');
  await b.waitFor("document.querySelector('.visual-references')?.textContent.includes('Votre formulaire est conservé')",100);
  assert(await b.evaluate(`[...document.querySelectorAll('form.v74-form input')].some(e=>e.value===${JSON.stringify(name)})`),'Failed recognition must preserve form values');
  await b.send('Network.setBlockedURLs',{urls:[]});await upload(b,'image');
  await b.waitFor("document.querySelector('.visual-references')?.textContent.includes('Références enregistrées.')",120);
  await upload(b,'pdf');await b.waitFor("document.querySelector('.visual-references')?.textContent.includes('mission-reference.pdf') && !document.querySelector('.visual-references input').disabled",120);
  console.log(label+': image and PDF saved');
  await click(b,'Enregistrer les modifications');await b.waitFor("!document.querySelector('form.v74-form')");await edit();
  await b.waitFor("document.querySelector('.visual-references')?.textContent.includes('mission-reference.pdf')");
  assert(await b.evaluate("document.querySelector('.visual-references').textContent.includes('mission-reference.png')"));
  await b.waitFor("[...document.querySelectorAll('.visual-references img')].some(e=>e.complete&&e.naturalWidth>0)");
  const refs=await admin.client.from('campagne_visuels_formats').select('reference_assets').eq('id',visualId).single();assert.ifError(refs.error);assert.equal(refs.data.reference_assets.length,2);
  assert(refs.data.reference_assets.every(a=>a.pages[0].features.points.length>0));
  await b.evaluate("window.confirm=()=>true");await click(b,'Supprimer la référence');await b.waitFor("document.querySelectorAll('.visual-references button').length===1");
  await click(b,'Enregistrer les modifications');await b.waitFor("!document.querySelector('form.v74-form')");
  for(const ignoreCache of [false,true]){await b.send('Page.reload',{ignoreCache});await b.waitFor("document.querySelectorAll('aside button').length>2",90);await navigate(b,'Campagne — Visuels et formats');await b.waitFor(`!![...document.querySelectorAll('.visuals-compact-table tbody tr')].find(e=>e.textContent.includes(${JSON.stringify(name)}))`);await edit();assert(await b.evaluate("document.querySelector('.visual-references').textContent.includes('mission-reference.pdf')"));await click(b,'Annuler');}
  records.push({view:'Visuels',compact:true,create:true,edit:true,image:true,pdf:true,reopen:true,remove:true,retry:true,cachedReload:true,hardRefresh:true});
  await navigate(b,'Centre EDT et BT');await b.waitFor("document.querySelectorAll('.edt-list article').length>0",90);
  console.log(label+': EDT loaded');
  const numbers=await b.evaluate("[...document.querySelectorAll('.edt-select strong')].map(e=>e.textContent)");assert.deepEqual(numbers,[...numbers].sort((a,c)=>compareNatural(a,c)||a.length-c.length));
  await input(b,'input[aria-label="Rechercher un EDT"]','EDT-TOS-22-A');await input(b,'select[aria-label="Filtrer les EDT"]','Terminés');
  assert.equal(await b.evaluate("document.querySelectorAll('.edt-list article').length"),1);assert(await b.evaluate("document.querySelector('.edt-list').textContent.includes('100%') && document.querySelector('.edt-select').textContent.includes('Terminé')"));
  await input(b,'select[aria-label="Filtrer les EDT"]','Tous');assert.equal(await b.evaluate("document.querySelectorAll('.edt-list article').length"),1);
  await input(b,'select[aria-label="Filtrer les EDT"]','Archivés');assert.equal(await b.evaluate("document.querySelectorAll('.edt-list article').length"),0);
  await input(b,'input[aria-label="Rechercher un EDT"]','EDT-TOS-09.0.1');await input(b,'select[aria-label="Filtrer les EDT"]','Tous');assert.equal(await b.evaluate("document.querySelectorAll('.edt-list article').length"),1);
  await input(b,'select[aria-label="Filtrer les EDT"]','Terminés');assert.equal(await b.evaluate("document.querySelectorAll('.edt-list article').length"),1);assert(await b.evaluate("document.querySelector('.edt-list').textContent.includes('100%') && document.querySelector('.edt-select').textContent.includes('Terminé')"));
  await input(b,'select[aria-label="Filtrer les EDT"]','Archivés');assert.equal(await b.evaluate("document.querySelectorAll('.edt-list article').length"),0);
  records.push({view:'EDT',naturalOrder:true,search22:true,completed22:true,all22:true,archiveExcludes22:true,search09Alias:true,completed09:true,all09:true,archiveExcludes09:true});
  const unexpected=b.errors.filter(e=>!e.includes('ERR_BLOCKED_BY_CLIENT'));assert.deepEqual(unexpected,[]);
 },{initSource:'window.confirm=()=>true;'});
 }
 for(const [actor,id] of [['marylene',25],['client',33],['client-b',-92501]]){
  console.log(label+': '+actor);
  const login=await existingSession(access,id);logins.push(login);
  const rpc=await login.client.rpc('portal_business_context',{p_kind:'operations',p_id:null});
  const edtAllowed=!rpc.error;
  if(edtAllowed)assert(rpc.data.edts.every(e=>e.client_id===login.profile.client_id));
  else assert.equal(rpc.error.code,'42501','Only the existing permission denial is expected');
  await productionBrowser(login.session,async b=>{
   await b.waitFor("document.querySelectorAll('aside button').length>2",90);
   for(const view of ['Campagnes','Communications opérationnelles']){
    const allowed=await b.evaluate(`[...document.querySelectorAll('aside button')].some(e=>e.textContent.trim().endsWith(${JSON.stringify(view)}))`);
    if(allowed){await navigate(b,view);await b.waitFor("!!document.querySelector('.campaign-list')");assert.equal(await b.evaluate("[...document.querySelectorAll('.campaign-list button')].some(e=>/Fiche du (visuel|thème)/.test(e.textContent))"),false);}
   }
   if(!edtAllowed){assert.equal(await b.evaluate("[...document.querySelectorAll('aside button')].some(e=>e.textContent.trim()==='EDT / Progression')"),false);assert.deepEqual(b.errors,[]);return;}
   await navigate(b,'EDT / Progression');await b.waitFor("!!document.querySelector('input[aria-label=\"Rechercher un EDT\"]')");
   await b.waitFor(`document.querySelectorAll('.edt-list article').length===${rpc.data.edts.length}`,90);
   if(login.profile.role==='Client')assert.equal(await b.evaluate("document.querySelectorAll('.edt-actions button').length"),0);
   await input(b,'input[aria-label="Rechercher un EDT"]','EDT-TOS-22-A');
   assert.equal(await b.evaluate("document.querySelectorAll('.edt-list article').length"),rpc.data.edts.filter(e=>e.no_edt==='EDT-TOS-22-A').length);
   assert.deepEqual(b.errors,[]);
  });
  records.push({actor,clientScope:true,edtCount:rpc.data?.edts?.length,search:edtAllowed?'PASS':'not exposed by existing permissions',permissions:true});
 }
 console.log('PASS: '+label+' browser campaigns, compact visuals, image/PDF uploads, retry, save/reopen, delete, cache, EDT filters and all client roles');
}finally{
 if(!visualId){const row=await access.admin.from('campagne_visuels_formats').select('id').eq('nom_visuel',name).maybeSingle();assert.ifError(row.error);visualId=row.data?.id;}
 if(visualId){
  const row=await access.admin.from('campagne_visuels_formats').select('id,nom_visuel,reference_assets').eq('id',visualId).single();assert.ifError(row.error);assert.equal(row.data.nom_visuel,name);
  const paths=row.data.reference_assets.map(a=>a.storage_path);if(paths.length){const removed=await access.admin.storage.from('visual-references').remove(paths);assert.ifError(removed.error);}
  const cleared=await access.admin.from('campagne_visuels_formats').update({reference_assets:[]}).eq('id',visualId).eq('nom_visuel',name);assert.ifError(cleared.error);
  const removed=await access.admin.from('campagne_visuels_formats').delete().eq('id',visualId).eq('nom_visuel',name);assert.ifError(removed.error);
 }
 for(const login of logins)await login.client.auth.signOut({scope:'local'});
 fs.writeFileSync(`${dir}/${label}-browser.json`,JSON.stringify({at:new Date().toISOString(),records},null,2));
 if(server)await new Promise(resolve=>server.httpServer.close(resolve));
}
