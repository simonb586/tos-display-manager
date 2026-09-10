import assert from 'node:assert/strict';
import fs from 'node:fs';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
const records=[];const certification=process.argv.includes("--certification");
await offlineBrowser('scripts/fixtures/terrain-form-entry.jsx',async({evaluate,waitFor,sleep,exceptions,consoleErrors})=>{
 await waitFor("typeof mount==='function'");
 for(const role of certification?['Administrateur','Coordonnateur']:['Installateur'])for(const action of ['installation','inspection','enjeu']){
  await evaluate(`mount('${role}')`);await sleep(80);
  await evaluate("document.querySelector('button[type=submit]').click()");await waitFor("document.body.textContent.includes('Sélectionne une fiche')");
  assert.equal(await evaluate('terrainFixture.calls.length'),0);
  await evaluate("window.change=(n,v)=>{Object.getOwnPropertyDescriptor(n.tagName==='SELECT'?HTMLSelectElement.prototype:n.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(n,v);n.dispatchEvent(new Event(n.tagName==='SELECT'?'change':'input',{bubbles:true}))};change(document.querySelector('.terrain-inline input'),'VH-VAUD-16')");await sleep(30);
  await evaluate("document.querySelector('.terrain-suggestions button').click()");await sleep(150);
  await evaluate(`change(document.querySelector('form select'),'${action}')`);await sleep(60);
  if(action==='installation'){
   await evaluate("document.querySelector('button[type=submit]').click()");assert.equal(await evaluate("document.querySelector('form').checkValidity()"),false,'required visual blocks submission');
   await evaluate("change([...document.querySelectorAll('form select')].find(s=>[...s.options].some(o=>o.value==='34')),'34')");await sleep(30);
  }
  await evaluate("[...document.querySelectorAll('form select[required]')].filter(n=>!n.value&&n.options.length>1).forEach(n=>change(n,n.options[1].value))");await sleep(30);
  if(action==='enjeu'){await evaluate("change(document.querySelector('form input[required]'),'Fixture issue')");await sleep(30)}
  await evaluate("document.querySelector('button[type=submit]').click()");await waitFor("document.body.textContent.includes('joins une photo')");
  await evaluate("window.attach=(type)=>{const dt=new DataTransfer();dt.items.add(new File([new Uint8Array([137,80,78,71])],'local.png',{type}));const n=document.querySelector('input[type=file]');n.files=dt.files;n.dispatchEvent(new Event('change',{bubbles:true}))};attach('text/plain')");await waitFor("document.body.textContent.includes('doit être une image')");
  await evaluate("attach('image/png')");await sleep(40);
  await evaluate("change(document.querySelector('form textarea'),'Comment preserved');terrainFixture.fail=true;document.querySelector('button[type=submit]').click()");await waitFor("document.body.textContent.includes('TERRAIN_FIXTURE_ERROR')");
  assert.equal(await evaluate("document.querySelector('form textarea').value"),'Comment preserved');
  assert.equal(await evaluate("document.querySelector('input[type=file]').files.length"),1);
  assert.equal(await evaluate("terrainFixture.calls.filter(c=>c.name==='rollbackUploadedPhoto').length"),1,'failed finalization rolls back upload');
  await evaluate("terrainFixture.fail=false;window.before=terrainFixture.calls.length;const b=document.querySelector('button[type=submit]');b.click();b.click()");await sleep(20);
  assert.equal(await evaluate("document.querySelector('button[type=submit]').disabled"),true);
  await waitFor("document.body.textContent.includes('confirmée')||document.body.textContent.includes('Intervention terminée')");
  assert.equal(await evaluate("terrainFixture.calls.slice(before).filter(c=>c.name==='uploadTerrainPhoto').length"),1);
  assert.equal(await evaluate("terrainFixture.calls.slice(before).filter(c=>c.name.startsWith('finalize')).length"),1);
  assert.equal(await evaluate("document.querySelector('input[type=file]').files.length"),0);
  assert.equal(await evaluate("document.querySelector('form textarea').value"),'');
  records.push({FORM_ID:'TerrainApp.submit',ROLE:role,MODE:action,TESTS:'required selection|required visual/photo|invalid file|upload|error|rollback|draft retained|retry|double submit|loading|success|cleanup',RESULT:'PASS_LOCAL_BROWSER'});
 }
 for(const role of certification?[]:['Client','Client-Admin']){await evaluate(`mount('${role}')`);await sleep(60);assert.equal(await evaluate("Boolean(document.querySelector('form'))"),false);assert.equal(await evaluate('terrainFixture.calls.length'),0);records.push({FORM_ID:'TerrainApp.submit',ROLE:role,TESTS:'denied/no calls',RESULT:'PASS_LOCAL_BROWSER'})}
 // The component deliberately logs simulated finalization failures; other errors are unexpected.
 const unexpected=consoleErrors.filter(e=>!JSON.stringify(e).includes('TERRAIN_FIXTURE_ERROR')&&!JSON.stringify(e).includes('intervention Terrain'));
 fs.writeFileSync(certification?'docs/stabilization-local/certification/terrain-role-results.json':'docs/stabilization-local/followup/terrain-form-results.json',JSON.stringify({records,exceptions,consoleErrors,unexpected},null,2));assert.deepEqual(exceptions,[]);assert.deepEqual(unexpected,[]);
});
console.log('PASS Terrain form installation/inspection/issue and denied roles');
