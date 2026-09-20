import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import CampaignsPanel from '../../src/components/CampaignsPanel';
let root;
window.testApi=async()=>{throw Error('A scoped campaign panel must not load unscoped data')};
function Fixture({role,context}){
 const [loading,setLoading]=useState(false);
 const reload=async()=>{window.reloadCount++;setLoading(true);await new Promise(r=>setTimeout(r,30));setLoading(false)};
 return loading?<p>Chargement…</p>:<CampaignsPanel role={role} scopedCampaigns={[]} onReload={reload} businessContext={context}/>;
}
window.mount=(role,context)=>{root?.unmount();sessionStorage.clear();window.reloadCount=0;root=createRoot(document.getElementById('root'));root.render(<Fixture role={role} context={context}/>)};
