import fs from 'node:fs';
import path from 'node:path';
import {parse} from '@babel/parser';
const root=process.cwd(),out='docs/stabilization-local';
const roles=['Administrateur','Coordonnateur','Installateur','Client-Admin','Client'];
const sources=new Map(),controls=[],routes=new Set();
const relative=p=>path.relative(root,p).replaceAll('\\','/');
function resolve(from,spec){if(!spec.startsWith('.'))return null;const p=path.resolve(path.dirname(from),spec);return [p,p+'.js',p+'.jsx',p+'.mjs',path.join(p,'index.js')].find(f=>fs.existsSync(f)&&fs.statSync(f).isFile()&&/\.(jsx?|mjs)$/.test(f))}
function walk(node,fn,parents=[]){if(!node||typeof node!=='object')return;if(node.type)fn(node,parents);for(const [key,val]of Object.entries(node)){if(['loc','start','end','comments','tokens'].includes(key))continue;if(Array.isArray(val))val.forEach(x=>walk(x,fn,[...parents,node]));else if(val?.type)walk(val,fn,[...parents,node])}}
function load(file){if(sources.has(file))return;const text=fs.readFileSync(file,'utf8'),ast=parse(text,{sourceType:'module',plugins:['jsx']}),imports=[];sources.set(file,{text,ast,imports});walk(ast,n=>{const spec=n.type==='ImportDeclaration'?n.source.value:n.type==='CallExpression'&&n.callee.type==='Import'?n.arguments[0]?.value:null;if(spec){const resolved=resolve(file,spec);if(resolved)imports.push(resolved)}});imports.forEach(load)}
load(path.resolve('src/main.jsx'));
const componentRoots={Administrateur:'src/main.jsx',Coordonnateur:'src/main.jsx',Installateur:'src/components/InstallerTerrainShell.jsx','Client-Admin':'src/components/ClientPortal.jsx',Client:'src/components/ClientPortal.jsx'};
function closure(file,set=new Set()){if(set.has(file))return set;set.add(file);sources.get(file)?.imports.forEach(p=>closure(p,set));return set}
const scopes=Object.fromEntries(roles.map(role=>[role,closure(path.resolve(componentRoots[role]))]));
for(const [file,{text,ast,imports}]of sources){const slice=n=>text.slice(n.start,n.end);walk(ast,(n,parents)=>{
 if(n.type==='BinaryExpression'&&n.operator==='==='&&n.left.name==='active'&&n.right.type==='StringLiteral')routes.add(n.right.value);
 if(n.type!=='JSXElement')return;const opening=n.openingElement,tag=opening.name.name||slice(opening.name),attrs=opening.attributes.filter(a=>a.type==='JSXAttribute'),events=attrs.filter(a=>/^on[A-Z]/.test(a.name.name));
 if(!['button','input','select','textarea','a','summary','form'].includes(tag)&&!events.length)return;
 const form=parents.slice().reverse().find(p=>p.type==='JSXElement'&&p.openingElement.name.name==='form');
 const attribute=name=>attrs.find(a=>a.name.name===name);const fn=parents.slice().reverse().find(p=>/Function/.test(p.type));
 const implicit=tag==='button'&&attribute('type')?.value?.value!=='button'&&form;
 const handlers=events.map(a=>a.name.name+'='+slice(a.value));
 if(implicit&&!events.length){const submit=form.openingElement.attributes.find(a=>a.name?.name==='onSubmit');if(submit)handlers.push('form.onSubmit='+slice(submit.value))}
 const link=attribute('href');if(link)handlers.push('href='+slice(link.value));
 const staticDisabled=attrs.some(a=>a.name.name==='disabled'&&(!a.value||a.value.expression?.value===true));
 const missing=tag==='button'&&!handlers.length&&!staticDisabled&&!opening.attributes.some(a=>a.type==='JSXSpreadAttribute');
 const label=n.children.filter(c=>c.type==='JSXText').map(c=>c.value.trim()).filter(Boolean).join(' ')||attribute('aria-label')?.value?.value||attribute('title')?.value?.value||slice(opening).slice(0,160);
 controls.push({CONTROL_ID:`${relative(file)}:${n.loc.start.line}:${n.loc.start.column}`,SOURCE:relative(file),LINE:n.loc.start.line,MODULE:path.basename(file),VIEW:'UNRESOLVED_DYNAMIC_CONTEXT',SUB_VIEW:fn?.id?.name||'inline',CONTROL:tag,LABEL:label,ROLE_CANDIDATES:roles.filter(r=>scopes[r].has(file)).join('|'),VISIBLE:'UNVERIFIED',AUTHORIZED:'UNVERIFIED',EXPECTED_ACTION:'REQUIRES_FUNCTIONAL_CONTRACT',HANDLER:handlers.join(' | ')||'NONE_STATIC',SERVICE_CANDIDATES:imports.filter(p=>p.includes(path.sep+'services'+path.sep)).map(relative).join('|'),RPC_API_EDGE:'UNRESOLVED',TABLES:'UNRESOLVED',RLS:'REMOTE_VALIDATION_REQUIRED',EXISTING_TEST:'NOT_MAPPED',ADDED_TEST:'NOT_MAPPED',RESULT:staticDisabled?'DISABLED_STATIC':missing?'REVIEW_MISSING_HANDLER':'NOT_FUNCTIONALLY_TESTED',FIX:'',REMOTE_VALIDATION_REQUIRED:'Server proof required; local UI tests still required'});
 })}
const fields=Object.keys(controls[0]),csv=rows=>[fields.join(','),...rows.map(r=>fields.map(k=>'"'+String(r[k]??'').replaceAll('"','""')+'"').join(','))].join('\n');
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(`${out}/controls.csv`,csv(controls));fs.writeFileSync(`${out}/refresh-controls.csv`,csv(controls.filter(c=>/Actualiser|Refresh|reload|refresh/i.test(c.LABEL+' '+c.HANDLER))));
const summary={scope:'Reachable source from src/main.jsx; syntax sites, not runtime row instances. Role candidates are import reachability, NOT authorization. Shared main includes other shells.',files:sources.size,controls:controls.length,adminRoutes:[...routes].sort(),refreshCandidates:controls.filter(c=>/Actualiser|Refresh|reload|refresh/i.test(c.LABEL+' '+c.HANDLER)).length,missingHandlerCandidates:controls.filter(c=>c.RESULT==='REVIEW_MISSING_HANDLER'),byRole:Object.fromEntries(roles.map(r=>[r,{candidateControls:controls.filter(c=>c.ROLE_CANDIDATES.split('|').includes(r)).length,authorizedViews:'UNPROVEN',fullyContractTested:0,PASS:0,FAIL:'UNDETERMINED',REMOTE_VALIDATION_REQUIRED:'Not enumerable without role/state/endpoint mapping'}]))};
fs.writeFileSync(`${out}/inventory.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify({files:summary.files,controls:summary.controls,refreshCandidates:summary.refreshCandidates,missingHandlerCandidates:summary.missingHandlerCandidates.length}));
