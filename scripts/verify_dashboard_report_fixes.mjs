import assert from'node:assert/strict';import{offlineBrowser}from'./lib/offlineBrowser.mjs';
let passed=0;
await offlineBrowser('scripts/fixtures/dashboard-report-fixes-entry.jsx',async b=>{
 const click=async label=>{await b.evaluate(`Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()===${JSON.stringify(label)}).click()`);await b.sleep(50)};
 const value=label=>b.evaluate(`Array.from(document.querySelectorAll('.executive-kpi')).find(e=>e.querySelector('span').textContent===${JSON.stringify(label)}).querySelector('strong').textContent`);
 await b.evaluate("mount('dashboard')");await b.waitFor("document.body.innerText.includes('12')");
 for(const [label,count] of [['Photos ajoutées','12'],['Infrastructures','2'],['EDT actifs','1'],['Enjeux ouverts','1'],['Campagnes marketing actives','1'],['Communications opérationnelles actives','1']]){assert.equal(await value(label),count,label);passed++}
 await click('Terrain');assert.equal(await value('Photos'),'12');passed++;
 await click('Clients');assert.equal(await value('Clients'),'2');passed++;
 await b.evaluate("mount('dashboard','Administrateur',true)");await b.waitFor("document.body.innerText.includes('Chargement')");assert.equal(await value('Infrastructures'),'Chargement…');passed++;
 await b.evaluate("mount('portal')");await b.waitFor('sectionPending.length===1');assert.ok(await b.evaluate('Boolean(document.querySelector(".client-portal"))'));assert.ok(await b.evaluate('sectionPending.length===1'));passed++;
 assert.equal((await b.evaluate("calls.filter(c=>c.name==='listClientPortalSection')")).length,0);passed++;
 await b.evaluate('sectionPending.splice(0).forEach(r=>r())');await b.waitFor("document.querySelector('.executive-kpi strong').textContent==='12'");passed++;
 await b.evaluate("mount('reports')");await b.waitFor("document.body.innerText.includes('Supprimer')");await click('Supprimer');assert.equal(await b.evaluate("calls.filter(c=>c.name==='deleteEdtReport').length"),0);passed++;
 await b.evaluate('confirmed=true');await click('Supprimer');await b.evaluate("Array.from(document.querySelectorAll('button')).find(e=>e.textContent.includes('Suppression')).click()");assert.equal(await b.evaluate("calls.filter(c=>c.name==='deleteEdtReport').length"),1);passed++;
 await b.evaluate('failDelete=true;finishDelete()');await b.waitFor("document.body.innerText.includes('Impossible de charger ou traiter')");assert.equal(await b.evaluate('deleted'),false);passed++;
 await b.evaluate('failDelete=false');await click('Supprimer');await b.evaluate('finishDelete()');await b.waitFor("!Array.from(document.querySelectorAll('button')).some(e=>e.textContent.trim()==='Supprimer')");passed++;
 for(const role of ['Client','Client-Admin','Installateur']){await b.evaluate(`mount('reports',${JSON.stringify(role)})`);await b.sleep(150);assert.equal(await b.evaluate("Array.from(document.querySelectorAll('button')).some(e=>e.textContent.trim()==='Supprimer')"),false);passed++}
 assert.deepEqual(b.exceptions,[]);assert.deepEqual(b.consoleErrors,[]);
});console.log(passed+' dashboard, progressive startup and report deletion browser checks PASS');
