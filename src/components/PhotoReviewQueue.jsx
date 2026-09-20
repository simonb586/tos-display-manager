import React,{useEffect,useMemo,useRef,useState} from 'react';
import {listPhotoReviewQueue,ignoreReviewPhoto} from '../services/photoReviewService';
import {loadPhotoImportCatalog,importContextForPhoto,savePhotoImportContext,finalizeImportPhoto} from '../services/photoImportContextService';
import {getSignedDownloadUrl} from '../services/photoAccessService';
import {importRecognitionCounts} from '../lib/photoImportRecognition';
import {photoReviewState,isImportedPhoto} from '../lib/photoReview';
import {validateSupportPhoto} from '../services/photoInventoryService';
import {deleteSupportPhoto} from '../services/photoLibraryService';
import PhotoImportContextEditor,{ImportPhotoPreview,ImportBatchDecision,updateImportManual} from './PhotoImportContextEditor';
import '../features/v10/photo-review-queue.css';
import '../features/v10/photo-import-context.css';
const filters={all:'Toutes',support:'Support à identifier',date:'Date à valider',edt:'EDT à valider',type:'Type à valider',visual:'Visuel à valider',unmatched:'Non identifiées',ready:'Prêtes à confirmer',validated:'Validées',ignored:'Ignorées'};
export default function PhotoReviewQueue({role,initialPhotoId=null}) {
 const canManage=['Administrateur','Coordonnateur'].includes(role);
 const [rows,setRows]=useState([]),[catalog,setCatalog]=useState(null),[filter,setFilter]=useState('all'),[query,setQuery]=useState(''),[sort,setSort]=useState('recent'),[selected,setSelected]=useState(new Set()),[viewer,setViewer]=useState(null),[rotation,setRotation]=useState(0),[zoom,setZoom]=useState(1),[page,setPage]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const active=useRef(false),loadVersion=useRef(0);
 const [loading,setLoading]=useState(true);
 useEffect(()=>{if(initialPhotoId)setViewer(initialPhotoId)},[initialPhotoId]);
 async function remove(photo){
  if(!canManage||active.current||!window.confirm(`Supprimer définitivement la photo « ${photo.original_filename||photo.nom_fichier||photo.id} » ?`))return;
  active.current=true;setBusy(true);
  try{await deleteSupportPhoto(photo);setViewer(null);setSelected(current=>{const next=new Set(current);next.delete(photo.id);return next});await load();setMessage('Photo supprimée.');}
  catch(error){setMessage(error.message)}finally{active.current=false;setBusy(false)}
 }
 async function load(){
  const version=++loadVersion.current;setLoading(true);
  let photos;try{photos=await listPhotoReviewQueue();}finally{if(version===loadVersion.current)setLoading(false);}
  if(version!==loadVersion.current)return;
  setRows(photos);setCatalog(null);setPage(0);
  try{const data=await loadPhotoImportCatalog();if(version!==loadVersion.current)return;setCatalog(data);setRows(photos.map(p=>{
   try{return {...p,import_context:importContextForPhoto(p,data)};}
   catch(error){return {...p,context_error:error.message};}
  }));}catch(error){setMessage(`Photos chargées. Catalogue indisponible : ${error.message}`);}
 }
 useEffect(()=>{load().catch(e=>setMessage(e.message));return()=>{loadVersion.current++;};},[]);
 const counts=useMemo(()=>({...importRecognitionCounts(rows.map(p=>({recognition:p.import_context?.recognition,finalized:photoReviewState(p)==='validated',error:p.review_status==='error'}))),review:rows.filter(p=>photoReviewState(p)==='pending').length,imported:rows.filter(isImportedPhoto).length}),[rows]);
 const visible=useMemo(()=>rows.filter(p=>{
  const r=p.import_context?.recognition,finalized=photoReviewState(p)==='validated';
  const matches=filter==='all'||filter==='validated'&&finalized||filter==='ignored'&&photoReviewState(p)==='ignored'||photoReviewState(p)==='pending'&&(filter==='ready'?r?.ready:filter==='unmatched'?r?.unidentified:r?.states?.[filter]==='TO_REVIEW');
  return matches&&[p.original_filename,p.support_id,p.proposed_support_id,p.import_context?.recognition?.values?.support].join(' ').toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr'));
 }).sort((a,b)=>sort==='name'?String(a.original_filename).localeCompare(String(b.original_filename),'fr'):(sort==='oldest'?1:-1)*(new Date(a.uploaded_at||a.created_at)-new Date(b.uploaded_at||b.created_at))),[rows,filter,query,sort]);
 const shown=visible.slice(page*12,page*12+12),opened=rows.find(r=>r.id===viewer),viewerIndex=visible.findIndex(p=>p.id===viewer);
 function contextChanged(id,context){setRows(current=>current.map(p=>p.id===id?{...p,import_context:context}:p));}
 async function execute(ids,finalize=false){
  if(!canManage||active.current)return;active.current=true;setBusy(true);let saved=0;const errors=[];
  try{for(const id of ids){const photo=rows.find(p=>p.id===id);if(!photo||photo.import_finalized_at)continue;
    try{if(!isImportedPhoto(photo)){if(finalize)await validateSupportPhoto(id,'Validée');else throw Error('Utilisez la fiche photo pour corriger cette preuve Terrain.');}
     else{await savePhotoImportContext(id,photo.import_context);if(finalize){if(!photo.import_context.recognition.ready)throw Error('Informations encore à valider');await finalizeImportPhoto(id);}}saved++;}catch(e){errors.push(`${photo.original_filename} : ${e.message}`);}
   }
   await load();setMessage(`${saved} photo(s) ${finalize?'validée(s)':'enregistrée(s)'}.${errors.length?' '+errors.join(' ; '):''}`);
   if(finalize)window.dispatchEvent(new Event('tos-terrain-data-updated'));
  }catch(e){setMessage(e.message);}finally{active.current=false;setBusy(false);}
 }
 function bulk(decision){if(!window.confirm(`Appliquer ces choix à ${selected.size} photos ? Les supports individuels sont conservés.`))return;setRows(current=>current.map(p=>selected.has(p.id)&&!p.import_finalized_at?{...p,import_context:updateImportManual(p.import_context,catalog,decision)}:p));}
 async function original(photo){try{const url=await getSignedDownloadUrl({...photo,normalized_filename:photo.original_filename,nom_fichier:photo.original_filename});window.open(url,'_blank','noopener,noreferrer');}catch(e){setMessage(e.message);}}
 return <section className="photo-review-queue"><header><h2>Photos à valider</h2><p>Les originaux sont conservés. Seules les installations et retraits confirmés créent un mouvement.</p></header>
  {message&&<p role="status">{message}</p>}
  <div className="review-counters"><span>Importées <b>{counts.imported}</b></span><span>Auto-reconnues <b>{counts.automatic}</b></span><span>À valider <b>{counts.review}</b></span><span>Non identifiées <b>{counts.unidentified}</b></span><span>Validées <b>{counts.validated}</b></span><span>Erreurs <b>{counts.errors}</b></span></div>
  <div className="review-toolbar"><label>Filtrer<select value={filter} onChange={e=>{setFilter(e.target.value);setPage(0);}}>{Object.entries(filters).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Rechercher<input value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/></label><label>Tri<select value={sort} onChange={e=>setSort(e.target.value)}><option value="recent">Plus récentes</option><option value="oldest">Plus anciennes</option><option value="name">Nom original</option></select></label><button disabled={busy} onClick={()=>load().catch(e=>setMessage(e.message))}>Actualiser</button></div>
  {catalog&&selected.size>0&&<><ImportBatchDecision catalog={catalog} onApply={bulk} disabled={busy}/><button disabled={busy} onClick={()=>execute([...selected],false)}>Enregistrer la sélection</button><button disabled={busy} onClick={()=>execute([...selected],true)}>Confirmer la sélection</button></>}
  <div className="review-grid">{shown.map(photo=><article key={photo.id} data-photo-id={photo.id}><label><input type="checkbox" checked={selected.has(photo.id)} disabled={busy||Boolean(photo.import_finalized_at)||!isImportedPhoto(photo)||!photo.import_context?.recognition} onChange={e=>setSelected(current=>{const next=new Set(current);e.target.checked?next.add(photo.id):next.delete(photo.id);return next;})}/> Sélectionner</label>
   <ImportPhotoPreview photo={photo} onClick={()=>{setViewer(photo.id);setZoom(1);setRotation(0);}}/>
   <div className="review-card-body"><strong>{photo.original_filename||photo.nom_fichier}</strong><span>{photo.import_context?.recognition?.values?.support||photo.support_id||'Support à identifier'}</span><span>{photo.statut_validation||photo.review_status||'À valider'}</span><small>{photo.import_context?.recognition?.values?.date||photo.captured_at||photo.prise_le||'Date à confirmer'}</small>
    <small>EDT : {catalog?.edts.find(e=>String(e.id)===String(photo.import_context?.recognition?.values?.edt))?.no_edt||'À valider'}</small>
    <small>Visuel : {catalog?.visuals.find(v=>String(v.id)===String(photo.import_context?.recognition?.values?.visual))?.nom_visuel||'À valider'}</small>
    <small>Type : {photo.import_context?.recognition?.values?.type||photo.type_photo||'À valider'}</small>
    <small>{photo.context_error||Object.values(photo.import_context?.recognition?.reasons||{}).join(' · ')||(!catalog?'Chargement du catalogue…':'')}</small>
    {!isImportedPhoto(photo)&&photoReviewState(photo)==='pending'&&<button disabled={busy} onClick={()=>execute([photo.id],true)}>Valider la preuve Terrain</button>}
    <button disabled={!catalog||!photo.import_context?.recognition} onClick={()=>{setViewer(photo.id);setZoom(1);setRotation(0);}}>Examiner / Corriger</button><button onClick={()=>original(photo)}>Fichier original</button>
    {canManage&&photoReviewState(photo)==='pending'&&<div className="review-actions">{isImportedPhoto(photo)&&<button disabled={busy||!catalog||!photo.import_context?.recognition} onClick={()=>{setViewer(photo.id);setZoom(1);setRotation(0);}}>Attribuer un support</button>}<button className="danger" disabled={busy} onClick={()=>remove(photo)}>Supprimer</button></div>}
   </div></article>)}</div>
  {loading&&<p role="status">Chargement des photos…</p>}
  {!loading&&!shown.length&&<p>Aucune photo pour ce filtre.</p>}
  <div className="review-toolbar"><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Précédent</button><span>{page+1} / {Math.max(1,Math.ceil(visible.length/12))}</span><button disabled={(page+1)*12>=visible.length} onClick={()=>setPage(p=>p+1)}>Suivant</button></div>
  {opened&&catalog&&opened.import_context?.recognition&&<div className="review-viewer import-context-viewer" role="dialog" aria-modal="true" aria-label="Validation de la photo"><button onClick={()=>setViewer(null)}>Fermer</button>
   <div className="import-photo-pane"><ImportPhotoPreview photo={opened} style={{transform:`rotate(${rotation}deg) scale(${zoom})`}}/><div><button onClick={()=>setZoom(z=>Math.min(4,z+.25))}>Zoom +</button><button onClick={()=>setZoom(z=>Math.max(.5,z-.25))}>Zoom −</button><button onClick={()=>setRotation(r=>r+90)}>Rotation</button><button onClick={()=>original(opened)}>Fichier original</button><button disabled={viewerIndex<=0} onClick={()=>setViewer(visible[viewerIndex-1].id)}>Photo précédente</button><button disabled={viewerIndex<0||viewerIndex>=visible.length-1} onClick={()=>setViewer(visible[viewerIndex+1].id)}>Photo suivante</button></div></div>
   <div>{isImportedPhoto(opened)?<PhotoImportContextEditor context={opened.import_context} catalog={catalog} onChange={context=>contextChanged(opened.id,context)} disabled={busy||Boolean(opened.import_finalized_at)}/>:<p>Preuve Terrain — {opened.support_id} — {opened.type_photo}</p>}
    {!opened.import_finalized_at&&isImportedPhoto(opened)&&<div className="review-actions"><button disabled={busy} onClick={()=>execute([opened.id])}>Enregistrer les choix</button><button disabled={busy||!opened.import_context.recognition.ready} onClick={()=>execute([opened.id],true)}>Confirmer la photo</button><button disabled={busy} onClick={async()=>{try{await ignoreReviewPhoto(opened.id);await load();}catch(e){setMessage(e.message);}}}>Ignorer en conservant l’original</button><button onClick={()=>setViewer(null)}>Différer</button></div>}
   </div>
  </div>}
 </section>;
}
