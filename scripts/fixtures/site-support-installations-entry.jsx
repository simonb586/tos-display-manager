import React from 'react';
import {createRoot} from 'react-dom/client';
import SiteSupportAssignmentsView from '../../src/components/SiteSupportAssignmentsView';
import CampaignsPanel from '../../src/components/CampaignsPanel';
import PhotoReviewQueue from '../../src/components/PhotoReviewQueue';
import {projectSiteSupportDeployments} from '../../src/lib/siteSupportDeployments';
import {recognizeImportPhoto} from '../../src/lib/photoImportRecognition';
const root=createRoot(document.getElementById('root'));let serial=0;
const campaigns=[{id:1,client_id:2,nom_campagne:'Thème 10',business_context:'marketing',statut:'Active'},
 {id:2,client_id:2,nom_campagne:'Thème 2',business_context:'marketing',statut:'Brouillon'}];
window.fixture={calls:[],client:2,count:10,deleted:false};window.confirm=()=>true;
const supports=()=>Array.from({length:fixture.count},(_,i)=>({id:i+1,client_id:fixture.client,support_id:`S-${fixture.client}-${i+1}`,site:'Site '+i,visuel_id:1,visuel_en_expo:'Visuel A',campagne_actuelle:'Thème 10',date_visuel_actuel:'2026-09-18',edt_associe:'EDT-'+i}));
const visuals=()=>[{id:1,client_id:fixture.client,campagne_id:1,nom_visuel:'Visuel A',reference_assets:[]}];
const rows=()=>projectSiteSupportDeployments({supports:supports(),campaigns:campaigns.map(c=>({...c,client_id:fixture.client})),visuals:visuals()});
const catalog=()=>({supports:supports(),campaigns,visuals:visuals(),edts:[],phases:[],links:[],associations:[]});
window.testApi=(file,name,args)=>{
 fixture.calls.push({name,args});
 if(name==='getMarketingAssignmentsBySiteAndSupport'||name==='getOperationalCommunicationAssignmentsBySiteAndSupport'){
  const options=args[0],result=rows().filter(r=>!options.search||Object.values(r).some(v=>String(v).includes(options.search)));
  return Promise.resolve({rows:result,total:result.length,page:1,pageSize:25,unresolved:0});
 }
 if(name==='getAllAssignmentsBySiteAndSupport')return Promise.resolve(rows());
 if(name==='listMasterCampaigns'||name==='listAssignableClients')return Promise.resolve(campaigns);
 if(name==='listCampaignVisuals'||name==='listReferenceVisuals'||name==='listEdtPhasesForCampaign')return Promise.resolve([]);
 if(name==='listPhotoReviewQueue')return Promise.resolve(fixture.deleted?[]:[{id:1,source:'mass_import',original_filename:'unmatched.jpg',review_status:'unmatched',statut_validation:'À valider'}]);
 if(name==='loadPhotoImportCatalog')return Promise.resolve(catalog());
 if(name==='importContextForPhoto'){const input={originalFilename:'unmatched.jpg'};return {input,manual:{},recognition:recognizeImportPhoto(input,catalog())};}
 if(name==='savePhotoImportContext'){fixture.saved=args[1];return Promise.resolve({ok:true});}
 if(name==='deleteSupportPhoto'){fixture.deleted=true;return Promise.resolve({ok:true});}
 if(name==='getSignedPhotoUrl')return Promise.resolve('');
 throw Error('Unconfigured service '+name);
};
window.mount=(view='installations',role='Administrateur',client=2)=>{
 fixture={calls:[],client,count:10,deleted:false};
 const permissions={visible_columns:{},capabilities:{'*':{update:true}}};
 root.render(view==='themes'?<CampaignsPanel key={++serial} role={role} scopedCampaigns={campaigns}/>:view==='photos'?<PhotoReviewQueue key={++serial} role={role}/>:<SiteSupportAssignmentsView key={++serial} role={role} permission={permissions} context="marketing" scopeKey={`${role}:${client}`}/>);
};
