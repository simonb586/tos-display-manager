import assert from 'node:assert/strict';
import fs from 'node:fs';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
const records=[];
await offlineBrowser('scripts/fixtures/certification-reports-entry.jsx',async({evaluate,waitFor,sleep,exceptions,consoleErrors})=>{
 const click=async(label,scope='document')=>{await evaluate(`[...${scope}.querySelectorAll('button')].find(b=>b.textContent.trim()==='${label}').click()`);await sleep(40)};
 for(const role of ['Administrateur','Coordonnateur'])for(const action of ['draft','generate','send','resend','final-send','final-resend']){try{
  const final=action.startsWith('final'),sending=['send','resend'].includes(action);
  await evaluate(`mount('${final?'final':'module15'}','${role}',${sending},${action==='resend'})`);await sleep(120);
  let button,service;
  if(final){await evaluate("const s=document.querySelector('select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'17');s.dispatchEvent(new Event('change',{bubbles:true}))");await sleep(40);button=action==='final-send'?'Clôturer et envoyer':'Renvoyer';service=action==='final-send'?'closeEdtAndSendFinalReport':'resendFinalCommunication'}
  else if(sending){await click(action==='resend'?'Renvoyer':'Envoyer');await waitFor("!!document.querySelector('[role=dialog] textarea')");button='Envoyer';service='requestEdtEmail';
   await evaluate("window.input=document.querySelector('[role=dialog] textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'invalid');input.dispatchEvent(new Event('input',{bubbles:true}))");await sleep(40);assert.equal(await evaluate("document.querySelector('[role=dialog] .primary').disabled"),true);
   await evaluate("Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'fixture@example.invalid');input.dispatchEvent(new Event('input',{bubbles:true}))");await sleep(40);
  }else{await click('Modifier');await waitFor("!!document.querySelector('.report-editor input')");assert.equal(await evaluate("document.querySelector('.report-editor input').value"),'Rapport EDT EDT-LOCAL-17');
   await evaluate("const input=document.querySelector('.report-editor input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Edited local');input.dispatchEvent(new Event('input',{bubbles:true}))");await sleep(40);
   if(action==='generate'){await click('Prévisualiser');await click('Retour à la modification');await click('Prévisualiser')}
   button=action==='draft'?'Enregistrer le brouillon':'Générer le PDF';service=action==='draft'?'saveEdtReportDraft':'generateEdtReport';
  }
  const selector=`[...document.querySelectorAll('${final?'button':'[role=dialog] button'}')].find(b=>b.textContent.trim()==='${button}')`;
  await evaluate(`reportFixture.fail=true;${selector}.click()`);await waitFor("document.body.textContent.includes('REPORT_FIXTURE_ERROR')");
  if(!final&&!sending)assert.equal(await evaluate("document.body.textContent.includes('Edited local')||document.querySelector('.report-editor input')?.value==='Edited local'"),true);
  await evaluate(`reportFixture.fail=false;window.before=reportFixture.calls.length;const b=${selector};b.click();b.click()`);await sleep(350);
  assert.equal(await evaluate(`reportFixture.calls.slice(before).filter(c=>c.name==='${service}').length`),1,'one mutation');
  assert.equal(await evaluate(`reportFixture.calls.filter(c=>c.name==='${service}').every(c=>${final?(action==='final-send'?'c.args[0].edt.id===17':'c.args[0].id===41'):sending?'c.args[0]===17&&c.args[2].reportId===31':'c.args[0].id===17&&c.args[1].title===\'Edited local\''})`),true,'correct business target');
  if(!final)assert.equal(await evaluate("!!document.querySelector('[role=dialog]')"),false);
  records.push({role,action,result:'PASS_LOCAL',tests:'open|initial|validation where applicable|error|preserved draft|retry|double click|correct target|success'});console.log('PASS reports '+role+' '+action);
 }catch(error){records.push({role,action,result:'FAIL',error:error.message});console.error('FAIL reports '+role+' '+action+' '+error.message)}}
 for(const role of ['Client','Client-Admin','Installateur']){await evaluate(`mount('module15','${role}',false)`);await sleep(100);await click('Ouvrir');assert.equal(await evaluate("!!document.querySelector('[role=dialog]')"),false,'read-only role must not open a writable report editor');records.push({role,action:'denied-editor',result:'PASS_LOCAL'})}
 fs.writeFileSync('docs/stabilization-local/certification/reports-results.json',JSON.stringify({records,exceptions,consoleErrors},null,2));assert.deepEqual(exceptions,[]);assert.deepEqual(consoleErrors,[]);assert.equal(records.filter(r=>r.result==='FAIL').length,0);
});
