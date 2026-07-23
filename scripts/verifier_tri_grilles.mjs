import assert from 'node:assert/strict';
import {
  defaultSortForColumn,
  inferColumnSortType,
  parseDateSortValue,
  parseNumericSortValue,
  sortRows
} from '../src/lib/gridSorting.js';

const ids = [{id:'SUP-10'},{id:'SUP-2'},{id:'SUP-1'}];
assert.deepEqual(sortRows(ids,{column:'id',type:'identifier',direction:'asc',emptyPlacement:'last'}).map(x=>x.id),['SUP-1','SUP-2','SUP-10']);
assert.deepEqual(sortRows(ids,{column:'id',type:'identifier',direction:'desc',emptyPlacement:'last'}).map(x=>x.id),['SUP-10','SUP-2','SUP-1']);

const numbers = [{n:'10'},{n:''},{n:'2'},{n:'1'},{n:null}];
assert.deepEqual(sortRows(numbers,{column:'n',type:'number',direction:'asc',emptyPlacement:'last'}).map(x=>x.n),['1','2','10','',null]);
assert.deepEqual(sortRows(numbers,{column:'n',type:'number',direction:'desc',emptyPlacement:'first'}).map(x=>x.n),['',null,'10','2','1']);

const dates = [{date:'10/02/2026'},{date:'2025-01-01'},{date:'02-06-2026'}];
assert.deepEqual(sortRows(dates,{column:'date',type:'date',direction:'asc',emptyPlacement:'last'}).map(x=>x.date),['2025-01-01','10/02/2026','02-06-2026']);
assert.equal(parseNumericSortValue('24,25'),24.25);
assert.equal(parseNumericSortValue('EDT-10'),null);
assert.ok(parseDateSortValue('02-06-2026') < parseDateSortValue('03-06-2026'));
assert.equal(inferColumnSortType(ids,'id'),'identifier');
assert.equal(inferColumnSortType(numbers,'n'),'number');
assert.equal(defaultSortForColumn(dates,'date').direction,'asc');

console.log('OK: 11 vérifications du tri des grilles réussies.');
