import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {productionBrowser} from './remote_cutover_browser.mjs';
const server=await createServer({server:{host:'127.0.0.1',port:0}});
await server.listen();
process.env.TDM_TEST_PORTAL_ORIGIN=`http://127.0.0.1:${server.httpServer.address().port}/scripts/fixtures/reference-recognition.html`;
try{
 await productionBrowser(null,async browser=>{
  await browser.waitFor('Boolean(window.runRecognition)');
  await browser.evaluate('runRecognition().then(result=>window.recognitionResult=result).catch(error=>window.recognitionError=error.stack);true');
  await browser.waitFor('Boolean(window.recognitionResult||window.recognitionError)',150);
  const error=await browser.evaluate('window.recognitionError');assert(!error,error);
  const result=await browser.evaluate('window.recognitionResult');
  assert(result.photoPoints>20);assert(result.pdfPoints>20);assert.equal(result.pdfPages,1);
  assert(result.matches.some(m=>m.visual_id===1&&m.confirmed));assert.equal(result.ocr.supportId,'3002-7');
  fs.writeFileSync('docs/site-support-installations/reference-browser.json',JSON.stringify({at:new Date().toISOString(),result:'PASS',...result},null,2));
  console.log('PASS: real browser OCR upper-right identifier, photo reference, PDF page and visual matching');
 });
}finally{delete process.env.TDM_TEST_PORTAL_ORIGIN;await server.close();}
