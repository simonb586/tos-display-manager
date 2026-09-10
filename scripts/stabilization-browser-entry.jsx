import React from 'react';
import {createRoot} from 'react-dom/client';
import ClientPortal from '../src/components/ClientPortal.jsx';
import UnifiedDataGrid from '../src/components/UnifiedDataGrid.jsx';
import InvitationAcceptance from '../src/components/InvitationAcceptance.jsx';
import UserProvisioningPanel from '../src/components/UserProvisioningPanel.jsx';
import OperationalCommandCenter from '../src/components/OperationalCommandCenter.jsx';

window.fixture={client:2,role:'Client-Admin',calls:[],delay:15,fail:false,permissions:['Infrastructures','Campagnes et visuels'],mutations:0};
const root=createRoot(document.getElementById('root'));
window.mount=(kind='portal',preview=null)=>root.render(kind==='alerts'?<OperationalCommandCenter dataStore={{}} initialView="alerts" onNavigate={target=>{window.fixture.target=target}}/>:kind==='grid'?<UnifiedDataGrid columns={[{id:'site',label:'Site'}]} rows={[{id:1,site:'EXO'}]} rowKey={row=>row.id} renderCell={(col,row)=>row[col.id]}/>:kind==='invitation'?<InvitationAcceptance/>:kind==='users'?<UserProvisioningPanel role="Administrateur"/>:<ClientPortal profile={{id:window.fixture.client,client_id:window.fixture.client,role:window.fixture.role}} preview={preview}/>);
window.mount();
