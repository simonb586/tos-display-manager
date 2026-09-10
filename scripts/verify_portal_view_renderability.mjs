import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CLIENT_PORTAL_VIEW_REGISTRY} from '../src/lib/clientPortalViewRegistry.js';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
const records=[];
await offlineBrowser('scripts/fixtures/portal-parity-entry.jsx',async({evaluate,sleep,waitFor,exceptions,consoleErrors})=>{
 for(const view of CLIENT_PORTAL_VIEW_REGISTRY)for(const [role,client,preview]of [['Client',2,false],['Client-Admin',2,false],['Client',9,false],['Client',2,true]]){
  await evaluate(`mount('${view.id}','${role}',${client},${preview})`);await sleep(70);
  await evaluate(`[...document.querySelectorAll('aside button')].find(b=>b.textContent===${JSON.stringify(view.label)}).click()`);await sleep(40);
  await waitFor(view.id==='requests'?"Boolean(document.querySelector('.client-request-form'))":"Boolean(document.querySelector('.client-business-grid, .client-grid'))||Boolean(document.querySelector('table'))");
  assert.equal(await evaluate("document.querySelector('main').textContent.includes('SUP-'+portalFixture.client)"),true,'scoped row rendered');
  assert.equal(await evaluate(`document.querySelector('main').textContent.includes('SUP-${client===2?9:2}')`),false,'other fixture scope absent');
  assert.equal(await evaluate("portalFixture.calls.every(c=>['getClientPortalIdentity','getCurrentUserVisibleViews','listClientPortalSection','listAllClientPortalSection'].includes(c.name))"),true,'no unscoped Admin reader');
  if(preview)assert.equal(await evaluate('portalFixture.calls.length'),0,'preview uses scoped payload without client or admin fetching');
  records.push({viewId:view.id,role,client,preview,RESULT:'PASS_LOCAL_BROWSER',TESTS:'permission navigation|real portal render|scoped row|other client absent|no Admin loader'});
 }
 fs.writeFileSync('docs/stabilization-local/followup/portal-renderability-results.json',JSON.stringify({records,exceptions,consoleErrors},null,2));assert.deepEqual(exceptions,[]);assert.deepEqual(consoleErrors,[]);
});
console.log('PASS 60 supported portal view/role/scope render contracts');
