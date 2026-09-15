import React,{useMemo,useState} from 'react';
import PhotoImage from './PhotoImage';
import {photoFolders} from '../lib/photoFolders';
import {getSignedDownloadUrl} from '../services/photoAccessService';

export default function PhotoFolderGallery({photos,renderActions,onOpenSupport,canDownload=true}) {
 const [folder,setFolder]=useState(''),[query,setQuery]=useState(''),[type,setType]=useState(''),[sort,setSort]=useState('recent'),[opened,setOpened]=useState(null),[zoom,setZoom]=useState(1),[error,setError]=useState('');
 const folders=useMemo(()=>photoFolders(photos),[photos]);
 const selected=folders.find(f=>f.key===folder);
 const rows=(selected?.photos||photos).filter(p=>(!type||p.type_photo===type)&&[p.normalized_filename,p.nom_fichier,p.support_id,p.edt_number,p.campagne?.nom_campagne,p.visuel?.nom_visuel,p.utilisateur].join(' ').toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr'))).sort((a,b)=>sort==='name'?String(a.normalized_filename||a.nom_fichier||'').localeCompare(b.normalized_filename||b.nom_fichier||'','fr',{numeric:true}):(sort==='oldest'?1:-1)*(new Date(a.prise_le||a.created_at)-new Date(b.prise_le||b.created_at)));
 const searching=Boolean(query||type);
 async function download(photo){try{const url=await getSignedDownloadUrl(photo);const a=document.createElement('a');a.href=url;a.rel='noopener';a.target='_blank';a.click();}catch(e){setError(e.message);}}
 return <section aria-label="Dossiers photos">
  <div className="editor-tabs"><button onClick={()=>setFolder('')}>Tous les dossiers</button>{selected&&<strong>{selected.label}</strong>}</div>
  <div className="v74-form"><label>Rechercher<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label><label>Type<select value={type} onChange={e=>setType(e.target.value)}><option value="">Tous les types</option>{[...new Set(photos.map(p=>p.type_photo).filter(Boolean))].map(t=><option key={t}>{t}</option>)}</select></label><label>Tri<select value={sort} onChange={e=>setSort(e.target.value)}><option value="recent">Plus récentes</option><option value="oldest">Plus anciennes</option><option value="name">Nom canonique</option></select></label></div>
  {error&&<p role="alert">{error}</p>}
  {!selected&&!searching?<div className="photo-review-grid">{folders.map(f=><button key={f.key} onClick={()=>setFolder(f.key)} aria-label={`Ouvrir ${f.label}`}><strong>📁 {f.label}</strong><span> — {f.photos.length} photos</span></button>)}</div>:<div className="photo-review-grid">{rows.map(photo=><article key={photo.id}>
   <button className="photo-review-image" onClick={()=>{setOpened(photo);setZoom(1);}} aria-label={`Ouvrir ${photo.normalized_filename||photo.nom_fichier}`}><PhotoImage loading="lazy" photo={photo} alt={photo.normalized_filename||photo.nom_fichier}/></button>
   <div className="photo-review-body"><strong>{photo.normalized_filename||photo.nom_fichier}</strong>{onOpenSupport?<button onClick={()=>onOpenSupport(photo.support_id)}>{photo.support_id}</button>:<span>{photo.support_id}</span>}<small>{photo.prise_le?new Date(photo.prise_le).toLocaleString('fr-CA'):''} — {photo.type_photo}</small><span>{photo.edt_number||photo.metadata?.edt_number}</span><span>{photo.campagne?.nom_campagne} — {photo.visuel?.nom_visuel}</span>{photo.utilisateur&&<small>{photo.utilisateur}</small>}{renderActions?.(photo)}</div>
  </article>)}{!rows.length&&<p>Aucune photo dans ce dossier pour ces filtres.</p>}</div>}
  {opened&&<div className="modal" role="dialog" aria-modal="true" aria-label="Photo agrandie" style={{position:'fixed',inset:0,zIndex:2000,background:'rgba(0,0,0,.9)',overflow:'auto',padding:24,color:'white'}}><button onClick={()=>setOpened(null)} autoFocus>Fermer</button><button onClick={()=>setZoom(z=>Math.min(z+.5,4))}>Zoom +</button><button onClick={()=>setZoom(z=>Math.max(z-.5,.5))}>Zoom −</button>{canDownload&&<button onClick={()=>download(opened)}>Télécharger</button>}<h2>{opened.normalized_filename||opened.nom_fichier}</h2><PhotoImage photo={opened} alt={opened.nom_fichier} style={{width:`${zoom*80}%`,maxWidth:'none',height:'auto'}}/></div>}
 </section>;
}
