import React from 'react';
import {createRoot} from 'react-dom/client';
import ClientPortal from '../../src/components/ClientPortal';
import {CLIENT_PORTAL_VIEW_REGISTRY} from '../../src/lib/clientPortalViewRegistry';
const root=createRoot(document.getElementById('root'));let id=0;
window.portalFixture={calls:[]};
const result=(client,section)=>({rows:[{id:client,logical_key:'fixture-'+client,support_id:'SUP-'+client,site:client===2?'EXO':'Client B',nom_campagne:section==='campaigns'?'Campaign fixture':undefined}],total:1,page:1,page_size:25});
window.testApi=(file,name,args)=>{
 if(name==='primaryKeyFor')return 'id';
 if(name==='computeEdtProgress')return 0;
 const f=window.portalFixture;f.calls.push({file,name,args});
 if(name==='loadDashboardSummary'||name==='loadPreviewSummary')return Promise.resolve({version:1,identity:{user_id:'test-'+f.client,client_id:f.client,role:f.role,client_name:f.client===2?'EXO':'Client B'},permission:{visible_tables:[f.view.label],visible_columns:{[f.view.label]:['support_id','site']}},sections:{[f.view.section]:{total:1}},kpis:{}});
 if(name==='loadBusinessRows')return Promise.resolve({rows:[{...result(f.client,f.view.section).rows[0],id:f.client,nom_campagne:'SUP-'+f.client,business_context:f.view.id==='communications'?'operational_communication':'marketing'}],total:1});
 if(name==='infrastructureMapUrl')return null;
 if(name==='loadAutomaticFieldRules')return Promise.resolve([]);
 if(name.includes('AssignmentsBySiteAndSupport'))return Promise.resolve({...result(f.client,f.view.section),pageSize:25});
 if(name==='loadOperationsData')return Promise.resolve({edts:[{id:f.client,no_edt:'SUP-'+f.client}],phases:[],phaseReports:[],history:[],workOrders:[],requests:[],assignments:[],users:[],campaigns:[]});
 if(name==='getClientPortalIdentity')return Promise.resolve({id:f.client,client_id:f.client,role:f.role,client_name:f.client===2?'EXO':'Client B'});
 if(name==='getCurrentUserVisibleViews')return Promise.resolve({visible_tables:[f.view.label],visible_columns:{[f.view.label]:['support_id','site']}});
 if(name==='listClientPortalSection')return Promise.resolve(result(f.client,args[0]));
 if(name==='listAllClientPortalSection')return Promise.resolve(result(f.client,args[0]).rows);
 throw Error('Unconfigured portal service '+file+':'+name);
};
window.mount=(viewId,role='Client',client=2,preview=false)=>{
 const view=CLIENT_PORTAL_VIEW_REGISTRY.find(v=>v.id===viewId);window.portalFixture={view,role,client,calls:[]};
 const profile={id:client,client_id:client,role,nom:'Fixture '+role};
 const projection=preview?{target_user:profile,visible_tables:[view.label],visible_columns:{[view.label]:['support_id','site']},sections:{[view.section]:result(client,view.section)}}:null;
 root.render(<ClientPortal key={++id} profile={profile} preview={projection} onLogout={()=>{}} onClose={()=>{}}/>);
};
