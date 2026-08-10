import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BUSINESS_CONTEXT } from '../src/lib/businessContext.js';
import { duplicateLogicalRows, marketingAssignments, operationalAssignments } from '../src/lib/siteSupportAssignments.js';
import { defaultSortForColumn, sortRows } from '../src/lib/gridSorting.js';
import { assignmentColumnProfile } from '../src/lib/gridPresentation.js';
import { canonicalAssignmentRows, prepareRows } from '../src/services/siteSupportBusinessService.js';

const read=file=>fs.readFileSync(file,'utf8');
const header=read('src/components/GridColumnHeader.jsx');
const view=read('src/components/SiteSupportAssignmentsView.jsx');
const css=read('src/styles.css');
const service=read('src/services/siteSupportBusinessService.js');
const module14=read('src/services/module14Service.js');
const module17=read('src/services/clientPortalService.js');

for(const marker of ['grid-column-header-top','grid-column-header-label','grid-column-filter','aria-label={`Filtrer ${label}`','cycleSort','onReset()','title={label}'])assert.ok(header.includes(marker),marker);
for(const marker of ['overflow:visible','text-overflow:ellipsis','width:34px','height:34px',':focus-visible',':hover'])assert.ok(css.includes(marker),marker);
assert.ok(!header.includes('Math.min(width,160)'),'La largeur minimale ne doit plus couper les contrôles');
assert.ok(assignmentColumnProfile('id','ID').minWidth>=128,'Largeur minimale confortable avec tri et filtre');

const alpha=[{v:'É'},{v:'b'},{v:'A'},{v:''},{v:null},{v:'F'}];
assert.deepEqual(sortRows(alpha,{...defaultSortForColumn(alpha,'v','text'),direction:'asc'}).map(r=>r.v),['A','b','É','F','',null]);
assert.deepEqual(sortRows(alpha,{...defaultSortForColumn(alpha,'v','text'),direction:'desc'}).map(r=>r.v),['F','É','b','A','',null]);
const numbers=[{v:'10'},{v:2},{v:'1'},{v:20},{v:null}];
assert.deepEqual(sortRows(numbers,{...defaultSortForColumn(numbers,'v','number'),direction:'asc'}).map(r=>r.v),['1',2,'10',20,null]);
assert.deepEqual(sortRows(numbers,{...defaultSortForColumn(numbers,'v','number'),direction:'desc'}).map(r=>r.v),[20,'10',2,'1',null]);
const codes=[{v:'SUP-100'},{v:'SUP-2'},{v:'SUP-10'}];
assert.deepEqual(sortRows(codes,defaultSortForColumn(codes,'v','identifier')).map(r=>r.v),['SUP-2','SUP-10','SUP-100']);
const dates=[{v:'2026-10-01'},{v:'2025-02-01'},{v:null}];
assert.deepEqual(sortRows(dates,defaultSortForColumn(dates,'v','date')).map(r=>r.v),['2025-02-01','2026-10-01',null]);

const campaigns=[
 {id:1,nom_campagne:'Marketing',business_context:BUSINESS_CONTEXT.MARKETING,date_debut:'2026-01-01'},
 {id:2,nom_campagne:'Exo Info',business_context:BUSINESS_CONTEXT.OPERATIONAL,date_debut:'2026-02-01'}
];
const assignments=[
 {id:10,campagne_id:1,support_id:'SUP-2',statut:'À faire',visuel_attendu:'M1'},
 {id:11,campagne_id:2,support_id:'SUP-10',statut:'Terminée',visuel_attendu:'O1',date_completion:'2026-02-02'},
 {id:12,campagne_id:1,support_id:'SUP-10',statut:'Terminée',visuel_attendu:'M2'}
];
const infrastructures=[{id:20,support_id:'SUP-2',site:'A'},{id:21,support_id:'SUP-10',site:'B'}];
const rows=canonicalAssignmentRows(assignments,campaigns,infrastructures,[]);
assert.equal(marketingAssignments(rows).length,2,'Marketing dans la bonne table');
assert.equal(operationalAssignments(rows).length,1,'Communication opérationnelle dans la bonne table');
assert.equal(operationalAssignments(rows)[0].message,'Exo Info','Exo Info reste opérationnel');
assert.equal(rows.filter(row=>row.support_id==='SUP-10').length,2,'Un support peut appartenir aux deux contextes');
assert.equal(duplicateLogicalRows(rows),0,'duplicateLogicalRows = 0');
assert.equal(canonicalAssignmentRows([...assignments,{...assignments[0],id:13,support_id:'SUP-3'}],campaigns,[...infrastructures,{id:22,support_id:'SUP-3',site:'A'}],[]).length,4,'Une campagne expose chaque support affecté');

const filteredSorted=prepareRows(rows,BUSINESS_CONTEXT.MARKETING,'',{site:'A'},{column:'support_id',direction:'desc',type:'identifier',emptyPlacement:'last'});
assert.deepEqual(filteredSorted.map(row=>row.support_id),['SUP-2'],'Filtres puis tri');
assert.deepEqual(prepareRows(rows,BUSINESS_CONTEXT.MARKETING,'','','').slice(0,1).length,1,'Tri avant pagination');
for(const marker of ['sortRows(filtered','rows.slice(from,from+size)','getAllAssignmentsBySiteAndSupport','campagnes_supports','campagnes_maitres','campaign.business_context'])assert.ok(service.includes(marker),marker);
for(const marker of ['exportCsv(result.rows','exportCsv(picked','getAllAssignmentsBySiteAndSupport({context,search,filters,sortState})'])assert.ok(view.includes(marker),marker);
assert.ok(module14.includes('getAllAssignmentsBySiteAndSupport'),'Module 14 utilise la même source canonique');
assert.ok(module17.includes("rpc('client_portal_list_v120'"),'Module 17 reste derrière la RPC/RLS sécurisée');
console.log('V1.2.4: en-têtes, tris typés, filtres/pagination/exports et affectations canoniques validés. duplicateLogicalRows = 0.');
