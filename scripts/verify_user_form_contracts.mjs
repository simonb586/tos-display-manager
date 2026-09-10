import assert from 'node:assert/strict';
import fs from 'node:fs';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
const cases=[];
await offlineBrowser('scripts/fixtures/refresh-entry.jsx',async({evaluate,waitFor,sleep,exceptions})=>{
 const click=label=>evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(label)});if(!b)throw Error('Missing '+${JSON.stringify(label)});b.click()})()`);
 const fill=async(selector,value)=>{await evaluate(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}))})()`);await sleep(30)};
 await evaluate("mount('UserProvisioningPanel')");await waitFor("document.body.textContent.includes('fixture@example.test')");
 await click('Créer et inviter');await sleep(60);assert.equal(await evaluate("fixture.calls.filter(c=>c.name==='inviteRealUser').length"),0);cases.push('required fields block empty create');
 await fill('.admin-form input','Local Fixture');await fill('.admin-form input[type=email]','local@example.test');
 await evaluate('fixture.fail=true;fixture.delay=80');await click('Créer et inviter');await waitFor("document.body.textContent.includes('REFRESH_FIXTURE_ERROR')");
 assert.equal(await evaluate("document.querySelector('.admin-form input[type=email]').value"),'local@example.test');cases.push('create failure preserves form');
 await evaluate("fixture.fail=false;window.beforeSave=fixture.calls.filter(c=>c.name==='inviteRealUser').length;document.querySelector('.admin-form button[type=submit]').click();document.querySelector('.admin-form button[type=submit]').click()");await waitFor("document.body.textContent.includes('MUTATION_SUCCESS')");await sleep(160);
 assert.equal(await evaluate("fixture.calls.filter(c=>c.name==='inviteRealUser').length-beforeSave"),1);assert.equal(await evaluate("document.querySelector('.admin-form input[type=email]').value"),'');cases.push('create double click single mutation; success visible; form reset');
 await click('Modifier');await waitFor("Boolean(document.querySelector('.user-edit-modal'))");await fill('.user-edit-modal input','Changed Name');
 await evaluate("document.querySelector('.user-edit-close').click()");assert.equal(await evaluate("fixture.calls.filter(c=>c.name==='updateManagedUser').length"),0);await sleep(30);assert.equal(await evaluate("Boolean(document.querySelector('.user-edit-modal'))"),false);cases.push('edit close discards without saving');
 await click('Modifier');await fill('.user-edit-modal input','Saved Name');await evaluate('fixture.fail=true');await click('Enregistrer');await waitFor("document.body.textContent.includes('REFRESH_FIXTURE_ERROR')");
 assert.equal(await evaluate("document.querySelector('.user-edit-modal input').value"),'Saved Name');cases.push('edit failure keeps draft and modal');
 await evaluate("fixture.fail=false;fixture.holdMutations=true;window.beforeEdit=fixture.calls.filter(c=>c.name==='updateManagedUser').length;const save=document.querySelector('.user-edit-modal form>button:last-child');save.click();save.click()");await sleep(30);
 assert.equal(await evaluate("document.querySelector('.user-edit-close').disabled"),true,'saving edit cannot be closed to open an unrelated draft');
 await evaluate('fixture.holdMutations=false;fixture.pendingMutations.splice(0).forEach(finish=>finish())');
 await waitFor("!document.querySelector('.user-edit-modal')");await sleep(250);
 assert.equal(await evaluate("fixture.calls.filter(c=>c.name==='updateManagedUser').length-beforeEdit"),1);assert.equal(await evaluate("fixture.calls.filter(c=>c.name==='updateManagedUser').at(-1).args[1].nom"),'Saved Name');assert.equal(await evaluate("document.body.textContent.includes('Utilisateur modifié.')"),true);cases.push('edit retry single mutation; correct payload; success closes modal');
 await evaluate('fixture.delay=80');
 for(const [label,action] of [['Renvoyer','resend_invite'],['Désactiver','deactivate'],['Mot de passe','reset_password'],['Supprimer l’utilisateur','delete']]){
  await evaluate('window.confirm=()=>true');const before=await evaluate("fixture.calls.filter(c=>c.name==='manageUser').length");await click(label);await sleep(200);
  assert.equal(await evaluate("fixture.calls.filter(c=>c.name==='manageUser').length"),before+1);assert.equal(await evaluate("fixture.calls.filter(c=>c.name==='manageUser').at(-1).args[0]"),action);cases.push('action '+action+' uses selected user');
 }
 for(const role of ['Coordonnateur','Installateur','Client','Client-Admin']){
  await evaluate(`mount('UserProvisioningPanel',${JSON.stringify(role)})`);await waitFor("document.body.textContent.includes('Accès réservé')");assert.equal(await evaluate('fixture.calls.length'),0);cases.push(role+' denied without service call');
 }
 await evaluate("mount('ClientsAccessAdmin')");await waitFor("Boolean(document.querySelector('.ca-table tbody tr'))");await click('Ajouter un client');await fill('.ca-form input','Client local');
 await evaluate("fixture.delay=100;const save=document.querySelector('.ca-form button:last-child');save.click();save.click()");await waitFor("!document.querySelector('.ca-form')");await sleep(250);
 assert.equal(await evaluate("fixture.calls.filter(c=>c.name==='createClient').length"),1,'double client create must mutate once');cases.push('client create double click single mutation');
 await click('Voir les accès');await waitFor("document.body.textContent.includes('Modifier le rôle')");
 await evaluate("const b=[...document.querySelectorAll('button')].find(x=>x.textContent==='Modifier le rôle');b.click();b.click()");await sleep(400);
 assert.equal(await evaluate("fixture.calls.filter(c=>c.name==='changeClientUserRole').length"),1);assert.deepEqual(await evaluate("fixture.calls.find(c=>c.name==='changeClientUserRole').args[0]"),{userId:1,role:'Client-Admin'});cases.push('client member role double click single scoped payload');
 await evaluate('window.confirm=()=>false');await click('Détacher');await sleep(40);assert.equal(await evaluate("fixture.calls.filter(c=>c.name==='unlinkUserFromClient').length"),0);cases.push('detach cancellation makes no mutation');
 await evaluate('window.confirm=()=>true');await click('Détacher');await sleep(400);assert.equal(await evaluate("fixture.calls.filter(c=>c.name==='unlinkUserFromClient').length"),1);cases.push('detach confirms selected user only');
 await fill('form.ca-invite input','Invited Local');await fill('form.ca-invite input[type=email]','invite@example.test');
 await evaluate("const b=document.querySelector('form.ca-invite button');b.click();b.click()");await sleep(400);assert.equal(await evaluate("fixture.calls.filter(c=>c.name==='inviteClientUser').length"),1);assert.equal(await evaluate("fixture.calls.find(c=>c.name==='inviteClientUser').args[0].client_id"),2);cases.push('client invitation double click stays on selected client');
 for(const role of ['Installateur','Client','Client-Admin']){
  await evaluate(`mount('ClientsAccessAdmin',${JSON.stringify(role)})`);await waitFor("document.body.textContent.includes('Accès réservé')");await sleep(50);assert.equal(await evaluate('fixture.calls.length'),0,'denied client administration must not load service');cases.push(role+' denied client management without read');
 }
 assert.deepEqual(exceptions,[]);fs.writeFileSync('docs/stabilization-local/followup/user-form-results.json',JSON.stringify({cases,result:'PASS_LOCAL_BROWSER',exceptions},null,2));
});
console.log(`${cases.length} user form/action contracts PASS`);
