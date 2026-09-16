import assert from 'node:assert/strict';
import fs from 'node:fs';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
const results=[];
await offlineBrowser('scripts/fixtures/photo-inventory-mission-entry.jsx',async({evaluate,waitFor,sleep,exceptions,consoleErrors})=>{
 await evaluate('mount()');await waitFor('document.querySelectorAll(".review-grid article").length===12');
 assert.equal(await evaluate('document.querySelectorAll(".review-grid article").length'),12);results.push('48 metadata rows, 12 rendered cards');
 await evaluate('clickText("Examiner / Corriger")');await waitFor('document.querySelector("[role=dialog]")');
 assert.equal(await evaluate('document.querySelector("[data-validation-field=support]").dataset.validationState'),'TO_REVIEW');
 await evaluate(`setInput('input[aria-label="Rechercher un support"]','SUP-A')`);await sleep(100);
 await evaluate('document.querySelector(".support-results button").click()');await waitFor('document.querySelector("[data-validation-field=support]").dataset.validationState==="MANUAL_CONFIRMED"');
 assert.equal(await evaluate('document.querySelector("[data-validation-field=edt]").dataset.validationState'),'AUTO_CONFIRMED');
 assert.equal(await evaluate('document.querySelector("[data-validation-field=visual]").dataset.validationState'),'TO_REVIEW');
 await evaluate('setInput("select[aria-label=Visuel]","70")');await waitFor('document.querySelector("[data-validation-field=visual]").dataset.validationState==="MANUAL_CONFIRMED"');
 await evaluate('clickText("Zoom +");clickText("Rotation")');await sleep(100);
 await evaluate('document.querySelector(".import-photo-pane").scrollIntoView()');await waitFor('document.querySelector(".import-photo-pane img")');
 assert.match(await evaluate('document.querySelector(".import-photo-pane img").style.transform'),/rotate\(90deg\) scale\(1.25\)/);
 await evaluate('clickText("Confirmer la photo")');await waitFor('Boolean(fixture.photos[0].import_finalized_at)');
 results.push('Unidentified original corrected, context recomputed, visual ambiguity resolved, zoom/rotation, manual finalization');
 await evaluate('clickText("Fermer")');await sleep(100);
 await evaluate('[...document.querySelectorAll(".review-grid input[type=checkbox]")].slice(1,3).forEach(e=>e.click())');await waitFor('document.querySelector(".import-batch-decision")');
 await evaluate('setInput(".import-batch-decision label:last-of-type select","70");');await sleep(100);
 await evaluate('clickText("Appliquer à la sélection")');await sleep(100);
 await evaluate('clickText("Confirmer la sélection")');await waitFor('Boolean(fixture.photos[1].import_finalized_at&&fixture.photos[2].import_finalized_at)');
 assert.deepEqual(await evaluate('fixture.photos.slice(1,3).map(p=>p.import_context.recognition.values.support)'),['SUP-A','SUP-B']);results.push('Batch validation retains two distinct supports');
 for(const role of ['Client','Client-Admin','Administrateur']){
  await evaluate(`mount('movements',${JSON.stringify(role)})`);await waitFor('document.body.innerText.includes("EDT-1")');await sleep(100);
  assert.equal(await evaluate('document.body.innerText.includes("Supprimer le mouvement")'),role==='Administrateur');
  assert.equal(await evaluate('document.body.innerText.includes("internal@example.invalid")'),role==='Administrateur');
 }
 await evaluate('clickText("Supprimer le mouvement")');await waitFor('document.querySelector("[role=dialog]")');
 assert.equal(await evaluate('fixture.calls.filter(c=>c.name==="cancelDisplayMovement").length'),0);
 await evaluate('clickText("Confirmer la suppression");clickText("Confirmer la suppression")');await waitFor('fixture.cancelled');
 assert.equal(await evaluate('fixture.calls.filter(c=>c.name==="cancelDisplayMovement").length'),1);results.push('Client roles readonly; Admin explicit confirmation and double-click protection');
 assert.deepEqual(exceptions,[]);assert.deepEqual(consoleErrors,[]);
});
fs.writeFileSync('docs/photo-inventory-mission/browser-tests.json',JSON.stringify({result:'PASS',tests:results,scope:'Actual React components with deterministic service fixtures'},null,2));console.log(results);
