import assert from 'node:assert/strict';
import fs from 'node:fs';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
const descriptors=[
 {id:'AdminPanel.submitUser',component:'AdminPanel',form:'.admin-form',service:'saveUser',edit:'tbody tr td:last-child button',success:'Utilisateur enregistré.',roles:['Administrateur']},
 {id:'AdminPanel.submitClient',component:'AdminPanel',tab:'Clients',form:'.admin-form',service:'saveClient',edit:'.client-card button',success:'Client enregistré.',roles:['Administrateur']},
 ...['marketing','operational_communication'].map(context=>({id:'CampaignsPanel.submit',component:'CampaignsPanel',context,open:context==='marketing'?'Créer une campagne':'Créer une communication',form:'.campaigns-form',service:'saveMasterCampaign',edit:'.campaign-list article button',success:'Communication enregistrée.',draft:true,roles:['Administrateur','Coordonnateur']})),
 {id:'WorkOrdersPanel.submit',component:'WorkOrdersPanel',form:'.workorders-form',service:'createWorkOrder',edit:'.workorder-buttons button.icon:not(.danger)',success:'Bon de travail créé.',roles:['Administrateur','Coordonnateur']}
];
const records=[];
await offlineBrowser('scripts/fixtures/refresh-entry.jsx',async({evaluate,waitFor,sleep,exceptions,consoleErrors})=>{
 const click=async label=>{await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(label)});if(!b)throw Error('Missing '+${JSON.stringify(label)});b.click()})()`);await sleep(40)};
 const fill=async(selector,value)=>{await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});const prototype=n.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(n,${JSON.stringify(value)});n.dispatchEvent(new Event(n.tagName==='SELECT'?'change':'input',{bubbles:true}))})()`);await sleep(35)};
 for(const d of descriptors)for(const role of d.roles){
  try{
   await evaluate(`sessionStorage.clear();mount(${JSON.stringify(d.component)},${JSON.stringify(role)},${JSON.stringify(d.context||'marketing')})`);await waitFor('fixture.calls.length>0');await sleep(70);
   if(d.tab)await click(d.tab);if(d.open)await click(d.open);await waitFor(`Boolean(document.querySelector(${JSON.stringify(d.form)}))`);
   const submit=`document.querySelector('${d.form} button:not([type="button"])')`;
   const initial=await evaluate(`document.querySelector('${d.form} input').value`);assert.equal(initial,'','blank create initial value');
   if(d.component!=='WorkOrdersPanel'){
    await evaluate(`${submit}.click()`);await sleep(50);assert.equal(await evaluate(`fixture.calls.filter(c=>c.name==='${d.service}').length`),0,'required fields block submission');
   }
   await fill(`${d.form} input`,'Local Valid');
   if(d.id==='AdminPanel.submitUser'){await fill(`${d.form} input[type=email]`,'invalid');await evaluate(`${submit}.click()`);assert.equal(await evaluate(`fixture.calls.filter(c=>c.name==='${d.service}').length`),0);await fill(`${d.form} input[type=email]`,'local@example.test')}
   if(d.draft){await fill(`${d.form} select[required]`,'2');await evaluate(`mount('${d.component}',${JSON.stringify(role)},'${d.context}')`);await sleep(100);await waitFor(`Boolean(document.querySelector('${d.form}'))`);assert.equal(await evaluate(`document.querySelector('${d.form} input').value`),'Local Valid','draft survives remount');assert.equal(await evaluate(`document.querySelector('${d.form} select[required]').value`),'2','draft restores selected client')}
   await evaluate('fixture.fail=true;fixture.delay=100');await evaluate(`${submit}.click()`);await waitFor("document.body.textContent.includes('REFRESH_FIXTURE_ERROR')");
   assert.equal(await evaluate(`document.querySelector('${d.form} input').value`),'Local Valid','failed draft remains');
   await evaluate(`fixture.fail=false;fixture.holdMutations=true;fixture.pendingMutations=[];window.beforeMutation=fixture.calls.filter(c=>c.name==='${d.service}').length;${submit}.click();${submit}.click()`);await waitFor(`${submit}?.disabled`);
   assert.equal(await evaluate(`${submit}?.disabled`),true,'loading disables submit');
   await evaluate('fixture.holdMutations=false;fixture.pendingMutations.splice(0).forEach(resolve=>resolve())');
   await waitFor(`document.body.textContent.includes(${JSON.stringify(d.success)})`);assert.equal(await evaluate(`fixture.calls.filter(c=>c.name==='${d.service}').length-beforeMutation`),1,'double save must mutate once');
   assert.equal(await evaluate(`document.body.textContent.includes(${JSON.stringify(d.success)})`),true,'visible success after reload');
   if(d.draft){assert.equal(await evaluate(`sessionStorage.getItem('tdm-form-draft:v1:campaign:${d.context}')`),null,'successful save clears draft');await click(d.open);await fill(`${d.form} input`,'Discard');await click('Annuler');await click(d.open);assert.equal(await evaluate(`document.querySelector('${d.form} input').value`),'','cancel clears draft');await click('Annuler')}
   await evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(d.edit)});if(!b)throw Error('Missing edit selector');b.click()})()`);await sleep(50);
   assert.ok(await evaluate(`document.querySelector('${d.form} input').value`),'edit contains selected record');
   await click('Annuler');
   await evaluate(`document.querySelector(${JSON.stringify(d.edit)}).click()`);await sleep(50);await fill(`${d.form} input`,'Edited Local');
   await evaluate('fixture.fail=true');await evaluate(`${submit}.click()`);await waitFor("document.body.textContent.includes('REFRESH_FIXTURE_ERROR')");
   assert.equal(await evaluate(`document.querySelector('${d.form} input').value`),'Edited Local');
   const editService=d.component==='WorkOrdersPanel'?'updateWorkOrder':d.service;
   await evaluate(`fixture.fail=false;window.beforeEditMutation=fixture.calls.filter(c=>c.name==='${editService}').length;${submit}.click();${submit}.click()`);await sleep(350);
   assert.equal(await evaluate(`fixture.calls.filter(c=>c.name==='${editService}').length-beforeEditMutation`),1,'edit double save single mutation');
   assert.equal(await evaluate(`(()=>{const a=fixture.calls.filter(c=>c.name==='${editService}').at(-1).args;return typeof a[0]==='object'?a[0].id:a[0]})()`),1,'edit preserves selected ID');
   records.push({FORM_ID:d.id,MODULE:d.component,VIEW:d.context||d.component,ROLE:role,MODE:'CREATE / EDIT / CANCEL',TESTS:'initial values|required or N/A|invalid email if applicable|create/edit error+retry|state preservation|double save|loading|success|edit ID|cancel/reopen|draft restore/cleanup if applicable',RESULT:'PASS_LOCAL_BROWSER'});console.log('PASS '+d.id+' '+(d.context||'')+' '+role);
  }catch(error){records.push({FORM_ID:d.id,ROLE:role,VIEW:d.context||d.component,RESULT:'FAIL',ERROR:error.stack});console.error('FAIL '+d.id+' '+role+' '+error.message)}
 }
 fs.writeFileSync('docs/stabilization-local/followup/form-closure-results.json',JSON.stringify({records,exceptions,consoleErrors},null,2));assert.deepEqual(exceptions,[]);assert.deepEqual(consoleErrors,[]);assert.equal(records.filter(r=>r.RESULT==='FAIL').length,0);
});
