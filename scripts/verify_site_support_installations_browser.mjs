import assert from 'node:assert/strict';
import fs from 'node:fs';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
const records=[];
await offlineBrowser('scripts/fixtures/site-support-installations-entry.jsx',async browser=>{
 const click=text=>browser.evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`);
 const input=(selector,value)=>browser.evaluate(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 for(const role of ['Administrateur','Client','Client-Admin']){
  await browser.evaluate(`mount('installations',${JSON.stringify(role)})`);await browser.waitFor("document.querySelectorAll('tbody tr').length===10");
  assert(await browser.evaluate("document.body.innerText.includes('Date installation')&&document.body.innerText.includes('Format du visuel')"));
  if(role==='Client')assert.equal(await browser.evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Modifier')"),false);
  records.push({view:'installations',role,result:'PASS'});
 }
 await browser.evaluate("fixture.count=11;window.dispatchEvent(new Event('tos-terrain-data-updated'))");await browser.waitFor("document.querySelectorAll('tbody tr').length===11");records.push({newInstallationRefresh:'PASS'});
 await browser.evaluate("mount('installations','Client',1)");await browser.waitFor("document.querySelectorAll('tbody tr').length===10");
 assert(!await browser.evaluate("document.querySelector('tbody').innerText.includes('S-2-')"));
 await browser.evaluate("mount('themes')");await browser.waitFor("document.querySelectorAll('.campaign-list article').length===2");
 assert.deepEqual(await browser.evaluate("[...document.querySelectorAll('.campaign-list article strong')].map(x=>x.textContent)"),['Thème 2','Thème 10']);
 await input('[aria-label="Rechercher un thème ou une campagne"]','theme 10');await browser.waitFor("document.querySelectorAll('.campaign-list article').length===1");
 assert(!await browser.evaluate("Boolean(document.querySelector('.campaign-history-view'))"));
 await click('Fiche du thème');await browser.waitFor("Boolean(document.querySelector('[role=dialog]'))");records.push({themesSearchOrderAndDetail:'PASS'});
 await browser.evaluate("mount('photos')");await browser.waitFor("!![...document.querySelectorAll('button')].find(b=>b.textContent==='Attribuer un support'&&!b.disabled)");
 await click('Attribuer un support');await browser.waitFor("!!document.querySelector('[aria-label=\"Rechercher un support\"]')");
 await input('[aria-label="Rechercher un support"]','S-2-1');await browser.waitFor("!!document.querySelector('.support-results button')");
 await browser.evaluate("document.querySelector('.support-results button').click()");await click('Enregistrer les choix');await browser.waitFor("fixture.saved?.manual?.support==='S-2-1'");
 await click('Fermer');await click('Supprimer');await browser.waitFor('fixture.deleted && document.querySelectorAll(".review-grid article").length===0');
 records.push({photoSupportAssignmentAndDeletion:'PASS'});
 assert.deepEqual(browser.exceptions,[]);assert.deepEqual(browser.consoleErrors,[]);
});
fs.mkdirSync('docs/site-support-installations',{recursive:true});fs.writeFileSync('docs/site-support-installations/browser.json',JSON.stringify(records,null,2));
console.log('PASS: '+records.length+' browser scenarios');
