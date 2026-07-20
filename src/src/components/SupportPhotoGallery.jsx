import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckSquare, Download, Image, Square, Star, Trash2, X } from 'lucide-react';
import {
  deleteSupportPhoto, deleteSupportPhotos, downloadPhoto, downloadPhotosZip,
  listSupportPhotos, makeSupportPhotoPrimary
} from '../services/photoLibraryService';

export default function SupportPhotoGallery({ supportId, canDelete=false, canManage=false }) {
  const [photos,setPhotos]=useState([]);
  const [selected,setSelected]=useState(null);
  const [checked,setChecked]=useState({});
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [filter,setFilter]=useState({type:'',status:'',text:''});

  const refresh=useCallback(async()=>{
    if(!supportId)return;
    setMessage('');
    try{setPhotos(await listSupportPhotos(supportId));}
    catch(error){setMessage(error.message||'Impossible de charger les photos.');}
  },[supportId]);

  useEffect(()=>{refresh();},[refresh]);

  const filtered=useMemo(()=>photos.filter(photo=>{
    const text=`${photo.nom_fichier||''} ${photo.type_photo||''} ${photo.statut_validation||''}`.toLowerCase();
    return (!filter.type||photo.type_photo===filter.type)
      &&(!filter.status||photo.statut_validation===filter.status)
      &&(!filter.text||text.includes(filter.text.toLowerCase()));
  }),[photos,filter]);

  const selectedPhotos=photos.filter(p=>checked[p.id]);
  const types=[...new Set(photos.map(p=>p.type_photo).filter(Boolean))];
  const statuses=[...new Set(photos.map(p=>p.statut_validation).filter(Boolean))];

  async function run(label,action){
    setBusy(true);setMessage('');
    try{await action();await refresh();setChecked({});setSelected(null);setMessage(label);}
    catch(error){setMessage(error.message||'Opération impossible.');}
    finally{setBusy(false);}
  }
  const removeOne=photo=>{
    if(!window.confirm(`Supprimer définitivement la photo « ${photo.nom_fichier||photo.id} » ?`))return;
    run('Photo supprimée avec succès.',()=>deleteSupportPhoto(photo));
  };
  const removeSelected=()=>{
    if(!selectedPhotos.length)return;
    if(!window.confirm(`Supprimer définitivement ${selectedPhotos.length} photo(s) ?`))return;
    run(`${selectedPhotos.length} photo(s) supprimée(s).`,()=>deleteSupportPhotos(selectedPhotos));
  };
  const toggle=id=>setChecked(current=>({...current,[id]:!current[id]}));

  return <section className="support-gallery">
    <div className="support-gallery-heading">
      <div><h3><Image size={18}/> Galerie du support</h3><small>{photos.length} photo(s)</small></div>
      <div className="support-gallery-toolbar">
        <button type="button" disabled={busy||!photos.length} onClick={()=>run('Téléchargement ZIP lancé.',()=>downloadPhotosZip(selectedPhotos.length?selectedPhotos:filtered,supportId))}><Download size={16}/> ZIP</button>
        {canDelete&&<button type="button" className="danger" disabled={busy||!selectedPhotos.length} onClick={removeSelected}><Trash2 size={16}/> Supprimer la sélection ({selectedPhotos.length})</button>}
      </div>
    </div>

    <div className="support-gallery-filters">
      <input placeholder="Rechercher une photo…" value={filter.text} onChange={e=>setFilter({...filter,text:e.target.value})}/>
      <select value={filter.type} onChange={e=>setFilter({...filter,type:e.target.value})}><option value="">Tous les types</option>{types.map(x=><option key={x}>{x}</option>)}</select>
      <select value={filter.status} onChange={e=>setFilter({...filter,status:e.target.value})}><option value="">Tous les statuts</option>{statuses.map(x=><option key={x}>{x}</option>)}</select>
    </div>

    {message&&<p className="v07-message" role="status">{message}</p>}
    <div className="support-gallery-grid">
      {filtered.map(photo=><article className={`support-gallery-item ${checked[photo.id]?'selected':''}`} key={photo.id}>
        <button className="support-gallery-check" type="button" onClick={()=>toggle(photo.id)} aria-label="Sélectionner la photo">
          {checked[photo.id]?<CheckSquare size={20}/>:<Square size={20}/>}
        </button>
        {(photo.est_principale||photo.photo_url===photos.find(x=>x.est_principale)?.photo_url)&&<span className="primary-badge"><Star size={13}/> Principale</span>}
        <button className="support-gallery-open" type="button" onClick={()=>setSelected(photo)}>
          <img src={photo.thumbnail_url||photo.photo_url} alt={photo.nom_fichier||'Photo du support'}/>
          <span>{photo.prise_le?new Date(photo.prise_le).toLocaleDateString('fr-CA'):'Date inconnue'}</span>
          <small>{photo.type_photo||'Photo'} · {photo.statut_validation||'Non validée'}</small>
        </button>
        <div className="support-gallery-item-actions">
          <button type="button" disabled={busy} onClick={()=>downloadPhoto(photo)}><Download size={15}/> Télécharger</button>
          {canManage&&<button type="button" disabled={busy} onClick={()=>run('Photo principale mise à jour.',()=>makeSupportPhotoPrimary(photo))}><Star size={15}/> Principale</button>}
          {canDelete&&<button type="button" className="danger" disabled={busy} onClick={()=>removeOne(photo)}><Trash2 size={15}/> Supprimer</button>}
        </div>
      </article>)}
      {!filtered.length&&!message&&<p>Aucune photo associée à ce support.</p>}
    </div>

    {selected&&<div className="photo-lightbox" role="dialog" aria-modal="true">
      <button type="button" className="close" onClick={()=>setSelected(null)} aria-label="Fermer"><X/></button>
      <img src={selected.photo_url} alt={selected.nom_fichier||'Photo du support'}/>
      <div className="photo-lightbox-info">
        <strong>{selected.nom_fichier||'Photo'}</strong>
        <span>{selected.prise_le?new Date(selected.prise_le).toLocaleString('fr-CA'):'Date inconnue'}</span>
        <span>{selected.type_photo||'Photo'} · {selected.statut_validation||'Non validée'}</span>
        <button type="button" onClick={()=>downloadPhoto(selected)}><Download size={16}/> Télécharger</button>
        {canManage&&<button type="button" onClick={()=>run('Photo principale mise à jour.',()=>makeSupportPhotoPrimary(selected))}><Star size={16}/> Définir comme principale</button>}
        {canDelete&&<button type="button" className="danger" onClick={()=>removeOne(selected)}><Trash2 size={16}/> Supprimer cette photo</button>}
      </div>
    </div>}
  </section>;
}
