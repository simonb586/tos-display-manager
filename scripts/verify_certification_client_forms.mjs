import assert from 'node:assert/strict';
import fs from 'node:fs';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
const records=[];
await offlineBrowser('scripts/fixtures/refresh-entry.jsx',async({evaluate,waitFor,sleep,exceptions})=>{
 const click=async(label)=>{await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='${label}').click()`);await sleep(40)};
 const fill=async(selector,value)=>{await evaluate(`const n=document.querySelector('${selector}');Object.getOwnPropertyDescriptor(n.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(n,${JSON.stringify(value)});n.dispatchEvent(new Event(n.tagName==='SELECT'?'change':'input',{bubbles:true}))`);await sleep(30)};
 for(const mode of ['create','edit']){
  await evaluate("mount('ClientsAccessAdmin')");await waitFor("document.body.textContent.includes('EXO INITIAL')");await click(mode==='create'?'Ajouter un client':'Modifier');await waitFor("!!document.querySelector('.ca-form')");
  assert.equal(await evaluate("document.querySelector('.ca-form input').value"),mode==='create'?'':'EXO INITIAL');
  await fill('.ca-form input','');await click('Enregistrer');assert.equal(await evaluate("fixture.calls.filter(c=>['createClient','updateClient'].includes(c.name)).length"),0);
  await fill('.ca-form input','Discard');await evaluate("document.querySelector('.ca-form .ca-close').click()");await sleep(30);await click(mode==='create'?'Ajouter un client':'Modifier');assert.equal(await evaluate("document.querySelector('.ca-form input').value"),mode==='create'?'':'EXO INITIAL');
  await fill('.ca-form input','Edited Client');await evaluate('fixture.fail=true;fixture.delay=200');await click('Enregistrer');await waitFor("document.body.textContent.includes('REFRESH_FIXTURE_ERROR')");assert.equal(await evaluate("document.querySelector('.ca-form input').value"),'Edited Client');
  await evaluate("fixture.fail=false;window.before=fixture.calls.length;const b=document.querySelector('.ca-form button:last-child');b.click();b.click()");await sleep(30);assert.equal(await evaluate("document.querySelector('.ca-form .ca-close').disabled"),true);await waitFor("!document.querySelector('.ca-form')");await waitFor("document.body.textContent.includes('Client enregistré')");
  const service=mode==='create'?'createClient':'updateClient';assert.equal(await evaluate(`fixture.calls.slice(before).filter(c=>c.name==='${service}').length`),1);if(mode==='edit')assert.equal(await evaluate("fixture.calls.find(c=>c.name==='updateClient').args[0]"),2);
  records.push({FORM_ID:'ClientsAccessAdmin.ClientForm',role:'Administrateur',mode,result:'PASS_LOCAL',tests:'initial|required|cancel|close|reopen|error|draft|retry|loading|single mutation|correct ID|success'});
 }
 for(const role of ['Administrateur','Coordonnateur'])for(const requestedRole of ['Client','Client-Admin']){
  await evaluate(`mount('ClientsAccessAdmin','${role}')`);await waitFor("document.body.textContent.includes('EXO INITIAL')");await click('Voir les accès');await waitFor("!!document.querySelector('.ca-invite input[type=email]')");
  assert.equal(await evaluate("document.querySelector('form.ca-invite input').value"),'');await click('Inviter');assert.equal(await evaluate("fixture.calls.filter(c=>c.name==='inviteClientUser').length"),0);
  await fill('form.ca-invite input','Local');await fill('form.ca-invite input[type=email]','bad');await click('Inviter');assert.equal(await evaluate("fixture.calls.filter(c=>c.name==='inviteClientUser').length"),0);
  await fill('form.ca-invite input[type=email]','local@example.invalid');await fill('form.ca-invite select',requestedRole);await evaluate('fixture.fail=true;fixture.delay=200');await click('Inviter');await waitFor("document.body.textContent.includes('REFRESH_FIXTURE_ERROR')");assert.equal(await evaluate("document.querySelector('form.ca-invite input[type=email]').value"),'local@example.invalid');
  await evaluate("fixture.fail=false;window.before=fixture.calls.length;const b=document.querySelector('form.ca-invite button');b.click();b.click()");await sleep(30);assert.equal(await evaluate("document.querySelector('form.ca-invite button').disabled"),true,'invitation loading is visible');
  await waitFor(`document.body.textContent.includes('Invitation ${requestedRole} envoyée.')`);assert.equal(await evaluate("fixture.calls.slice(before).filter(c=>c.name==='inviteClientUser').length"),1);assert.deepEqual(await evaluate("(()=>{const a=fixture.calls.filter(c=>c.name==='inviteClientUser').at(-1).args;return [a[0].client_id,a[1].role]})()"),[2,requestedRole]);
  await evaluate("document.querySelector('.ca-dialog > .ca-close').click()");await sleep(30);await click('Voir les accès');await waitFor("!!document.querySelector('form.ca-invite')");assert.equal(await evaluate("document.querySelector('form.ca-invite input').value"),'');
  records.push({FORM_ID:'ClientsAccessAdmin.InviteForm',role,requestedRole,mode:'create invitation',result:'PASS_LOCAL',tests:'open|initial|required|invalid email|error|draft retained|retry|loading|single scoped mutation|success|close|reopen clean'});
 }
 fs.writeFileSync('docs/stabilization-local/certification/client-form-results.json',JSON.stringify({records,exceptions},null,2));assert.deepEqual(exceptions,[]);
});console.log(records.length+' client form contracts PASS');
