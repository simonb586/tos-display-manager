import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import {downloadCSV,createProfessionalWorkbook,createProfessionalPdf} from '../src/lib/utils.js';
import {projectClientExportRows} from '../src/lib/clientPortalViewRegistry.js';
const directory='docs/stabilization-local/followup/export-fixtures';
fs.mkdirSync(directory,{recursive:true});
const results=[];
for(const [scope,support] of [['EXO','EXO-2'],['ClientB','B-9']]){
 const rows=projectClientExportRows({id:'infrastructures'},[{support_id:support,site:scope,secret:'FORBIDDEN_SECRET'}],{Infrastructures:['support_id','site']});
 const columns=['support_id','site'];
 let blob;
 const original=URL.createObjectURL,originalRevoke=URL.revokeObjectURL,originalDocument=globalThis.document;
 try{
  URL.createObjectURL=value=>{blob=value;return 'blob:fixture'};URL.revokeObjectURL=()=>{};
  globalThis.document={createElement:()=>({click(){}})};
  downloadCSV('fixture.csv',rows,columns);
 }finally{URL.createObjectURL=original;URL.revokeObjectURL=originalRevoke;if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument}
 const csv=await blob.text();assert.ok(csv.includes(support));assert.ok(!csv.includes('FORBIDDEN_SECRET'));assert.ok(!csv.includes(scope==='EXO'?'B-9':'EXO-2'));
 fs.writeFileSync(`${directory}/${scope}.csv`,csv);
 const workbook=await createProfessionalWorkbook({moduleName:scope,rows,columns});
 const buffer=XLSX.write(workbook,{bookType:'xlsx',type:'buffer'});
 const decoded=XLSX.read(buffer,{type:'buffer'});const cells=XLSX.utils.sheet_to_json(decoded.Sheets['Données'],{header:1});
 assert.deepEqual(cells.at(-1),[support,scope]);assert.deepEqual(cells[5],columns);
 fs.writeFileSync(`${directory}/${scope}.xlsx`,buffer);
 const doc=await createProfessionalPdf({title:scope,moduleName:scope,rows,columns});
 const pdf=Buffer.from(doc.output('arraybuffer'));assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
 assert.ok(pdf.toString('latin1').includes(support));assert.ok(!pdf.toString('latin1').includes('FORBIDDEN_SECRET'));assert.ok(!pdf.toString('latin1').includes(scope==='EXO'?'B-9':'EXO-2'));
 fs.writeFileSync(`${directory}/${scope}.pdf`,pdf);
 results.push({scope,formats:['CSV','XLSX','PDF'],result:'PASS_LOCAL_GENERATION',boundary:'Production formatters and column projection; rows supplied as already scoped fixture. Server scoping remains separate.'});
}
fs.writeFileSync('docs/stabilization-local/followup/export-artifact-results.json',JSON.stringify(results,null,2));
console.log('6 actual CSV/XLSX/PDF artifacts PASS: content, columns and separated client fixtures');
