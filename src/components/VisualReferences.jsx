import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {addVisualReference,removeVisualReference,listReferenceVisuals,visualReferenceUrl} from '../services/visualReferenceService';

export function ReferencePreview({asset}){
 const [state,setState]=useState({path:'',url:''});
 useEffect(()=>{let live=true;const load=()=>visualReferenceUrl(asset).then(url=>{if(live)setState({path:asset.storage_path,url})}).catch(()=>{if(live)setState({path:asset.storage_path,url:''})});load();const timer=setInterval(load,270000);return()=>{live=false;clearInterval(timer)}},[asset.storage_path]);
 const url=state.path===asset.storage_path?state.url:'';
 return url?<a href={url} target="_blank" rel="noopener noreferrer" onClick={event=>event.stopPropagation()}>{asset.mime_type==='application/pdf'?`PDF — ${asset.name}`:<img className="infrastructure-thumbnail" src={url} alt={asset.name}/>}</a>:<span>{asset.name} — aperçu indisponible</span>;
}
export default function VisualReferences({visual,canManage=false,onChanged}){
 const [assets,setAssets]=useState(visual.reference_assets||[]),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const lock=useRef(false);
 const replacement=useRef(null),replacementInput=useRef(null);
 useEffect(()=>{setAssets(visual.reference_assets||[])},[visual.id,visual.reference_assets]);
 useEffect(()=>setMessage(''),[visual.id]);
 async function upload(event){
  const files=[...(event.target.files||[])];event.target.value='';if(!files.length||!canManage||lock.current)return;
  lock.current=true;setBusy(true);setMessage('');
  try{for(const file of files){const next=await addVisualReference(visual,file,replacement.current);setAssets(next)}await onChanged?.();setMessage('Références enregistrées.');}
  catch(error){setMessage(error.message)}finally{replacement.current=null;lock.current=false;setBusy(false)}
 }
 async function remove(asset){
  if(!canManage||lock.current||!window.confirm(`Supprimer la référence « ${asset.name} » ? L’original sera conservé dans l’historique.`))return;
  lock.current=true;setBusy(true);setMessage('');
  try{setAssets(await removeVisualReference(visual.id,asset.id));await onChanged?.();setMessage('Référence supprimée de la reconnaissance.');}
  catch(error){setMessage(error.message)}finally{lock.current=false;setBusy(false)}
 }
 return <section className="visual-references"><h3>Visuel générique de référence</h3><p>Photos ou PDF utilisés pour reconnaître ce visuel lors des imports.</p>
  <input ref={replacementInput} type="file" disabled={busy} hidden accept="image/jpeg,image/png,image/webp,application/pdf" onChange={upload}/>
  {assets.filter(asset=>!asset.archived).map(asset=><div key={asset.id}><ReferencePreview asset={asset}/><span>{asset.name} — {asset.mime_type==='application/pdf'?'PDF':asset.mime_type}</span><time dateTime={asset.created_at}>{asset.created_at?new Date(asset.created_at).toLocaleDateString('fr-CA'):''}</time>{canManage&&<><button type="button" disabled={busy} onClick={()=>{replacement.current=asset.id;replacementInput.current?.click();}}>Remplacer</button><button type="button" disabled={busy} onClick={()=>remove(asset)}>Supprimer la référence</button></>}</div>)}
  {!assets.some(asset=>!asset.archived)&&<p>Aucune référence ajoutée.</p>}
  {canManage&&<label>Ajouter des photos ou PDF<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple disabled={busy} onChange={e=>{replacement.current=null;upload(e);}}/></label>}
  {busy&&<p role="status">Analyse et enregistrement des références…</p>}{message&&<p role="status">{message}</p>}
 </section>;
}
const Catalog=createContext([]);
export function VisualReferenceProvider({scopeKey,previewTargetId,enabled=true,children}){
 const [state,setState]=useState({scope:null,rows:[]}),scope=`${scopeKey}:${previewTargetId||''}`;
 useEffect(()=>{let live=true;const load=()=>{if(enabled)listReferenceVisuals(previewTargetId).then(rows=>{if(live)setState({scope,rows})}).catch(()=>{if(live)setState({scope,rows:[]})})};load();window.addEventListener('tos-visual-references-updated',load);return()=>{live=false;window.removeEventListener('tos-visual-references-updated',load)}},[scope,enabled]);
 return <Catalog.Provider value={state.scope===scope?state.rows:[]}>{children}</Catalog.Provider>;
}
const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function GenericCampaignVisual({support,all=false}){
 const visuals=useContext(Catalog);
 const matches=visuals.filter(v=>String(v.client_id)===String(support.client_id)&&(support.visuel_id?String(v.id)===String(support.visuel_id):
  [support.visuel_campagne,support.visuel_en_expo].filter(Boolean).some(name=>normalized(name)===normalized(v.nom_visuel))&&
  [support.campagne_selon_visuel,support.campagne_actuelle].filter(Boolean).some(name=>normalized(name)===normalized(v.campagne?.nom_campagne))));
 const visual=matches.length===1?matches[0]:null;
 return <div><span>{support.visuel_campagne||visual?.nom_visuel||''}</span>{visual?.reference_assets?.filter(asset=>!asset.archived).slice(0,all?undefined:1).map(asset=><ReferencePreview key={asset.id} asset={asset}/>)}</div>;
}
