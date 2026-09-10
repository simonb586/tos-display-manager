import assert from 'node:assert/strict';
import fs from 'node:fs';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
const records=[];
await offlineBrowser('scripts/fixtures/remaining-form-entry.jsx',async({evaluate,waitFor,sleep,exceptions,consoleErrors})=>{
 const descriptors=[
 ['AdminPanel','toggleUserStatus','tbody tr td:last-child button:last-child',false],
 ['WorkOrdersPanel','updateWorkOrder','.workorder-buttons button',false],
 ['WorkOrdersPanel','deleteWorkOrder','.workorder-buttons button.danger',true],
 ['CampaignsPanel','deleteOrArchiveMasterCampaign','.campaign-list button.danger',true],
 ['CampaignVisualManager','deleteOrArchiveCampaignVisual','.visual-managed-actions button.danger',true],
 ['RoleVisibilityAdmin','saveRoleVisibility','button.v07-primary',false],
 ['AutomationAssistant','approveAutomationDefinition','.automation-engine-table tbody tr details button:last-child',true]
 ];
 for(const [module,service,selector,confirm]of descriptors){try{
  await evaluate(`mount('${module}')`);await sleep(120);
  await evaluate(`(()=>{const original=window.testApi;window.testApi=(file,name,args)=>{if(name!=='${service}')return original(file,name,args);const f=fixture,fail=f.fail;f.calls.push({file,name,args});return new Promise((resolve,reject)=>setTimeout(()=>fail?reject(Error('ROW_FIXTURE_ERROR')):resolve(name==='saveRoleVisibility'?args[0]:{action:'archived'}),80))}})()`);
  await waitFor(`Boolean(document.querySelector('${selector}'))`);
  if(confirm){await evaluate(`window.confirm=()=>false;document.querySelector('${selector}').click()`);assert.equal(await evaluate(`fixture.calls.filter(c=>c.name==='${service}').length`),0,'cancel means no mutation')}
  await evaluate(`window.confirm=()=>true;fixture.fail=true;document.querySelector('${selector}').click()`);await waitFor("document.body.textContent.includes('ROW_FIXTURE_ERROR')");
  await evaluate(`fixture.fail=false;window.beforeRow=fixture.calls.filter(c=>c.name==='${service}').length;const b=document.querySelector('${selector}');b.click();b.click()`);await sleep(250);
  assert.equal(await evaluate(`fixture.calls.filter(c=>c.name==='${service}').length-beforeRow`),1,'single row mutation');
  const identity=await evaluate(`(()=>{const a=fixture.calls.filter(c=>c.name==='${service}').at(-1).args[0];return typeof a==='object'?a.id||a.role:a})()`);
  assert.equal(identity,service==='saveRoleVisibility'?'Administrateur':service==='approveAutomationDefinition'?'auto-local-1':1,'selected record identity');
  records.push({ROLE:'Administrateur',VIEW:module,CONTROL:service,STATE:'cancel/error/retry/double click',HANDLER:service,SERVICE:service,EXPECTED:'single mutation, intended ID, visible failure and retry',TEST:'verify_row_mutation_contracts.mjs',RESULT:'PASS_LOCAL_BROWSER'});console.log('PASS row '+service);
 }catch(error){records.push({VIEW:module,CONTROL:service,RESULT:'FAIL',ERROR:error.stack});console.error('FAIL row '+service+' '+error.message)}}
 fs.writeFileSync('docs/stabilization-local/followup/row-mutation-results.json',JSON.stringify({records,exceptions,consoleErrors},null,2));assert.deepEqual(exceptions,[]);assert.deepEqual(consoleErrors,[]);assert.equal(records.filter(r=>r.RESULT==='FAIL').length,0);
});
