import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CLIENT_PORTAL_VIEW_REGISTRY} from '../src/lib/clientPortalViewRegistry.js';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
const records=[];
await offlineBrowser('scripts/fixtures/portal-parity-entry.jsx',async({evaluate,sleep,waitFor,exceptions,consoleErrors})=>{
 for(const view of CLIENT_PORTAL_VIEW_REGISTRY)for(const [role,client,preview]of [['Client',2,false],['Client-Admin',2,false],['Client',9,false],['Client',2,true]]){
  console.log('CHECK',view.id,role,client,preview);
  await evaluate(`mount('${view.id}','${role}',${client},${preview})`);await sleep(70);
  await evaluate(`[...document.querySelectorAll('aside button')].find(b=>b.textContent===${JSON.stringify(view.label)}).click()`);await sleep(40);
  try{await waitFor(view.id==='requests'?"Boolean(document.querySelector('.client-request-form'))":"Boolean(document.querySelector('.client-business-grid, .client-grid, .campaign-list, .edt-list'))||Boolean(document.querySelector('table'))");}catch(error){console.error(exceptions,consoleErrors);throw error;}
  assert.equal(await evaluate("document.querySelector('main').textContent.includes('SUP-'+portalFixture.client)"),true,'scoped row rendered');
  assert.equal(await evaluate(`document.querySelector('main').textContent.includes('SUP-${client===2?9:2}')`),false,'other fixture scope absent');
  assert.equal(await evaluate("portalFixture.calls.every(c=>['loadDashboardSummary','loadPreviewSummary','loadBusinessRows','loadOperationsData','getMarketingAssignmentsBySiteAndSupport','getOperationalCommunicationAssignmentsBySiteAndSupport','infrastructureMapUrl','getClientPortalIdentity','getCurrentUserVisibleViews','listClientPortalSection','listAllClientPortalSection'].includes(c.name))"),true,'only canonical scoped readers');
  if(preview)assert.equal(await evaluate(`portalFixture.calls.filter(c=>c.name==='loadBusinessRows').every(c=>c.args[1]?.targetUserId===${client})&&portalFixture.calls.filter(c=>c.name==='loadOperationsData'||c.name==='loadPreviewSummary').every(c=>c.args[0]===${client})`),true,'preview readers carry the explicit target profile');
  records.push({viewId:view.id,role,client,preview,RESULT:'PASS_LOCAL_BROWSER',TESTS:'permission navigation|real portal render|scoped row|other client absent|no Admin loader'});
 }
 fs.writeFileSync('docs/stabilization-local/followup/portal-renderability-results.json',JSON.stringify({records,exceptions,consoleErrors},null,2));assert.deepEqual(exceptions,[]);assert.deepEqual(consoleErrors,[]);
},{realServices:['roleVisibilityService.js']});
console.log(`PASS ${records.length} supported portal view/role/scope render contracts`);
