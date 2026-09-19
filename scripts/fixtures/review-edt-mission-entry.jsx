import './photo-inventory-mission-entry.jsx';
import React from 'react';
import {createRoot} from 'react-dom/client';
import CampaignHistoryView from '../../src/components/CampaignHistoryView';
const original=window.testApi;
window.catalogMode='normal';
window.testApi=(file,name,args)=>{
 if(name==='loadCampaignHistory')return Promise.resolve([
  {id:1,client_id:2,business_context:'marketing',context_status:'Confirmé',campagne:'Campagne 2',visuel:'Visuel A',no_edt:'EDT-TOS-09',support_id:'S1',site:'Site A',date_installation:'2026-09-01'},
  {id:2,client_id:2,business_context:'marketing',context_status:'Confirmé',campagne:'Campagne 2',visuel:'Visuel A',no_edt:'EDT-TOS-09',support_id:'S1',site:'Site A',date_installation:'2026-09-01'},
  {id:3,client_id:2,business_context:'marketing',context_status:'Confirmé',campagne:'Campagne 2',visuel:'Visuel A',no_edt:'EDT-TOS-09',support_id:'S2',site:'Site B',date_installation:'2026-09-01'},
  {id:4,client_id:2,business_context:'operational_communication',context_status:'Confirmé',campagne:'Communication 1',visuel:'Visuel B',no_edt:'EDT-TOS-22-A',support_id:'S3',site:'Site C',date_installation:'2026-09-01'}
 ]);
 if(name==='loadPhotoImportCatalog'&&window.catalogMode==='slow')return new Promise(resolve=>{window.releaseCatalog=()=>original(file,name,args).then(resolve);});
 if(name==='loadPhotoImportCatalog'&&window.catalogMode==='error')return Promise.reject(Error('Catalogue test indisponible'));
 return original(file,name,args);
};
const node=document.createElement('div');document.body.append(node);const root=createRoot(node);let serial=0;
window.mountHistory=(context=null,permission={})=>{document.getElementById('root').style.display='none';root.render(<CampaignHistoryView key={++serial} context={context} role="Client" permission={permission} onNavigate={(context,query)=>{window.navigated={context,query};}}/>);};
