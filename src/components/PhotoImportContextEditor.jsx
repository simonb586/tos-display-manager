import React,{useEffect,useState} from 'react';
import PhotoImage from './PhotoImage';
import {recognizeImportPhoto} from '../lib/photoImportRecognition';
const labels={support:'Support',date:'Date',type:'Type',edt:'EDT',phase:'Phase',campaign:'Campagne / communication',visual:'Visuel'};
const statuses={AUTO_CONFIRMED:'Confirmé automatiquement',MANUAL_CONFIRMED:'Confirmé manuellement',TO_REVIEW:'À valider',NOT_APPLICABLE:'Sans objet'};
export function ImportPhotoPreview({photo,style,onClick}) {
 const [url,setUrl]=useState(null);
 useEffect(()=>{if(!photo.file)return;const next=URL.createObjectURL(photo.file);setUrl(next);return()=>URL.revokeObjectURL(next);},[photo.file]);
 const name=photo.originalFilename||photo.original_filename||photo.nom_fichier;
 return <button type="button" className="photo-review-image" onClick={onClick} aria-label={`Agrandir ${name}`}>
  {photo.file?<img src={url||undefined} alt={name} loading="lazy" style={style}/>:<PhotoImage photo={photo} alt={name} loading="lazy" style={style}/>}
 </button>;
}
export function updateImportManual(context,catalog,patch) {
 const manual={...context.manual,...patch};
 if(Object.hasOwn(patch,'support'))for(const key of ['edt','phase','campaign','visual'])if(!Object.hasOwn(patch,key))delete manual[key];
 if(Object.hasOwn(patch,'edt'))for(const key of ['phase','campaign','visual','withoutEdt'])if(!Object.hasOwn(patch,key))delete manual[key];
 if(Object.hasOwn(patch,'campaign')&&!Object.hasOwn(patch,'visual'))delete manual.visual;
 if(patch.withoutEdt){delete manual.edt;delete manual.phase;manual.type='installation';}
 for(const key of Object.keys(manual))if(manual[key]===''||manual[key]===undefined)delete manual[key];
 return {...context,manual,recognition:recognizeImportPhoto(context.input,catalog,manual)};
}
export default function PhotoImportContextEditor({context,catalog,onChange,disabled=false}) {
 const r=context.recognition,v=r.values,c=r.candidates;
 const [supportTerm,setSupportTerm]=useState(context.manual?.support||v.support||'');
 useEffect(()=>setSupportTerm(context.manual?.support||v.support||''),[context.manual?.support,v.support]);
 const change=patch=>onChange(updateImportManual(context,catalog,patch));
 const options=(key,rows,label)=> <label>{labels[key]}<select aria-label={labels[key]} value={v[key]??''} onChange={e=>change({[key]:e.target.value})}><option value="">À valider</option>{(rows||[]).map(row=><option key={row.id} value={row.id}>{label(row)}</option>)}</select></label>;
 const localDate=v.date?new Date(new Date(v.date).getTime()-new Date(v.date).getTimezoneOffset()*60000).toISOString().slice(0,16):'';
 const supportMatches=supportTerm.length>=2?(catalog.supports||[]).filter(s=>[s.support_id,s.site,s.emplacement_visibilite].join(' ').toLocaleLowerCase('fr').includes(supportTerm.toLocaleLowerCase('fr'))).slice(0,12):[];
 return <fieldset disabled={disabled} className="import-context-fields"><legend>Contexte de la photo</legend>
  <div className="import-confirmed-fields">{Object.entries(r.states).map(([key,state])=><span key={key} data-validation-field={key} data-validation-state={state}><b>{labels[key]}</b> : {statuses[state]}</span>)}</div>
  <label>Rechercher un support<input aria-label="Rechercher un support" value={supportTerm} onChange={e=>setSupportTerm(e.target.value)} placeholder="Numéro ou emplacement"/></label>
  <div className="support-results">{supportMatches.map(s=><button type="button" key={s.support_id} onClick={()=>change({support:s.support_id})}>{s.support_id} — {s.site}</button>)}</div>
  <label>Date détectée ({r.dateSource})<input aria-label="Date de la photo" type="datetime-local" value={localDate} onChange={e=>{if(e.target.value)change({date:new Date(e.target.value).toISOString()});}}/></label>
  {v.date&&r.states.date==='TO_REVIEW'&&<button type="button" onClick={()=>change({date:v.date})}>Confirmer cette date</button>}
  <label>Type<select aria-label="Type d’intervention" value={v.type||''} onChange={e=>change({type:e.target.value})}><option value="">À valider</option>{['installation','retrait','inspection','enjeu','photo'].map(t=><option key={t} value={t}>{t[0].toUpperCase()+t.slice(1)}</option>)}</select></label>
  <label><input type="checkbox" checked={Boolean(context.manual?.withoutEdt)} onChange={e=>change({withoutEdt:e.target.checked})}/> Installation sans EDT</label>
  {!v.withoutEdt&&!['inspection','enjeu','photo'].includes(v.type)&&<>
   {options('edt',c.edt,e=>e.no_edt)}
   {options('phase',(c.phase||[]).filter(p=>!v.edt||String(p.edt_id)===String(v.edt)),p=>`${p.phase_type} — ${p.date_debut_prevue||p.date_debut_reelle||'Date non définie'}`)}
  </>}
  {!['inspection','enjeu','photo'].includes(v.type)&&<>
   {options('campaign',c.campaign,row=>`${row.nom_campagne} — ${row.business_context==='operational_communication'?'Communication':'Marketing'}`)}
   {options('visual',c.visual,row=>`${row.campaign_name?row.campaign_name+' — ':''}${row.nom_visuel} — ${row.is_out_of_frame?'Hors-Cadre':row.format_support}`)}
  </>}
  <p>{r.ready?'Prête à confirmer':`À valider : ${r.pending.map(key=>labels[key]).join(', ')}`}</p>
 </fieldset>;
}

export function ImportBatchDecision({catalog,onApply,disabled=false}) {
 const [decision,setDecision]=useState({});
 return <fieldset disabled={disabled} className="import-batch-decision"><legend>Confirmer la sélection en lot</legend>
  <p>Chaque photo conserve son support individuel.</p>
  <label>EDT<select value={decision.edt||''} onChange={e=>setDecision({...decision,edt:e.target.value})}><option value="">Conserver</option>{catalog.edts.map(e=><option key={e.id} value={e.id}>{e.no_edt}</option>)}</select></label>
  <label>Type<select value={decision.type||''} onChange={e=>setDecision({...decision,type:e.target.value})}><option value="">Conserver</option>{['installation','retrait','inspection','enjeu','photo'].map(t=><option key={t}>{t}</option>)}</select></label>
  <label>Campagne / communication<select value={decision.campaign||''} onChange={e=>setDecision({...decision,campaign:e.target.value})}><option value="">Conserver</option>{catalog.campaigns.map(c=><option key={c.id} value={c.id}>{c.nom_campagne}</option>)}</select></label>
  <label>Visuel<select value={decision.visual||''} onChange={e=>setDecision({...decision,visual:e.target.value})}><option value="">Conserver</option>{catalog.visuals.map(v=><option key={v.id} value={v.id}>{v.nom_visuel}</option>)}</select></label>
  <button type="button" onClick={()=>onApply(Object.fromEntries(Object.entries(decision).filter(([,value])=>value!=='')))}>Appliquer à la sélection</button>
 </fieldset>;
}
