import React,{useEffect,useState} from 'react';
import {listPreviewUsers,loadPreviewProfile} from '../services/businessParityService';
import {setUserViewPreview} from '../lib/userViewPreview';

export default function UserViewPreview({onClose}) {
 const [users,setUsers]=useState([]),[target,setTarget]=useState(null),[error,setError]=useState('');
 useEffect(()=>{let live=true;listPreviewUsers().then(rows=>{if(live)setUsers(rows)}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[]);
 return <div className="ca-modal"><section className="ca-dialog ca-preview ca-preview-live">
  <header><h2>Voir en tant que</h2><button onClick={onClose}>Fermer</button></header>
  <label>Utilisateur<select value={target?.id||''} onChange={event=>setTarget(users.find(user=>String(user.id)===event.target.value)||null)}>
   <option value="">Choisir un utilisateur actif</option>
   {users.map(user=><option key={user.id} value={user.id}>{user.name} — {user.role}</option>)}
  </select></label>
  {error&&<p role="alert">{error}</p>}
  {target&&<button onClick={async()=>{try{const profile=await loadPreviewProfile(target.id);if(!profile)throw Error('Utilisateur inactif.');setUserViewPreview(profile);}catch(e){setError(e.message)}}}>Ouvrir sa vue réelle</button>}
 </section></div>;
}
