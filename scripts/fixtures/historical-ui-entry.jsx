import React from 'react';
import {createRoot} from 'react-dom/client';
import Dashboard from '../../src/components/Module14Dashboard';
import Assignments from '../../src/components/SiteSupportAssignmentsView';
window.calls=[];window.routes=[];
const marketing={id:1,business_context:'marketing',statut:'Actif',nom_campagne:'EXO marketing'};
const operational={id:2,business_context:'operational_communication',statut:'Actif',nom_campagne:'EXO communication'};
window.testApi=(file,name,args)=>{
 if(name==='marketingRows'||name==='uniqueMarketingAssignments')return (args[0]||[]).filter(r=>r.business_context==='marketing');
 if(name==='operationalRows'||name==='uniqueOperationalAssignments')return (args[0]||[]).filter(r=>r.business_context==='operational_communication');
 window.calls.push({name,args});
 if(name==='loadModule14Data')return Promise.resolve({campaigns:[marketing,operational],visuals:[],assignments:[],contextAvailable:true});
 if(name==='loadModule14OperationalKpis')return Promise.resolve(Object.fromEntries(['terrain','reports','reportsSent','reportsToSend','reportsErrors'].map((k,i)=>[k,{status:'available',value:i+2}])));
 if(name==='listRecentBusinessActivity')return Promise.resolve([]);
 if(name.includes('AssignmentsBySiteAndSupport')){const q=args[0]||{};return Promise.resolve({rows:[{...marketing,logical_key:'fixture-1',support_id:'EXO-2',no_edt:'EDT-1',campaign_id:1,visual_id:34}],total:60,page:q.page||1,pageSize:q.pageSize||25})}
 throw Error('Missing fixture '+file+':'+name);
};
const root=createRoot(document.getElementById('root'));let key=0;
window.mount=(kind='dashboard',context='marketing',role='Administrateur')=>{window.routes=[];window.calls=[];root.render(kind==='client-dashboard'?<Dashboard key={++key} role={role} onNavigate={target=>window.routes.push(target)} clientProjection={{identity:{client_name:context},views:[{id:'infrastructures',section:'supports',label:'Infrastructures'}],sections:{supports:{total:7}}}}/>:kind==='dashboard'?<Dashboard key={++key} role={role} dataStore={{Infrastructures:{rows:[{support_id:'EXO-2'}]}}} onNavigate={target=>window.routes.push(target)}/>:<Assignments key={++key} context={context} role={role} onNavigate={target=>window.routes.push(target)}/>)};
