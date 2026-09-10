import fs from 'node:fs';
import assert from 'node:assert/strict';
import {parse} from '@babel/parser';
import {resolveClientPortalView} from '../src/lib/clientPortalViewRegistry.js';
import {BUSINESS_VIEW_REGISTRY,knownBusinessRoute,clientBusinessContract} from '../src/lib/businessViewRegistry.js';
const source=fs.readFileSync('src/main.jsx','utf8');
const ast=parse(source,{sourceType:'module',plugins:['jsx']});
const declarations=new Map(),routes=new Map();
function walk(node,fn){if(!node||typeof node!=='object')return;fn(node);for(const v of Object.values(node))if(Array.isArray(v))v.forEach(n=>walk(n,fn));else if(v?.type)walk(v,fn)}
walk(ast,n=>{if(n.type==='VariableDeclarator'&&n.id.type==='Identifier')declarations.set(n.id.name,n.init)});
const expression=name=>{const n=declarations.get(name);assert.ok(n,name);return source.slice(n.start,n.end)};
const manifest=JSON.parse(fs.readFileSync('src/data/manifest.json','utf8'));
const evaluate=new Function('role','manifest','rolePermission','canSeeTable','knownBusinessRoute',`const adminItems=${expression('adminItems')};const visibleManifestTables=${expression('visibleManifestTables')};return ${expression('items')}`);
const navigation=[...new Set(evaluate('Administrateur',manifest,{},()=>true,knownBusinessRoute))];
assert.deepEqual(navigation,BUSINESS_VIEW_REGISTRY.map(view=>view.route),'Every Admin route requires a canonical contract');
for(const view of BUSINESS_VIEW_REGISTRY){assert.deepEqual(clientBusinessContract(view.route)?.id||null,view.clientViewId);assert.ok(['scoped_projection','internal_only','not_implemented'].includes(view.clientPolicy));}
walk(ast,n=>{
 if(n.type!=='IfStatement')return;
 const names=[];walk(n.test,t=>{if(t.type==='BinaryExpression'&&t.operator==='==='&&t.left.name==='active'&&t.right.type==='StringLiteral')names.push(t.right.value)});
 if(!names.length)return;
 const components=[];walk(n.consequent,t=>{if(t.type==='AssignmentExpression'&&t.left.name==='content')walk(t.right,j=>{if(j.type==='JSXOpeningElement'&&/^[A-Z]/.test(j.name.name||''))components.push(j.name.name)})});
 for(const name of names)routes.set(name,[...new Set(components)]);
});
const inventory=navigation.map(name=>({name,route:name,components:routes.get(name)||['TableView'],clientView:resolveClientPortalView(name)?.id||null,clientComponent:resolveClientPortalView(name)?.component||null,source:'src/main.jsx navigation expressions evaluated for Administrateur; manifest included',status:'INVENTORIED_NOT_RENDER_CERTIFIED'}));
const path='docs/stabilization-local/followup/admin-view-registry.json';
const definition={navigationCount:navigation.length,views:inventory,contextRoutes:[...routes.keys()].filter(name=>!navigation.includes(name))};
if(process.argv.includes('--register'))fs.writeFileSync(path,JSON.stringify(definition,null,2));
else assert.deepEqual(definition,JSON.parse(fs.readFileSync(path,'utf8')),'Admin navigation changed: register and certify the new/changed view explicitly');
console.log(`${navigation.length} actual Admin navigation views inventoried; registry completeness guard PASS (not functional certification)`);
