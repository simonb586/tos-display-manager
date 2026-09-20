import assert from 'node:assert/strict';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
await offlineBrowser('scripts/fixtures/campaign-empty-scope-entry.jsx',async b=>{
 for(const role of ['Client','Client-Admin'])for(const context of ['marketing','operational_communication']){
  await b.evaluate(`mount(${JSON.stringify(role)},${JSON.stringify(context)})`);
  await b.waitFor("!!document.querySelector('.campaign-list')");await b.sleep(250);
  assert.equal(await b.evaluate('window.reloadCount'),0,'Empty scoped results must not cause a remount/reload loop');
  assert(await b.evaluate("document.querySelector('.campaign-list')?.textContent.includes('Aucun élément')"));
 }
 assert.deepEqual(b.exceptions,[]);assert.deepEqual(b.consoleErrors,[]);
});
console.log('PASS: empty scoped campaigns render without a reload loop for Client and Client-Admin in both contexts');
