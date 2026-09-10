import React from 'react';
import {createRoot} from 'react-dom/client';
import Dashboard from '../../src/components/Module14Dashboard';
import Portal from '../../src/components/ClientPortal';
import {dashboardSummary} from './dashboard-summary';
const root=createRoot(document.getElementById('root')); let serial=0;
window.pending=[];window.calls=[];window.secondary=[];
window.result=dashboardSummary;
window.rpc=(name,...args)=>({abortSignal(signal){
  window.calls.push({name,args});
  return new Promise((resolve,reject)=>window.pending.push({resolve,reject,signal}));
}});
window.testApi=(file,name,args)=>{window.secondary.push({name,args});if(name==='listRecentBusinessActivity')return Promise.resolve([]);throw Error('Unexpected unopened module '+name)};
window.finish=(index=0,value=window.result)=>window.pending[index].resolve({data:value,error:null});
window.fail=index=>window.pending[index].resolve({data:null,error:{message:'Unavailable'}});
window.mount=(scope='admin',remount=true)=>{if(remount)serial++;root.render(<Dashboard key={serial} scopeKey={scope} role="Administrateur" onNavigate={()=>{}}/>)};
window.client=clientId=>{root.render(<Portal key={++serial} profile={{id:clientId,role:'Client',client_id:clientId}}/>)};
window.clientResult=(clientId,total)=>({...dashboardSummary,identity:{user_id:'client-'+clientId,role:'Client',client_id:clientId},permission:{visible_tables:['Infrastructures','Photos']},sections:{supports:{total},photos:{total}},kpis:{}});
