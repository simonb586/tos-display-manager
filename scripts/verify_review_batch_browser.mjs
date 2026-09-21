import assert from 'node:assert/strict';
import {offlineBrowser} from './lib/offlineBrowser.mjs';
await offlineBrowser('scripts/fixtures/visual-terrain-review-entry.jsx',async b=>{
 await b.evaluate('mount()');await b.waitFor('document.querySelectorAll(".review-grid article").length===12');
 await b.evaluate('document.querySelector(".review-grid input[type=checkbox]").click()');await b.waitFor('document.body.innerText.includes("1 sélectionnée")');
 await b.evaluate('[...document.querySelectorAll(".review-grid input[type=checkbox]")].slice(1,5).forEach(e=>e.click())');await b.waitFor('document.body.innerText.includes("5 sélectionnée")');
 await b.evaluate('fixture.confirm=false;clickText("Supprimer les photos sélectionnées")');assert.equal(await b.evaluate('fixture.photos.length'),20);assert.equal(await b.evaluate('fixture.confirmation'),'Supprimer 5 photos sélectionnées ?');
 await b.evaluate('fixture.confirm=true;clickText("Supprimer les photos sélectionnées");clickText("Supprimer les photos sélectionnées")');await b.waitFor('fixture.photos.length===15');
 assert.deepEqual(await b.evaluate('fixture.photos.map(p=>p.id)'),Array.from({length:15},(_,i)=>i+6));assert.equal(await b.evaluate('fixture.calls.filter(c=>c.name==="deleteReviewPhotos").length'),1);
 await b.evaluate(`document.querySelector('input[aria-label="Tout sélectionner"]').click()`);await b.waitFor('document.body.innerText.includes("15 sélectionnée")');
 await b.evaluate('clickText("Réanalyser la sélection")');await b.waitFor('fixture.calls.some(c=>c.name==="reanalyzeReviewPhotos")');assert.equal(await b.evaluate('fixture.photos.length'),15);
 await b.evaluate('mount("review","Client")');await b.waitFor('document.querySelectorAll(".review-grid article").length===12');assert.equal(await b.evaluate('document.body.innerText.includes("Supprimer les photos sélectionnées")'),false);
 assert.deepEqual(b.exceptions,[]);assert.deepEqual(b.consoleErrors,[]);
});
console.log('PASS: real React review queue, 20 photos, individual/multiple/all selection across pages, confirmation/cancel, delete five, exact survivors, double-click guard, non-destructive reanalysis and Client denial');
