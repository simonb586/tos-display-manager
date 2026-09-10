import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {TableView} from '../../src/main.jsx';
import ClientBusinessGrid from '../../src/components/ClientBusinessGrid';
import {BUSINESS_VIEW_REGISTRY} from '../../src/lib/businessViewRegistry';
import {resolveClientPortalView} from '../../src/lib/clientPortalViewRegistry';
window.gridViews=BUSINESS_VIEW_REGISTRY.filter(v=>v.adminComponents.includes('TableView')&&v.clientViewId);
window.strictGrid={files:[],calls:[],failExport:false};
const createURL=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{if(strictGrid.failExport)throw Error('STRICT_EXPORT_ERROR');strictGrid.files.push(blob);return createURL(blob)};HTMLAnchorElement.prototype.click=function(){strictGrid.download=this.download};
window.testApi=(file,name,args)=>{if(name==='loadAutomaticFieldRules')return Promise.resolve({});if(name==='loadSupport360')return Promise.resolve({history:[],issues:[],inspections:[],workOrders:[],edtLinks:[],logs:[]});if(name==='listSupportPhotos')return Promise.resolve([]);throw Error('Unconfigured grid service '+name)};
function Host({surface,definition,role,client}){
 const all=Array.from({length:30},(_,i)=>({support_id:`SUP-${client}-${String(i+1).padStart(2,'0')}`,site:i===0?null:`Site ${31-i}`,statut:i%2?'Actif':'Planifié',description:'Client '+client}));
 const [result,setResult]=useState({rows:all.slice(0,25),total:30,page:1,page_size:25});
 return surface==='admin'?<TableView name={definition.route} dataStore={{[definition.route]:{rows:all}}} rolePermission={{visible_tables:[definition.route],visible_columns:{}}} role={role} onOpenMap={(...args)=>strictGrid.calls.push({name:'map',args})} onRowsUpdated={()=>{}}/>:<ClientBusinessGrid view={resolveClientPortalView(definition.clientViewId)} result={result} scopeKey={`${role}:${client}:${definition.route}`} onLoad={async(page,size)=>{strictGrid.calls.push({name:'load',page,size,client});setResult({rows:all.slice((page-1)*size,page*size),total:30,page,page_size:size})}} onLoadAll={async()=>{strictGrid.calls.push({name:'loadAll',client});return all}}/>
}
const root=createRoot(document.getElementById('root'));let key=0;
window.mount=(surface,index=0,role='Administrateur',client=2)=>{window.strictGrid={files:[],calls:[],failExport:false};root.render(<Host key={++key} surface={surface} definition={gridViews[index]} role={role} client={client}/>)};
