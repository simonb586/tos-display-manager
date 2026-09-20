import React,{useMemo,useRef,useState} from 'react';
import {createImportId,createImportItem,errorCsv,importReport,rematchManifestFiles,summaryCsv} from '../lib/massPhotoImport';
import {analyzePhotoItem,listImportManifests,runControlledQueue,saveImportManifest,uploadPhotoItem} from '../services/massPhotoImportService';
import {releaseFrameIdentifierOcr} from '../services/frameIdentifierOcrService';
import {loadPhotoImportCatalog} from '../services/photoImportContextService';
import PhotoImportContextEditor,{ImportPhotoPreview,ImportBatchDecision,updateImportManual} from './PhotoImportContextEditor';
import '../features/v10/mass-photo-import.css';
import '../features/v10/photo-import-context.css';
import {importRecognitionCounts} from '../lib/photoImportRecognition';
const download=(text,name)=>{const url=URL.createObjectURL(new Blob(['\ufeff',text],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
export default function MassPhotoImporter({role,onReview}) {
 const [items,setItems]=useState([]),[batchId,setBatchId]=useState(createImportId),[catalog,setCatalog]=useState(null),[busy,setBusy]=useState(false),[paused,setPaused]=useState(false),[message,setMessage]=useState(''),[page,setPage]=useState(0),[opened,setOpened]=useState(null),[rotation,setRotation]=useState(0),[zoom,setZoom]=useState(1);
 const active=useRef(false),control=useRef(null),started=useRef(null);
 const selected=items.filter(p=>p.selected),visible=items.slice(page*12,page*12+12),view=items.find(p=>p.id===opened);
 const counts=useMemo(()=>({...importRecognitionCounts(items.filter(i=>i.recognition)),imported:items.filter(i=>i.resultId).length}),[items]);
 if(!['Administrateur','Coordonnateur'].includes(role))return <p>Import massif non autorisé.</p>;
 const change=(id,patch)=>setItems(current=>current.map(p=>p.id===id?{...p,...patch}:p));
 function choose(e){const files=Array.from(e.target.files||[]);setItems(files.map((f,i)=>createImportItem(f,i)));setBatchId(createImportId());setCatalog(null);setPage(0);setOpened(null);started.current=null;setMessage('');}
 async function restore(e){try{const manifests=await listImportManifests(),last=manifests[0];if(!last)throw Error('Aucun import à reprendre.');const restored=await rematchManifestFiles(last.items,Array.from(e.target.files||[]));setItems([...last.items.filter(p=>p.resultId),...restored]);setBatchId(last.id);setCatalog(await loadPhotoImportCatalog());setMessage('Import repris ; les originaux déjà importés sont conservés.');}catch(error){setMessage(error.message);}}
 async function process(mode){
  if(active.current)return;active.current=true;setBusy(true);setMessage('');started.current||=new Date().toISOString();
  try{
   const data=catalog||await loadPhotoImportCatalog();setCatalog(data);const snapshot=[...items];
   const task=await runControlledQueue(snapshot,async(item,index)=>{
    if(item.resultId||!item.file||mode==='upload'&&!item.recognition)return;
    let next;try{next=mode==='analyze'?await analyzePhotoItem(item,{catalog:data}):await uploadPhotoItem(item,{batchId});}catch(error){next={...item,status:'failed',error:error.message};}
    snapshot[index]=next;change(item.id,next);
   },{concurrency:mode==='analyze'?2:6,batchSize:100},{onBatch:()=>saveImportManifest({id:batchId,items:snapshot}).catch(()=>{})});
   control.current=task.control;await task.run;setItems([...snapshot]);await saveImportManifest({id:batchId,items:snapshot});
   setMessage(mode==='upload'?'Originaux conservés. Les associations peuvent être corrigées puis finalisées dans À valider.':'Analyse terminée. Les photos ambiguës et non identifiées peuvent aussi être importées.');
  }catch(error){setMessage(error.message);}finally{if(mode==='analyze')await releaseFrameIdentifierOcr();active.current=false;setBusy(false);setPaused(false);}
 }
 function updateContext(item,context){change(item.id,{import_context:context,manual:context.manual,recognition:context.recognition,status:context.recognition.ready?'ready':'requires_review'});}
 function bulk(decision){if(!window.confirm(`Appliquer ces choix à ${selected.length} photos, en conservant chaque support ?`))return;setItems(current=>current.map(item=>{if(!item.selected||!item.import_context||item.resultId)return item;const context=updateImportManual(item.import_context,catalog,decision);return {...item,import_context:context,manual:context.manual,recognition:context.recognition,status:context.recognition.ready?'ready':'requires_review'};}));}
 const preview=photo=>({...photo,storage_path:photo.storagePath,storage_bucket:'support-photos',nom_fichier:photo.originalFilename});
 return <section className="mass-photo-import"><h2>Importer des photos en lot</h2>
  <p>Chaque original est conservé, même si son support ou son contexte reste à identifier.</p>
  {message&&<p role="status">{message}</p>}
  <div className="mass-controls"><label>Sélectionner les photos<input disabled={busy} type="file" accept="image/*" multiple onChange={choose}/></label><label>Reprendre un import<input disabled={busy} type="file" accept="image/*" multiple onChange={restore}/></label>
   <button disabled={busy||!items.length} onClick={()=>process('analyze')}>Analyser / Réessayer</button>
   <button disabled={busy||!items.some(i=>i.recognition&&!i.resultId)} onClick={()=>process('upload')}>Importer tous les originaux analysés</button>
   {busy&&<><button onClick={()=>{paused?control.current?.resume():control.current?.pause();setPaused(!paused);}}>{paused?'Reprendre':'Pause'}</button><button onClick={()=>control.current?.cancel()}>Arrêter les fichiers en attente</button></>}
   {onReview&&counts.imported>0&&<button onClick={onReview}>Ouvrir À valider</button>}
  </div>
  <div className="review-counters"><span>Sélectionnées <b>{items.length}</b></span><span>Importées <b>{counts.imported}</b></span><span>Auto-reconnues <b>{counts.automatic}</b></span><span>À valider <b>{counts.review}</b></span><span>Non identifiées <b>{counts.unidentified}</b></span><span>Validées <b>0</b></span><span>Erreurs <b>{counts.errors}</b></span></div>
  {catalog&&selected.length>0&&<ImportBatchDecision catalog={catalog} onApply={bulk} disabled={busy}/>}
  <div className="review-grid">{visible.map(item=><article key={item.id}>
   <label><input type="checkbox" checked={Boolean(item.selected)} disabled={busy||Boolean(item.resultId)} onChange={e=>change(item.id,{selected:e.target.checked})}/> Sélectionner</label>
   <ImportPhotoPreview photo={preview(item)} onClick={()=>{setOpened(item.id);setZoom(1);setRotation(0);}}/>
   <div className="review-card-body"><strong>{item.originalFilename}</strong><p>{item.resultId?'Original importé':item.recognition?.ready?'Prête à confirmer':item.recognition?.unidentified?'À valider — non identifiée':item.recognition?'À valider':'À analyser'}</p><p>{item.recognition?.values.support||'Support à identifier'}</p>{item.error&&<p role="alert">{item.error}</p>}{item.ocrWarning&&<p>{item.ocrWarning}</p>}{item.referenceWarning&&<p>{item.referenceWarning}</p>}{item.suggestions?.length>0&&<p>Identifiants lus : {item.suggestions.map(s=>s.support_id).join(', ')}</p>}</div>
  </article>)}</div>
  <div className="mass-controls"><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Précédent</button><span>{page+1} / {Math.max(1,Math.ceil(items.length/12))}</span><button disabled={(page+1)*12>=items.length} onClick={()=>setPage(p=>p+1)}>Suivant</button>
   <button onClick={()=>download(errorCsv(items),'erreurs-import.csv')}>Exporter les erreurs</button><button onClick={()=>download(summaryCsv(importReport(items,{batchId,startedAt:started.current})),'resume-import.csv')}>Exporter le résumé</button>
  </div>
  {view&&<div className="review-viewer import-context-viewer" role="dialog" aria-modal="true" aria-label="Vérification de la photo"><button onClick={()=>setOpened(null)}>Fermer</button><div className="import-photo-pane"><ImportPhotoPreview photo={preview(view)} style={{transform:`rotate(${rotation}deg) scale(${zoom})`}}/><div><button onClick={()=>setZoom(z=>Math.min(4,z+.25))}>Zoom +</button><button onClick={()=>setZoom(z=>Math.max(.5,z-.25))}>Zoom −</button><button onClick={()=>setRotation(r=>r+90)}>Rotation</button><button disabled={items.indexOf(view)===0} onClick={()=>setOpened(items[items.indexOf(view)-1].id)}>Photo précédente</button><button disabled={items.indexOf(view)===items.length-1} onClick={()=>setOpened(items[items.indexOf(view)+1].id)}>Photo suivante</button></div></div>
   {catalog&&view.import_context?<PhotoImportContextEditor context={view.import_context} catalog={catalog} onChange={context=>updateContext(view,context)} disabled={busy||Boolean(view.resultId)}/>:<p>Analysez le lot pour obtenir les propositions.</p>}
  </div>}
 </section>;
}
