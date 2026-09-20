import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {addVisualReference,listReferenceVisuals,visualReferenceUrl} from '../services/visualReferenceService';

function ReferencePreview({asset}){
 const [state,setState]=useState({path:'',url:''});
 useEffect(()=>{let live=true;const load=()=>visualReferenceUrl(asset).then(url=>{if(live)setState({path:asset.storage_path,url})}).catch(()=>{if(live)setState({path:asset.storage_path,url:''})});load();const timer=setInterval(load,270000);return()=>{live=false;clearInterval(timer)}},[asset.storage_path]);
 const url=state.path===asset.storage_path?state.url:'';
 return url?<a href={url} target="_blank" rel="noopener noreferrer" onClick={event=>event.stopPropagation()}>{asset.mime_type==='application/pdf'?`PDF — ${asset.name}`:<img className="infrastructure-thumbnail" src={url} alt={asset.name}/>}</a>:<span>{asset.name} — aperçu indisponible</span>;
}
export default function VisualReferences({visual,canManage=false,onChanged}){
 const [assets,setAssets]=useState(visual.reference_assets||[]),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const lock=useRef(false);
 useEffect(()=>{setAssets(visual.reference_assets||[]);setMessage('')},[visual.id,visual.reference_assets]);
 async function upload(event){
  const files=[...(event.target.files||[])];event.target.value='';if(!files.length||!canManage||lock.current)return;
  lock.current=true;setBusy(true);setMessage('');
  try{for(const file of files){const next=await addVisualReference(visual,file);setAssets(next)}onChanged?.();setMessage('Références enregistrées.');}
  catch(error){setMessage(error.message)}finally{lock.current=false;setBusy(false)}
 }
 return <section className="visual-references"><h3>Visuels génériques de référence</h3><p>Photos ou PDF utilisés pour reconnaître ce visuel lors des imports.</p>
  {assets.map(asset=><ReferencePreview key={asset.id} asset={asset}/>)}
  {!assets.length&&<p>Aucune référence ajoutée.</p>}
  {canManage&&<label>Ajouter des photos ou PDF<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple disabled={busy} onChange={upload}/></label>}
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
export function GenericCampaignVisual({support}){
 const visuals=useContext(Catalog);
 const matches=visuals.filter(v=>String(v.client_id)===String(support.client_id)&&(support.visuel_id?String(v.id)===String(support.visuel_id):
  [support.visuel_campagne,support.visuel_en_expo].filter(Boolean).some(name=>normalized(name)===normalized(v.nom_visuel))&&
  [support.campagne_selon_visuel,support.campagne_actuelle].filter(Boolean).some(name=>normalized(name)===normalized(v.campagne?.nom_campagne))));
 const visual=matches.length===1?matches[0]:null;
 return <div><span>{support.visuel_campagne||visual?.nom_visuel||''}</span>{visual?.reference_assets?.slice(0,1).map(asset=><ReferencePreview key={asset.id} asset={asset}/>)}</div>;
}
