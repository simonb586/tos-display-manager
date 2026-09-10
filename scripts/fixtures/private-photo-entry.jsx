import React from 'react';import {createRoot} from 'react-dom/client';
import PhotoImage from '../../src/components/PhotoImage';
import Support360Panel from '../../src/components/Support360Panel';
import * as access from '../../src/services/photoAccessService';
import {prepareAndUploadPhoto,photoHistoryRow} from '../../src/services/photoWorkflowService';
import {downloadExcelSelectionWithPhotos} from '../../src/lib/utils';
import ExportsCenter from '../../src/components/ExportsCenter';
import {generateEdtReportPdf} from '../../src/services/finalReportService';
const root=createRoot(document.getElementById('root'));let key=0;
window.photoFixture={calls:[],deny:false,hold:false,pending:[],offset:0};
const now=Date.now;Date.now=()=>now()+photoFixture.offset;
window.access=access;window.uploadPhoto=prepareAndUploadPhoto;window.photoHistoryRow=photoHistoryRow;
window.exportXlsx=downloadExcelSelectionWithPhotos;
window.generatePhotoPdf=async photo=>{
 const blob=await generateEdtReportPdf({title:'Rapport photo',edt:{no_edt:'TEST-PHOTO'},section_order:['photos'],photos:[{...photo,selected:true}]});
 return blob.text();
};
window.photoFiles=[];const createUrl=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{photoFiles.push(blob);return createUrl(blob)};HTMLAnchorElement.prototype.click=function(){};
const canvas=document.createElement('canvas');canvas.width=2;canvas.height=2;canvas.getContext('2d').fillRect(0,0,2,2);const pixel=canvas.toDataURL('image/png');
window.signPhoto=async(bucket,path,ttl,options)=>{
 const f=photoFixture;f.calls.push({bucket,path,ttl,options});
 if(f.hold)await new Promise(resolve=>f.pending.push(resolve));
 return f.deny?{error:{message:'Access denied'}}:{data:{signedUrl:pixel+'#'+f.calls.length}};
};
window.testApi=(file,name)=>{throw Error('Unexpected unscoped service '+name)};
window.mount=(photo,mode='image')=>{root.render(mode==='preview'?<Support360Panel key={++key} supportId="EXO-2" role="Client" scopedData={{photos:[photo],history:[],issues:[],inspections:[],workOrders:[],edtLinks:[],logs:[]}}/>:<PhotoImage key={++key} photo={photo} alt="Photo autorisée"/>)};
window.mountExport=photo=>root.render(<ExportsCenter key={++key} domains={[{id:'photos',label:'Photos'}]} loadRows={async()=>[photo]}/>);
window.run=expression=>{window.result=null;Promise.resolve().then(()=>(0,eval)(expression)).then(value=>window.result={value},error=>window.result={error:error.message})};
