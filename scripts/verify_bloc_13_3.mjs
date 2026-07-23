import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeStoragePath, storagePathFromPhotoRecord } from '../src/lib/photoDeletion.js';
import { adaptiveColumnWidth, defaultSortColumnForTable } from '../src/lib/gridPresentation.js';
import { sortRows } from '../src/lib/gridSorting.js';
import {
  createProfessionalPdf, createProfessionalWorkbook, exportDisplayValue,
  normalizeExportColumns, professionalExportName
} from '../src/lib/utils.js';

assert.equal(normalizeStoragePath(' /support-photos/SUP 1/Photo%20été.jpg '), 'SUP 1/Photo été.jpg');
assert.equal(normalizeStoragePath('SUP-1\\ancienne photo.jpg'), 'SUP-1/ancienne photo.jpg');
assert.equal(storagePathFromPhotoRecord({ storage_path:'support-photos/SUP-2/a b.jpg' }), 'SUP-2/a b.jpg');
assert.equal(
  storagePathFromPhotoRecord({ photo_url:'https://exemple.test/storage/v1/object/public/support-photos/SUP-3/photo%20%C3%A9t%C3%A9.jpg?x=1' }),
  'SUP-3/photo été.jpg'
);

const service = await readFile(new URL('../src/services/photoLibraryService.js', import.meta.url), 'utf8');
for (const required of [
  'ensureStorageLocationIsUnique',
  'storageObjectExists',
  'recordStillExists',
  'verifyPhotoDeletion',
  'remaining.some',
  'verified:true'
]) assert.ok(service.includes(required), `Vérification de suppression manquante : ${required}`);

const verificationIndex = service.indexOf('await verifyPhotoDeletion(photo, location)');
const successIndex = service.indexOf('verified:true', verificationIndex);
assert.ok(verificationIndex >= 0 && successIndex > verificationIndex, 'Le succès doit suivre la vérification finale.');

assert.deepEqual(sortRows([{id:'SUP-10'},{id:'SUP-2'},{id:'SUP-1'}],{column:'id',type:'identifier',direction:'asc',emptyPlacement:'last'}).map(row=>row.id),['SUP-1','SUP-2','SUP-10']);
assert.deepEqual(sortRows([{id:'2'},{id:''},{id:'1'}],{column:'id',type:'identifier',direction:'desc',emptyPlacement:'first'}).map(row=>row.id),['','2','1']);
assert.equal(defaultSortColumnForTable('Infrastructures',['site','support_id']), 'support_id');
assert.equal(defaultSortColumnForTable('Suivi des EDT',['statut','no_edt']), 'no_edt');
assert.equal(adaptiveColumnWidth([{description:'x'.repeat(500)}],'description','Description'),360);
assert.ok(adaptiveColumnWidth([{support_id:'SUP-1'}],'support_id','Numéro du support')<=260);

const assistant = await readFile(new URL('../src/components/AutomationAssistant.jsx', import.meta.url), 'utf8');
assert.ok(assistant.includes('Ce modèle TOS est protégé.'));
assert.ok(assistant.includes('deactivate-template'));
assert.ok(!assistant.includes('{item.isSystemTemplate&&<button className="danger"'));
const automationService = await readFile(new URL('../src/services/automationService.js', import.meta.url), 'utf8');
const viewService = await readFile(new URL('../src/services/crossModuleViewService.js', import.meta.url), 'utf8');
assert.ok(automationService.includes('if (remaining)'));
assert.ok(viewService.includes('if (remaining)'));
const relationService = await readFile(new URL('../src/services/relationService.js', import.meta.url), 'utf8');
assert.ok(relationService.includes('inspectRelationDependencies'));
assert.ok(relationService.includes('Retirez d’abord ces dépendances'));

const exportColumns=normalizeExportColumns(['support_id','description','completed_at','storage_path'],{
  support_id:'Numéro du support',description:'Description',completed_at:'Date de fin',storage_path:'Emplacement interne'
});
assert.deepEqual(exportColumns.map(column=>column.label),['Numéro du support','Description','Date de fin']);
assert.equal(exportDisplayValue(true),'Oui');
assert.equal(exportDisplayValue(false),'Non');
assert.equal(exportDisplayValue({raw:'value'}),'Information disponible dans la fiche détaillée');
assert.equal(professionalExportName('Historique des campagnes','xlsx',new Date('2026-07-23T12:00:00Z')),'TOS_Historique_des_campagnes_2026-07-23.xlsx');
const workbook=createProfessionalWorkbook({moduleName:'Infrastructures',rows:[{support_id:'SUP-2',description:'Été'}],columns:['support_id','description'],labels:{support_id:'Numéro du support',description:'Description'},filters:{description:'Été'},sortState:{column:'support_id',direction:'asc'}});
assert.deepEqual(workbook.SheetNames,['Données','Informations sur l’export']);
assert.ok(workbook.Sheets.Données['!autofilter']);
assert.ok(workbook.Sheets.Données['!freeze']);
assert.equal(workbook.Sheets.Données.A6.v,'Numéro du support');
const pdf=createProfessionalPdf({title:'Rapport',moduleName:'Infrastructures',rows:[{support_id:'SUP-1'}],columns:['support_id'],labels:{support_id:'Numéro du support'}});
assert.equal(pdf.getNumberOfPages(),1);

console.log('Bloc 13.3 — Lots A-E : 34 contrôles réussis.');
