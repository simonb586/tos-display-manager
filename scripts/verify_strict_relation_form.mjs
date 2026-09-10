import fs from 'node:fs';
import assert from 'node:assert/strict';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
const records=[];
await offlineBrowser('scripts/fixtures/field-form-entry.jsx',async({evaluate,waitFor,sleep,exceptions,consoleErrors})=>{
 const click=async(label)=>{await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='${label}').click()`);await sleep(30)};
 const change=async(selector,value)=>{await evaluate(`const n=document.querySelector('${selector}');Object.getOwnPropertyDescriptor(n.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(n,'${value}');n.dispatchEvent(new Event(n.tagName==='SELECT'?'change':'input',{bubbles:true}))`);await sleep(30)};
 for(const mode of ['relations','calculations','both','partial-success']){
  await evaluate("mount('Relations')");await sleep(80);
  if(mode!=='calculations'){
   await change('fieldset label:nth-of-type(3) input','infrastructures');await change('fieldset label:nth-of-type(4) input','missing_field');
   assert.equal(await evaluate("document.querySelector('button[type=submit]').disabled"),true,'unknown target blocks save');
   await change('fieldset label:nth-of-type(3) input','');await change('fieldset label:nth-of-type(4) input','');await change('fieldset select','many-to-many');
  }
  if(mode!=='relations'){await click('Calculs');await change('fieldset input','infrastructures.notes');assert.equal(await evaluate("document.querySelector('button[type=submit]').disabled"),true,'cycle blocks save');await change('fieldset input','');await change('fieldset label:last-of-type select','preserve')}
  const save="document.querySelector('button[type=submit]')";assert.equal(await evaluate(`${save}.disabled`),false);
  if(mode==='partial-success'){
   await evaluate(`window.remoteTimestamp='2026-09-08T00:00:00Z';window.failCalculation=true;window.testApi=async(file,name,args)=>{fieldFixture.calls.push({file,name,args});await new Promise(r=>setTimeout(r,120));if(args[0].expectedUpdatedAt!==remoteTimestamp)throw Error('LOCAL_STALE_VERSION');if(name==='saveCalculationDraft'&&failCalculation)throw Error('CALCULATION_ERROR');if(name==='saveRelationDraft')remoteTimestamp='2026-09-08T01:00:00Z';return {changed:true,updatedAt:remoteTimestamp}};${save}.click()`);
   await waitFor("document.body.textContent.includes('CALCULATION_ERROR')");assert.equal(await evaluate("fieldFixture.calls.filter(c=>c.name==='saveRelationDraft').length"),1);
   await evaluate(`failCalculation=false;const b=${save};b.click();b.click()`);await waitFor("fieldFixture.saved===1||document.body.textContent.includes('LOCAL_STALE_VERSION')");assert.equal(await evaluate('fieldFixture.saved'),1,'retry after relation persisted must use its new timestamp');assert.equal(await evaluate("fieldFixture.calls.filter(c=>c.name==='saveRelationDraft').length"),1,'do not resave a relation already persisted');
  }else{
   await evaluate(`fieldFixture.fail=true;${save}.click()`);await waitFor("document.body.textContent.includes('FIELD_FIXTURE_ERROR')");assert.equal(await evaluate(`${save}.disabled`),false);
   await evaluate(`fieldFixture.fail=false;window.before=fieldFixture.calls.length;const b=${save};b.click();b.click()`);await sleep(20);assert.equal(await evaluate(`${save}.disabled`),true);await waitFor('fieldFixture.saved===1');
   const calls=await evaluate('fieldFixture.calls.slice(before)');assert.deepEqual(calls.map(c=>c.name),mode==='both'?['saveRelationDraft','saveCalculationDraft']:[mode==='relations'?'saveRelationDraft':'saveCalculationDraft']);assert.ok(calls.every(c=>c.args[0].field.fieldId==='infrastructures.notes'));
  }
  records.push({FORM_ID:'FieldCatalogRelations',role:'Administrateur',mode,result:'PASS_LOCAL',tests:'dirty|validation|failure keeps draft|retry|loading|single write per changed part|timestamp chain|ID'});
 }
 fs.writeFileSync('docs/stabilization-local/certification/strict/relation-form-results.json',JSON.stringify({records,exceptions,consoleErrors},null,2));assert.deepEqual(exceptions,[]);assert.deepEqual(consoleErrors,[]);
});console.log(records.length+' strict relation/calculation cases PASS');
