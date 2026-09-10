import fs from 'node:fs';
import assert from 'node:assert/strict';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
const records=[];
await offlineBrowser('scripts/fixtures/strict-users-entry.jsx',async({evaluate,waitFor,sleep,exceptions,consoleErrors})=>{
 const change=async(selector,value)=>{await evaluate(`const n=document.querySelector('${selector}');Object.getOwnPropertyDescriptor(n.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(n,${JSON.stringify(value)});n.dispatchEvent(new Event(n.tagName==='SELECT'?'change':'input',{bubbles:true}))`);await sleep(25)};
 const button=text=>`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)})`;
 for(const module of ['AdminPanel','UserProvisioningPanel'])for(const targetRole of ['Administrateur','Coordonnateur','Installateur','Client','Client-Admin'])for(const mode of ['create','edit']){
  const initialRole=mode==='edit'?(targetRole==='Installateur'?'Client':'Installateur'):targetRole;
  await evaluate(`mount('${module}','Administrateur','${initialRole}')`);await waitFor("document.body.textContent.includes('fixture@example.test')");await sleep(40);
  if(mode==='edit'){await evaluate(`${module==='AdminPanel'?"document.querySelector('tbody tr td:last-child button')":button('Modifier')}.click()`);await sleep(35)}
  const form=module==='UserProvisioningPanel'&&mode==='edit'?'.user-edit-modal form':'.admin-form';
  assert.equal(await evaluate(`document.querySelector('${form} input').value`),mode==='create'?'':'Fixture INITIAL');
  const submit=`document.querySelector('${form} button:not([type=button])')`;
  const service=module==='AdminPanel'?'saveUser':mode==='create'?'inviteRealUser':'updateManagedUser';
  if(mode==='create'){
   await evaluate(`${submit}.click()`);assert.equal(await evaluate(`fixture.calls.filter(c=>c.name==='${service}').length`),0);
   await change(`${form} input`,'Fixture strict');await change(`${form} input[type=email]`,'invalid');await evaluate(`${submit}.click()`);assert.equal(await evaluate(`fixture.calls.filter(c=>c.name==='${service}').length`),0);
   await change(`${form} input[type=email]`,'strict@example.invalid');
  }
  await change(`${form} select`,targetRole);
  if(module==='AdminPanel')await change(`${form} label:nth-child(5) select`,'2');
  if(module==='UserProvisioningPanel'&&mode==='create')await change(`${form} input[type=number]`,'2');
  if(module==='UserProvisioningPanel'&&mode==='edit'){assert.equal(await evaluate(`!!document.querySelector('${form} input[type=email]')`),false,'email editing is not offered');assert.equal(await evaluate(`!!document.querySelector('${form} input[type=number]')`),false,'client assignment belongs to ClientsAccessAdmin');}
  await change(`${form} input`,'Saved strict');await evaluate('fixture.fail=true;fixture.delay=250');await evaluate(`${submit}.click()`);await waitFor("document.body.textContent.includes('REFRESH_FIXTURE_ERROR')");assert.equal(await evaluate(`document.querySelector('${form} input').value`),'Saved strict');assert.equal(await evaluate(`document.querySelector('${form} select').value`),targetRole);
  await evaluate(`fixture.fail=false;window.before=fixture.calls.length;const b=${submit};b.click();b.click()`);await sleep(25);assert.equal(await evaluate(`${submit}.disabled`),true);await waitFor("document.body.textContent.includes('enregistré')||document.body.textContent.includes('MUTATION_SUCCESS')||document.body.textContent.includes('Utilisateur modifié.')");await sleep(300);
  const calls=await evaluate(`fixture.calls.slice(before).filter(c=>c.name==='${service}')`);assert.equal(calls.length,1);const payload=module==='UserProvisioningPanel'&&mode==='edit'?calls[0].args[1]:calls[0].args[0];assert.equal(payload.role,targetRole);assert.equal(payload.nom,'Saved strict');if(mode==='edit')assert.equal(calls[0].args[0].id,1);
  if(mode==='edit'){
   await evaluate(`${module==='AdminPanel'?"document.querySelector('tbody tr td:last-child button')":button('Modifier')}.click()`);await sleep(40);await change(`${form} input`,'Discard strict');await evaluate(`${module==='AdminPanel'?button('Annuler'):"document.querySelector('.user-edit-close')"}.click()`);await sleep(30);
   await evaluate(`${module==='AdminPanel'?"document.querySelector('tbody tr td:last-child button')":button('Modifier')}.click()`);await sleep(30);assert.equal(await evaluate(`document.querySelector('${form} input').value`),'Fixture INITIAL');
  }
  records.push({case:`${module}.${mode}.${targetRole}`,actor:'Administrateur',targetRole,mode,service,result:'PASS_LOCAL',tests:'initial|required/email where editable|role/client payload|error|values retained|retry|loading|double click|correct ID|success|cancel/reopen on edit'});
 }
 for(const [action,label,inactive] of [['resend_invite','Renvoyer',false],['deactivate','Désactiver',false],['reactivate','Réactiver',true],['delete','Supprimer l’utilisateur',false]]){
  await evaluate(`mount('UserProvisioningPanel','Administrateur','Installateur',${inactive})`);await waitFor("document.body.textContent.includes('fixture@example.test')");await sleep(30);
  if(['deactivate','delete'].includes(action)){await evaluate(`window.confirm=()=>false;${button(label)}.click()`);assert.equal(await evaluate("fixture.calls.filter(c=>c.name==='manageUser').length"),0)}
  await evaluate(`window.confirm=()=>true;fixture.fail=true;fixture.delay=200;${button(label)}.click()`);await waitFor("document.body.textContent.includes('REFRESH_FIXTURE_ERROR')");
  await evaluate(`fixture.fail=false;window.before=fixture.calls.length;const b=${button(label)};b.click();b.click()`);await waitFor("document.body.textContent.includes('MUTATION_SUCCESS')");await sleep(250);const calls=await evaluate("fixture.calls.slice(before).filter(c=>c.name==='manageUser')");assert.equal(calls.length,1);assert.equal(calls[0].args[0],action);assert.equal(calls[0].args[1].id,1);
  records.push({case:'UserProvisioningPanel.action.'+action,actor:'Administrateur',state:inactive?'inactive':'active',service:'manageUser',result:'PASS_LOCAL',tests:'confirmation when offered|error|retry|double click|action and ID'});
 }
 for(const inactive of [false,true]){await evaluate(`mount('AdminPanel','Administrateur','Installateur',${inactive})`);await waitFor("document.body.textContent.includes('fixture@example.test')");await sleep(30);const b="document.querySelector('tbody tr td:last-child button:nth-child(2)')";await evaluate(`fixture.fail=true;${b}.click()`);await waitFor("document.body.textContent.includes('REFRESH_FIXTURE_ERROR')");await evaluate(`fixture.fail=false;fixture.delay=200;window.before=fixture.calls.length;const b=${b};b.click();b.click()`);await sleep(450);const calls=await evaluate("fixture.calls.slice(before).filter(c=>c.name==='toggleUserStatus')");assert.equal(calls.length,1);assert.equal(calls[0].args[0].id,1);assert.equal(calls[0].args[0].statut,inactive?'Désactivé':'Actif');records.push({case:'AdminPanel.toggle.'+inactive,actor:'Administrateur',result:'PASS_LOCAL',tests:'both initial states|error|retry|double click|ID'})}
 fs.writeFileSync('docs/stabilization-local/certification/strict/users-results.json',JSON.stringify({records,exceptions,consoleErrors},null,2));assert.deepEqual(exceptions,[]);assert.deepEqual(consoleErrors,[]);
});console.log(records.length+' strict user contracts PASS');
