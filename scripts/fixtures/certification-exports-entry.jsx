import React from 'react';
import {createRoot} from 'react-dom/client';
import ExportsCenter from '../../src/components/ExportsCenter';
import SupportPhotoGallery from '../../src/components/SupportPhotoGallery';
const root=createRoot(document.getElementById('root'));let key=0;
window.exportFixture={calls:[],files:[],fail:false};
const objectUrl=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{exportFixture.files.push(blob);return objectUrl(blob)};
HTMLAnchorElement.prototype.click=function(){exportFixture.download=this.download};
window.fetch=async()=>new Response(new Uint8Array([137,80,78,71]),{status:200});
window.testApi=(file,name,args)=>{
 const f=exportFixture;f.calls.push({name,args});const fail=f.fail;
 const rows=[{id:1,support_id:'SUP-'+f.client,nom_fichier:'fixture.png',storage_path:'local/fixture.png',client_name:'Client '+f.client,nom_campagne:'Fixture',type_photo:'inspection'}];
 const result=name==='listSupportPhotos'?rows:name==='getSignedDownloadUrl'?'/local-fixture.png':name==='deleteSupportPhotos'?[{id:1,ok:true}]:{id:1,verified:true};
 return new Promise((resolve,reject)=>setTimeout(()=>fail?reject(Error('EXPORT_FIXTURE_ERROR')):resolve(result),100));
};
window.mount=(kind='exports',role='Administrateur',client=2)=>{window.exportFixture={calls:[],files:[],fail:false,client};root.render(kind==='gallery'?<SupportPhotoGallery key={++key} supportId={'SUP-'+client} canDelete={role==='Administrateur'} canManage={['Administrateur','Coordonnateur'].includes(role)}/>:<ExportsCenter key={++key} domains={[{id:'supports',label:'Supports'},{id:'photos',label:'Photos'}]} loadRows={async domain=>{const f=exportFixture,fail=f.fail;f.calls.push({name:'loadRows',domain:domain.id});await new Promise(r=>setTimeout(r,100));if(fail)throw Error('EXPORT_FIXTURE_ERROR');return [{support_id:'SUP-'+client,site:'Client '+client,nom_fichier:'fixture.png',storage_path:domain.id==='photos'?'local/fixture.png':undefined,client_name:'Client '+client,nom_campagne:'Fixture'}]}}/>)};
