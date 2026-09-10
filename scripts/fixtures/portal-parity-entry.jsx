import React from 'react';
import {createRoot} from 'react-dom/client';
import ClientPortal from '../../src/components/ClientPortal';
import {CLIENT_PORTAL_VIEW_REGISTRY} from '../../src/lib/clientPortalViewRegistry';
const root=createRoot(document.getElementById('root'));let id=0;
window.portalFixture={calls:[]};
const result=(client,section)=>({rows:[{support_id:'SUP-'+client,site:client===2?'EXO':'Client B',nom_campagne:section==='campaigns'?'Campaign fixture':undefined}],total:1,page:1,page_size:25});
window.testApi=(file,name,args)=>{
 const f=window.portalFixture;f.calls.push({file,name,args});
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
