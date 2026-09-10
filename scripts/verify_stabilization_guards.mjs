import fs from 'node:fs';
import assert from 'node:assert/strict';
import {parse} from '@babel/parser';
import {CLIENT_PORTAL_VIEW_REGISTRY as registry,resolveClientPortalView,resolveClientPortalViews,clientPortalColumnsForView,projectClientExportRows} from '../src/lib/clientPortalViewRegistry.js';
await import('./audit_stabilization_controls.mjs');
const inventory=JSON.parse(fs.readFileSync('docs/stabilization-local/inventory.json','utf8'));
assert.deepEqual(inventory.missingHandlerCandidates,[],'Visible native buttons need a handler or form submit contract');
assert.equal(new Set(registry.map(v=>v.id)).size,registry.length);
for(const v of registry){for(const key of [v.id,...v.permissionKeys,...v.aliases])assert.equal(resolveClientPortalView(key)?.id,v.id);assert.equal(resolveClientPortalViews([v.label]).views.length,1)}
assert.deepEqual(resolveClientPortalViews([]).views,[]);
assert.equal(resolveClientPortalViews(['DOES NOT EXIST']).unknown.length,1);
const view=resolveClientPortalView('Infrastructures'),rows=[{support_id:'A',site:'EXO',secret:'hidden'}];
assert.deepEqual(clientPortalColumnsForView(view,Object.keys(rows[0]),{Infrastructures:['support_id']}),['support_id']);
assert.deepEqual(projectClientExportRows(view,rows,{Infrastructures:['support_id']}),[{support_id:'A'}]);
assert.deepEqual(clientPortalColumnsForView(view,['support_id','site'],{Infrastructures:['support_id','site'],infrastructures:['site']}),['site']);
assert.deepEqual(clientPortalColumnsForView(view,['support_id','site'],{Infrastructures:[]}),['support_id','site']);
// Execute the actual Descendre callback with a captured draft, not a mirrored implementation.
const source=fs.readFileSync('src/components/field-catalog/FieldCatalogImportExportTab.jsx','utf8');
const ast=parse(source,{sourceType:'module',plugins:['jsx']});let expression;
function walk(n){if(!n||typeof n!=='object')return;if(n.type==='JSXOpeningElement'&&n.attributes?.some(a=>a.name?.name==='aria-label'&&a.value?.value==='Descendre'))expression=n.attributes.find(a=>a.name?.name==='onClick')?.value.expression;for(const v of Object.values(n))if(Array.isArray(v))v.forEach(walk);else if(v?.type)walk(v)}walk(ast);assert.ok(expression);
let saved;new Function('list','i','s','key',`return (${source.slice(expression.start,expression.end)})()`)(['A','B','C'],0,{patch:(key,value)=>{saved={key,value}}},'importAliases');assert.deepEqual(saved,{key:'importAliases',value:['B','A','C']});
console.log('Dead-button AST guard, 15 registry views, column/export restrictions and alias reorder PASS. Static guards do not prove all control behavior.');
