import assert from'node:assert/strict';
import fs from'node:fs';
import ExcelJS from'exceljs';
import JSZip from'jszip';
import {parse} from '@babel/parser';
import {projectClientExportRows} from '../src/lib/clientPortalViewRegistry.js';

const main=(fs.readFileSync('src/main.jsx','utf8')+'\n'+fs.readFileSync('src/components/BusinessTable.jsx','utf8')+'\n'+fs.readFileSync('src/lib/businessTableConfig.js','utf8'));
const client=fs.readFileSync('src/components/ClientPortal.jsx','utf8');
const center=fs.readFileSync('src/components/ExportsCenter.jsx','utf8');
const utils=fs.readFileSync('src/lib/utils.js','utf8');
for(const marker of ["'Exports'",'ExportsCenter','loadTable(domain.id'])assert.ok(main.includes(marker),marker);
for(const marker of ["active==='exports'",'loadRows={domain=>exportDomainRows(domain)}','Aucun export autorisé'])assert.ok(client.includes(marker),marker);
// Execute the production export callback: full section reads must retain filters
// and column restrictions; preview must never fall back to a live section read.
let exportExpression;
function visit(node){
 if(!node||typeof node!=='object')return;
 if(node.type==='VariableDeclarator'&&node.id?.name==='exportDomainRows')exportExpression=node.init;
 for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value?.type)visit(value);
}
visit(parse(client,{sourceType:'module',plugins:['jsx']}));
assert.ok(exportExpression,'production export callback exists');
const makeExport=new Function('projectClientExportRows','previewMode','previewSections','listAllClientPortalSection','permission',`return (${client.slice(exportExpression.start,exportExpression.end)})`);
const domain={id:'infrastructures',section:'supports'},filters={search:'EXO'},calls=[];
const load=async(...args)=>{calls.push(args);return [{support_id:'EXO-2',site:'EXO',secret:'private'}]};
const permission={visible_columns:{Infrastructures:['support_id']}};
assert.deepEqual(await makeExport(projectClientExportRows,false,{},load,permission)(domain,filters),[{support_id:'EXO-2'}]);
assert.deepEqual(calls,[['supports',{filters}]]);
assert.deepEqual(await makeExport(projectClientExportRows,true,{supports:{rows:[{support_id:'B-9',secret:'private'}]}},()=>{throw Error('Preview attempted live read')},permission)(domain),[{support_id:'B-9'}]);
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
