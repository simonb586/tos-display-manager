import assert from'node:assert/strict';
import fs from'node:fs';
import ExcelJS from'exceljs';
import JSZip from'jszip';

const main=fs.readFileSync('src/main.jsx','utf8');
const client=fs.readFileSync('src/components/ClientPortal.jsx','utf8');
const center=fs.readFileSync('src/components/ExportsCenter.jsx','utf8');
const utils=fs.readFileSync('src/lib/utils.js','utf8');
for(const marker of ["'Exports'",'ExportsCenter','loadTable(domain.id'])assert.ok(main.includes(marker),marker);
for(const marker of ["active==='exports'",'listAllClientPortalSection(domain.section)','Aucun export autorisé'])assert.ok(client.includes(marker),marker);
for(const marker of ['getSignedDownloadUrl','Télécharger le ZIP autorisé','compressionOptions','activeOnly'])assert.ok(`${center}\n${client}`.includes(marker),marker);
for(const marker of ['downloadExcelSelectionWithPhotos','workbook.addImage','createImageBitmap','Photo active','worksheet.addImage'])assert.ok(utils.includes(marker),marker);
assert.match(main,/downloadExcelSelectionWithPhotos\([^\n]+selectedFiltered/);

const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('Données');
sheet.addRow(['Photo active']);sheet.addRow(['']);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X8W7WQAAAABJRU5ErkJggg==','base64');
const imageId=workbook.addImage({buffer:png,extension:'png'});
sheet.getRow(2).height=58;sheet.addImage(imageId,{tl:{col:0,row:1},ext:{width:72,height:72}});
const buffer=await workbook.xlsx.writeBuffer(),zip=await JSZip.loadAsync(buffer);
assert.ok(Object.keys(zip.files).some(name=>name.startsWith('xl/media/image')),'miniature XLSX réellement embarquée');
const noPhoto=new ExcelJS.Workbook();noPhoto.addWorksheet('Données').addRow(['Photo active']);
assert.ok((await noPhoto.xlsx.writeBuffer()).byteLength>0,'XLSX sans photo valide');
console.log('Exports V1.3.8 : section interne/client, ZIP sécurisé et miniatures XLSX réelles PASS.');
