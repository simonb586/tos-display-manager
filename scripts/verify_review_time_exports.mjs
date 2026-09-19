import assert from 'node:assert/strict';
import {createProfessionalWorkbook,downloadCSV} from '../src/lib/utils.js';
const rows=[{heure:'2026-09-19T08:15:00.000-04:00',date:'2026-09-19',created_at:'2026-09-19T08:15:00.000-04:00'}];
const columns=['heure','date','created_at'];
const workbook=await createProfessionalWorkbook({moduleName:'Test heure',rows,columns});
assert.equal(workbook.Sheets['Données'].A7.v,'08:15:00');assert.equal(workbook.Sheets['Données'].B7.v,'2026-09-19');assert.equal(workbook.Sheets['Données'].C7.v,rows[0].created_at);
let blob;global.document={createElement:()=>({click(){}})};URL.createObjectURL=value=>{blob=value;return 'blob:fixture';};URL.revokeObjectURL=()=>{};
downloadCSV('time.csv',rows,columns);const csv=await blob.text();assert(csv.includes('"08:15:00"'));assert(csv.includes(rows[0].created_at));
console.log('PASS: actual CSV/XLSX time cells retain HH:MM:SS; date and datetime cells unchanged');
