import React from 'react';
import {createRoot} from 'react-dom/client';
import Module15Reports from '../../src/components/Module15Reports';
import FinalReportsCenter from '../../src/components/FinalReportsCenter';
import {createReportDraft} from '../../src/lib/module15ReportModel';
const row={id:17,no_edt:'EDT-LOCAL-17',client:'Client local',client_id:2,campaign_name:'Local',requester_name:'Fixture',requester_email:'fixture@example.invalid',support_count:1,statut:'Terminé',delivery_status:'À envoyer'};
const root=createRoot(document.getElementById('root'));let key=0;
window.reportFixture={calls:[],fail:false,existing:false};
window.testApi=(file,name,args)=>{
 const f=reportFixture;
 if(name==='loadEdtReportTracking')return Promise.resolve({tracking:[{...row,delivery_status:f.sent?'Envoyé':row.delivery_status,report:f.existing?{id:31,title:'Rapport local',report_version:1}:null}]});
 if(name==='loadEdtReportSource')return Promise.resolve(createReportDraft({edt:row,supports:[{edt_id:17,support_id:'SUP-2',site:'Local'}]}));
 if(name==='listFinalCommunications')return Promise.resolve([{id:41,objet:'Rapport local',statut:'Envoyé',destinataires:['fixture@example.invalid'],created_at:'2026-09-08'}]);
 if(name==='normalizeFinalReportContext')return {recipients:['fixture@example.invalid'],cc:[],edtNumber:row.no_edt,clientName:row.client,campaignName:'Local',planned:1,installed:1,notInstalled:0};
 f.calls.push({name,args});const fail=f.fail;
 return new Promise((resolve,reject)=>setTimeout(()=>fail?reject(Error('REPORT_FIXTURE_ERROR')):resolve({id:31}),100));
};
window.mount=(kind,role='Administrateur',existing=false,sent=false)=>{window.reportFixture={calls:[],fail:false,existing,sent};root.render(kind==='module15'?<Module15Reports key={++key} role={role} dataStore={{}}/>:<FinalReportsCenter key={++key} role={role} dataStore={{'Suivi des EDT':{rows:[row]},Infrastructures:{rows:[{support_id:'SUP-2',edt_associe:row.no_edt}]}}}/>)};
