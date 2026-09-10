import assert from 'node:assert/strict';
import fs from 'node:fs';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
const records=[];const certification=process.argv.includes("--certification");
const cases=[
 ['OperationsCenter','EDT','form.operations-form','createEdt'],
 ['OperationsCenter','Phase','form.mini-form','createPhase'],
 ['OperationsCenter','Assignment','form.mini-form:nth-of-type(1)','assignUser'],
 ['OperationsCenter','Supports','form.edt-support-import','assignSupportsToEdt'],
 ['OperationsCenter','BT','form.operations-form','createWorkOrderV11'],
 ['OperationsCenter','Request','form.operations-form','createClientRequest'],
 ['PhotoInventoryCenter','Movement','form','createInventoryMovement'],
 ['CampaignVisualManager','Visual','form.v74-form','saveCampaignVisual'],
 ['AutomationAssistant','Automation','form.automation-form','saveAutomationDefinition'],
 ['AutomationAssistant','View','form.view-form','saveCrossModuleView'],
 ['RelationsStudio','Rule','form.relations-rule-builder','saveRelationRule']
];
await offlineBrowser('scripts/fixtures/remaining-form-entry.jsx',async({evaluate,waitFor,sleep,exceptions,consoleErrors})=>{
 await waitFor("typeof mount==='function'");
 const click=async(text)=>{await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes(${JSON.stringify(text)})).click()`);await sleep(80)};
 const runs=certification?[...cases.filter(c=>['OperationsCenter','PhotoInventoryCenter'].includes(c[0])).map(c=>[...c,'Coordonnateur','marketing']),...['Administrateur','Coordonnateur'].flatMap(role=>['marketing','operational_communication'].filter(context=>role!=='Administrateur'||context!=='marketing').map(context=>[...cases.find(c=>c[1]==='Visual'),role,context]))]:cases.map(c=>[...c,'Administrateur','marketing']);
 for(const [module,view,selector,service,role,context]of runs){try{
  await evaluate(`sessionStorage.clear();mount('${module}','${role}','${context}')`);await sleep(150);
  if(['Phase','Assignment','Supports'].includes(view)){await evaluate("document.querySelector('.edt-select').click()");await sleep(100)}
  if(view==='BT')await click('Bons de travail');
  if(view==='Request')await click('Requêtes clients');
  if(view==='Movement')await click('Inventaire');
  if(view==='Visual')await click('Créer un visuel');
  if(view==='Automation')await click('Nouvelle automatisation');
  if(view==='View'){await click('Vues entre');await click('Nouvelle vue')}
  await waitFor(`Boolean(document.querySelector('${selector}'))`);
  await evaluate(`window.activeForm=${view==='Assignment'?"[...document.querySelectorAll('form.mini-form')].find(f=>f.querySelector('select'))":`document.querySelector('${selector}')`};window.formValues=()=>[...activeForm.querySelectorAll('input,textarea,select')].map(n=>[n.type,n.value,n.checked]);window.setFormValue=(n,v)=>{Object.getOwnPropertyDescriptor(n.tagName==='SELECT'?HTMLSelectElement.prototype:n.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(n,v);n.dispatchEvent(new Event(n.tagName==='SELECT'?'change':'input',{bubbles:true}))};window.submitForm=()=>activeForm.querySelector('button:not([type=button])').click()`);
  const initial=await evaluate('formValues()');
  // Inline forms have no close/cancel editor. Their native required fields still
  // need a negative submission case before the successful payload is filled.
  const required=await evaluate("activeForm.querySelectorAll('input[required],textarea[required],select[required]').length");
  for(let i=0;i<required;i++){
   await evaluate(`window.requiredNode=activeForm.querySelectorAll('input[required],textarea[required],select[required]')[${i}];window.requiredValue=requiredNode.value;setFormValue(requiredNode,'')`);await sleep(20);
   await evaluate('submitForm()');assert.equal(await evaluate(`fixture.calls.filter(c=>c.name==='${service}').length`),0,'empty required field cannot write');
   await evaluate('setFormValue(requiredNode,requiredValue)');await sleep(20);
  }
  if(['Visual','Automation','View'].includes(view)){
   await evaluate("submitForm()");assert.equal(await evaluate(`fixture.calls.filter(c=>c.name==='${service}').length`),0,'required fields block empty form');
   await evaluate("[...activeForm.querySelectorAll('button')].find(b=>b.textContent.includes('Annuler')).click()");await sleep(40);assert.equal(await evaluate(`Boolean(document.querySelector('${selector}'))`),false,'cancel closes');
   await click(view==='Visual'?'Créer un visuel':view==='Automation'?'Nouvelle automatisation':'Nouvelle vue');
   await evaluate(`activeForm=document.querySelector('${selector}')`);assert.deepEqual(await evaluate('formValues()'),initial,'reopen clean form');
  }
  // Fill each independently so controlled updates cannot overwrite one another.
  const count=await evaluate("activeForm.querySelectorAll('input:not([type=checkbox]):not([type=radio]),textarea').length");
  for(let i=0;i<count;i++){await evaluate(`(()=>{const n=activeForm.querySelectorAll('input:not([type=checkbox]):not([type=radio]),textarea')[${i}];if(n.readOnly||n.disabled)return;setFormValue(n,n.type==='number'?'1':n.type==='date'?'2026-09-10':n.type==='email'?'fixture@example.test':'LOCAL FORM')})()`);await sleep(10)}
  const selects=await evaluate("activeForm.querySelectorAll('select').length");
  for(let i=0;i<selects;i++){await evaluate(`(()=>{const n=activeForm.querySelectorAll('select')[${i}];if(!n.disabled&&!n.value&&n.options.length>1)setFormValue(n,n.options[1].value)})()`);await sleep(15)}
  if(view==='Rule'){await evaluate("setFormValue(activeForm.querySelectorAll('fieldset select')[3],'support_id')");await sleep(30)}
  assert.equal(await evaluate('activeForm.checkValidity()'),true,'valid local fixture');
  const draft=await evaluate('formValues()');
  await evaluate('fixture.delay=100;fixture.fail=true;submitForm()');
  await waitFor("document.body.textContent.includes('REFRESH_FIXTURE_ERROR')");
  assert.deepEqual(await evaluate('formValues()'),draft,'draft retained after error');
  await evaluate(`fixture.fail=false;window.before=fixture.calls.filter(c=>c.name==='${service}').length;submitForm();submitForm()`);
  await sleep(30);assert.equal(await evaluate("activeForm.querySelector('button:not([type=button])').disabled"),true,'loading disables submit');
  await sleep(300);assert.equal(await evaluate(`fixture.calls.filter(c=>c.name==='${service}').length-before`),1,'single mutation for double click');
  assert.equal(await evaluate("document.body.textContent.includes('REFRESH_FIXTURE_ERROR')"),false,'error cleared after retry');
  if(['EDT','Visual','Automation','View'].includes(view)){
   const editSelector=view==='EDT'?'.edt-actions button':view==='Visual'?'.visual-managed-actions button':view==='Automation'?'.automation-engine-table tbody tr button':'.automation-views-table tbody tr button';
   await evaluate(`[...document.querySelectorAll('${editSelector}')].find(b=>b.textContent.includes('Modifier')).click()`);await sleep(50);
   await evaluate(`activeForm=document.querySelector('${selector}')`);
   assert.ok(await evaluate("[...activeForm.querySelectorAll('input')].some(n=>n.value)"),'edit initial record');
   await evaluate("setFormValue(activeForm.querySelector('input'),'EDIT LOCAL')");await sleep(30);
   // Required dates and mappings belong to the selected record, not the creation fixture.
   await evaluate("[...activeForm.querySelectorAll('input[required]')].filter(n=>!n.value).forEach(n=>setFormValue(n,n.type==='date'?'2026-09-10':'EDIT LOCAL'))");await sleep(30);
   const editSelects=await evaluate("activeForm.querySelectorAll('select[required]').length");
   for(let i=0;i<editSelects;i++){await evaluate(`(()=>{const n=activeForm.querySelectorAll('select[required]')[${i}];if(!n.value)setFormValue(n,n.options[1].value)})()`);await sleep(30)}
   const editService=view==='EDT'?'updateEdt':service;
   await evaluate('fixture.fail=true;submitForm()');await waitFor("document.body.textContent.includes('REFRESH_FIXTURE_ERROR')");assert.equal(await evaluate("activeForm.querySelector('input').value"),'EDIT LOCAL');
   await evaluate(`fixture.fail=false;window.beforeEdit=fixture.calls.filter(c=>c.name==='${editService}').length;submitForm();submitForm()`);await sleep(300);
   assert.equal(await evaluate(`fixture.calls.filter(c=>c.name==='${editService}').length-beforeEdit`),1,'single edit mutation');
   assert.equal(await evaluate(`(()=>{const a=fixture.calls.filter(c=>c.name==='${editService}').at(-1).args;return typeof a[0]==='object'?a[0].id:a[0]})()`),view==='Automation'?'auto-local-1':view==='View'?'view-local-1':1,'correct edit ID');
  }
  records.push({FORM_ID:module+'.'+view,MODULE:module,VIEW:view,ROLE:role,CONTEXT:context,MODE:['EDT','Visual','Automation','View'].includes(view)?'CREATE / EDIT':'CREATE',INITIAL:initial,TESTS:'mount|valid values|save|error|draft retained|retry|loading|double submit'+(['EDT','Visual','Automation','View'].includes(view)?'|edit record|edit error/retry|edit ID':'')+(['Visual','Automation','View'].includes(view)?'|required|cancel/close|reopen clean':''),RESULT:'PASS_LOCAL_BROWSER'});console.log('PASS '+module+' '+view);
 }catch(error){records.push({FORM_ID:module+'.'+view,RESULT:'FAIL',ERROR:error.stack});console.error('FAIL '+module+' '+view+' '+error.message)}}
 fs.writeFileSync(certification?'docs/stabilization-local/certification/form-role-results.json':'docs/stabilization-local/followup/remaining-form-results.json',JSON.stringify({records,exceptions,consoleErrors},null,2));assert.deepEqual(exceptions,[]);assert.deepEqual(consoleErrors,[]);assert.equal(records.filter(r=>r.RESULT==='FAIL').length,0);
});
