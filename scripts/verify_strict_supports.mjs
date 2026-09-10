import fs from 'node:fs';
import assert from 'node:assert/strict';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
const records=[];
await offlineBrowser('scripts/fixtures/strict-supports-entry.jsx',async({evaluate,waitFor,sleep,exceptions,consoleErrors})=>{
 const change=async(selector,value)=>{await evaluate(`const n=document.querySelector('${selector}');Object.getOwnPropertyDescriptor(n.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLTextAreaElement.prototype,'value').set.call(n,${JSON.stringify(value)});n.dispatchEvent(new Event(n.tagName==='SELECT'?'change':'input',{bubbles:true}))`);await sleep(30)};
 for(const actor of ['Administrateur','Coordonnateur'])for(const phaseId of ['7','8'])for(const generate of [false,true]){
  await evaluate(`mount('OperationsCenter','${actor}')`);await waitFor("!!document.querySelector('.edt-select')");await sleep(60);await evaluate("document.querySelector('.edt-select').click()");await waitFor("!!document.querySelector('.edt-support-import')");await sleep(50);
  const submit="document.querySelector('.edt-support-import button')";
  assert.equal(await evaluate(`${submit}.disabled`),true,'empty support set cannot write');
  await change('.edt-support-import textarea','   ');assert.equal(await evaluate(`${submit}.disabled`),true,'whitespace has no support ID');
  await change('.edt-support-import textarea','SUP-2, SUP-2, MISSING');await change('.edt-support-import select',phaseId);await change('.edt-support-import select:nth-of-type(1)',phaseId);
  if(!generate)await evaluate("document.querySelector('.edt-support-import .edt-checkbox input').click()");await sleep(20);
  await evaluate(`fixture.fail=true;${submit}.click()`);await waitFor("document.body.textContent.includes('SUPPORTS_ERROR')");assert.equal(await evaluate("document.querySelector('.edt-support-import textarea').value"),'SUP-2, SUP-2, MISSING');
  await evaluate(`fixture.fail=false;window.before=fixture.calls.length;const b=${submit};b.click();b.click()`);await sleep(30);assert.equal(await evaluate(`${submit}.disabled`),true);await waitFor("document.body.textContent.includes('Introuvables : MISSING')");
  const calls=await evaluate("fixture.calls.slice(before).filter(c=>c.name==='assignSupportsToEdt')");assert.equal(calls.length,1);assert.equal(calls[0].args[0].edtId,1);assert.equal(calls[0].args[0].phaseId,phaseId);assert.equal(calls[0].args[0].generateWorkOrders,generate);assert.equal(await evaluate("document.querySelector('.edt-support-import textarea').value"),'');
  records.push({FORM_ID:'OperationsCenter.Supports',actor,phaseId,generateWorkOrders:generate,result:'PASS_LOCAL',tests:'open|empty/whitespace validation|ID dedup display|phase and EDT target|error retains input|retry|loading|double click|missing support feedback|cleanup',notApplicable:'Inline create-only form; no close/cancel editor or persistent draft. Real work order creation and support lookup are RPC validation.'});
 }
 fs.writeFileSync('docs/stabilization-local/certification/strict/supports-results.json',JSON.stringify({records,exceptions,consoleErrors},null,2));assert.deepEqual(exceptions,[]);assert.deepEqual(consoleErrors,[]);
});console.log(records.length+' strict EDT support cases PASS');
