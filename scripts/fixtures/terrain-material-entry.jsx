import React from 'react';
import {createRoot} from 'react-dom/client';
import TerrainApp from '../../src/components/TerrainApp';
const root=createRoot(document.getElementById('root'));let serial=0;
window.fixture={calls:[],status:'resolved',fail:false};
window.testApi=(_file,name,args)=>{
 const f=window.fixture;f.calls.push({name,args});
 if(name==='diagnoseCompatibleVisualsForSupport')return Promise.resolve({visuals:[{id:11,nom_visuel:'Étiquette',format_support:'20 x 28',campagne:{nom_campagne:'Test'},edt_associations:[{phase_id:7,edt_number:'EDT-7'}]},{id:12,nom_visuel:'Autre',format_support:'20 x 28',campagne:{nom_campagne:'Test'},edt_associations:[{phase_id:7,edt_number:'EDT-7'}]}]});
 if(name==='uploadTerrainPhoto')return Promise.resolve({normalizedFilename:'photo.png',path:'supports/TEST-SUPPORT/one.png',storagePath:'supports/TEST-SUPPORT/one.png',storageReference:'terrain-photos/supports/TEST-SUPPORT/one.png'});
 if(name==='finalizeTerrainInstallation')return f.fail?Promise.reject(Error('network timeout')):Promise.resolve({ok:true,reference:'same-reference',repertoire_affiche_id:51});
 if(name==='rollbackUploadedPhoto')return Promise.resolve();
 throw Error('Unexpected service '+name);
};
window.materialRpc=async(name,args)=>{
 fixture.calls.push({name,args});
 const visual=args.p_visual_id,status=fixture.status,delay=fixture.slowFirst&&visual===11?400:10;
 await new Promise(r=>setTimeout(r,delay));
 return {data:{status,record:status==='resolved'?{id:visual===11?51:52}:null,match_count:status==='ambiguous'?2:status==='resolved'?1:0,
  message:status==='ambiguous'?'Plusieurs articles correspondent à ce visuel et ce format dans le Répertoire des affiches. Votre intervention et votre photo sont conservées.':status==='not_found'?'Aucun article correspondant trouvé dans le Répertoire des affiches pour ce visuel et ce format. Votre intervention et votre photo sont conservées.':null}};
};
window.mount=()=>{window.fixture={calls:[],status:'resolved',fail:false};root.render(<TerrainApp key={++serial} role="Installateur" session={{user:{email:'fixture@example.invalid'}}} dataStore={{Infrastructures:{rows:[{id:1,support_id:'TEST-SUPPORT',format_affichage:'20 x 28'}]}}}/>)};
window.change=(selector,value)=>{const input=document.querySelector(selector);Object.getOwnPropertyDescriptor(input.tagName==='SELECT'?HTMLSelectElement.prototype:input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}));};
window.attach=()=>{const dt=new DataTransfer();dt.items.add(new File([new Uint8Array([137,80,78,71])],'photo.png',{type:'image/png'}));const input=document.querySelector('input[type=file]');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));};
