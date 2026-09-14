import React from 'react';
import {createRoot} from 'react-dom/client';
import CampaignVisualManager from '../../src/components/CampaignVisualManager';
import EdtVisualAssignments from '../../src/components/EdtVisualAssignments';
const root=createRoot(document.getElementById('root'));let revision=0;
window.fixture={calls:[],phase:null};
const phases=[{id:114,edt_id:64,phase_type:'installation',nom:'Installation',edt:{id:64,no_edt:'EDT-64',campagne_id:7}}];
window.testApi=(file,name,args)=>{
  window.fixture.calls.push({name,args});
  if(name==='listMasterCampaigns')return Promise.resolve([{id:7,nom_campagne:'Civisme',business_context:'marketing'}]);
  if(name==='listCampaignVisuals')return Promise.resolve([{id:34,campagne_id:7,nom_visuel:'Visible',format_support:'20x28',edt_phase_id:window.fixture.phase,campagne:{id:7,business_context:'marketing'}}]);
  if(name==='listEdtPhasesForCampaign')return Promise.resolve(phases);
  if(name==='saveCampaignVisual'){window.fixture.phase=args[0].edt_phase_id;return Promise.resolve({ok:true});}
  if(name==='assignVisualToEdt'){window.fixture.phase=args[1];return Promise.resolve({ok:true});}
  throw Error('Unexpected fixture service '+name);
};
window.mount=(view='visual',role='Administrateur')=>{
  sessionStorage.clear();
  root.render(view==='visual'?<CampaignVisualManager key={++revision} role={role}/>:<EdtVisualAssignments key={++revision} edt={{id:64,campagne_id:7}} phases={phases} busy={false} run={async fn=>fn()}/>);
};
