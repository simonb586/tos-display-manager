import React from 'react';
import {createRoot} from 'react-dom/client';
import PhotoReviewQueue from '../../src/components/PhotoReviewQueue';
import DisplayMovementInventory from '../../src/components/DisplayMovementInventory';
import {recognizeImportPhoto} from '../../src/lib/photoImportRecognition';
const root=createRoot(document.getElementById('root'));let serial=0;
const catalog={supports:[{support_id:'SUP-A',client_id:2,format_affichage:'20 x 28'},{support_id:'SUP-B',client_id:2,format_affichage:'20 x 28'}],edts:[{id:1,no_edt:'EDT-1',client_id:2,campagne_id:7}],phases:[{id:11,edt_id:1,phase_type:'installation',date_debut_prevue:'2026-06-01'}],links:['SUP-A','SUP-B'].map(support_id=>({support_id,edt_id:1})),campaigns:[{id:7,client_id:2,nom_campagne:'Campagne A',business_context:'marketing'}],visuals:[70,71].map(id=>({id,client_id:2,campagne_id:7,nom_visuel:'Visuel '+id,format_support:'20 x 28'})),associations:[]};
const context=p=>{const input=p.import_context?.input||{originalFilename:p.original_filename,capturedAt:'2026-06-01T12:00:00Z',capturedAtSource:'EXIF'},manual=p.import_context?.manual||{};return {input,manual,recognition:recognizeImportPhoto(input,catalog,manual)};};
window.fixture={calls:[],role:'Administrateur',photos:[],cancelled:false};
window.testApi=(file,name,args)=>{
 fixture.calls.push({name,args});
 if(name==='importContextForPhoto')return context(args[0]);
 if(name==='listPhotoReviewQueue')return Promise.resolve(structuredClone(fixture.photos));
 if(name==='deleteReviewPhotos'){const ids=args[0];if(fixture.photos.some(p=>ids.includes(p.id)&&p.import_finalized_at))throw Error('Finalized photo');fixture.photos=fixture.photos.filter(p=>!ids.includes(p.id));return Promise.resolve(ids);}
 if(name==='reanalyzeReviewPhotos')return Promise.resolve(args[0].map(p=>({id:p.id,ok:true})));
 if(name==='loadPhotoImportCatalog')return Promise.resolve(catalog);
 if(name==='savePhotoImportContext'){fixture.photos.find(p=>p.id===args[0]).import_context=structuredClone(args[1]);return Promise.resolve({ok:true});}
 if(name==='finalizeImportPhoto'){const p=fixture.photos.find(p=>p.id===args[0]);if(!context(p).recognition.ready)return Promise.reject(Error('Incomplete'));p.import_finalized_at='2026-09-15';return Promise.resolve({ok:true});}
 if(name==='getSignedPhotoUrl'||name==='getSignedDownloadUrl')return Promise.resolve('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
 if(name==='getPhotoInventoryCapabilities')return Promise.resolve({cancel:fixture.role==='Administrateur',author:fixture.role==='Administrateur'});
 if(name==='listDisplayMovements')return Promise.resolve({total:1,rows:[{id:'1:installation',history_id:1,movement_kind:'installation',event_at:'2026-06-01',support_id:'SUP-A',edt_number:'EDT-1',visual:'Visuel 70',campaign:'Campagne A',source:'Import massif',client_id:2,photos:[],status:fixture.cancelled?'CANCELLED':'ACTIVE',author:fixture.role==='Administrateur'?'internal@example.invalid':undefined}]});
 if(name==='cancelDisplayMovement'){fixture.cancelled=true;return Promise.resolve({ok:true});}
 if(name==='readDisplayCurrentState')return Promise.resolve({});
 throw Error('Unexpected fixture '+name);
};
window.mount=(kind='review',role='Administrateur')=>{fixture.calls=[];fixture.role=role;fixture.cancelled=false;fixture.photos=Array.from({length:20},(_,i)=>({id:i+1,source:'mass_import',review_status:'needs_review',original_filename:i===0?'unknown.jpg':(i%2?'SUP-A':'SUP-B')+'_'+i+'.jpg',storage_bucket:'support-photos',storage_path:'fixture/'+i+'.jpg',uploaded_at:'2026-06-01'}));root.render(kind==='review'?<PhotoReviewQueue key={++serial} role={role}/>:<DisplayMovementInventory key={++serial}/>);};
window.setInput=(selector,value)=>{const input=document.querySelector(selector);Object.getOwnPropertyDescriptor(input.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}));};
window.clickText=(text,selector='button')=>{const target=[...document.querySelectorAll(selector)].find(b=>b.textContent===text);if(!target)throw Error('Missing button '+text);target.click();};
window.confirm=message=>{fixture.confirmation=message;return fixture.confirm!==false;};
