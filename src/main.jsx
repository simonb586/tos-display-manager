import React, {useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Search, Download, FileSpreadsheet, FileText, Camera, MapPin, ShieldCheck, Users, Menu, Smartphone, BarChart3, ClipboardList, Bell, Image as ImageIcon} from 'lucide-react';
import './styles.css';
import manifest from './data/manifest.json';
import infrastructures from './data/infrastructures.json';
import campagnes from './data/campagnes_et_visuels.json';
import repertoire from './data/repertoire_des_affiches.json';
import communications from './data/communications_operationnelles.json';
import enjeux from './data/enjeux_des_cadres_et_supports.json';
import ci from './data/centres_dinformation.json';
import ciEnjeux from './data/c_i_avec_enjeux.json';
import arrets from './data/liste_des_arrets.json';
import voitures from './data/voitures_trains.json';
import photos from './data/photos.json';
import bt from './data/bons_de_travail.json';
import histo from './data/historique_des_campagnes.json';
import edt from './data/suivi_des_edt.json';
import users from './data/utilisateurs.json';
import clients from './data/clients.json';
import journal from './data/journal_des_evenements.json';
import {strictMatches, downloadCSV, photoName, normalize} from './lib/utils';

const dataMap={
  'Infrastructures': infrastructures,
  'Campagnes et visuels': campagnes,
  'Répertoire des affiches': repertoire,
  'Communications opérationnelles': communications,
  'Enjeux des cadres et supports': enjeux,
  'Centres d’information': ci,
  'C.I. avec enjeux': ciEnjeux,
  'Liste des arrêts': arrets,
  'Voitures / trains': voitures,
  'Photos': photos,
  'Bons de travail': bt,
  'Historique des campagnes': histo,
  'Suivi des EDT': edt,
  'Utilisateurs': users,
  'Clients': clients,
  'Journal des événements': journal
};
const icons={'Infrastructures':'🏗️','Campagnes et visuels':'🎯','Répertoire des affiches':'📦','Photos':'📷','Bons de travail':'🛠️','Suivi des EDT':'📋','Enjeux des cadres et supports':'⚠️','Liste des arrêts':'🚏','Voitures / trains':'🚍','Clients':'🏢','Utilisateurs':'👥','Journal des événements':'🧾'};
const roles=['Administrateur','Coordonnateur','Installateur','Client-Admin','Client'];
function getCols(rows){return rows?.length?Object.keys(rows[0]):[]}
function Dashboard({setActive}){
 const totalInf=infrastructures.length, totalArr=arrets.length;
 const edtData=[{name:'EDT-DEMO-001',progress:0},{name:'EDT-1002',progress:41},{name:'EDT-1003',progress:68},{name:'EDT-1004',progress:92}];
 return <div className="dashboard">
  <div className="hero"><div><h1>TOS Display Manager <span>V0.6 Préproduction</span></h1><p>Fondations branchées pour portail.groupetos.com : tables, recherche exacte, exports, EDT, photos et application terrain.</p></div><div className="badge"><ShieldCheck/> Supabase prêt</div></div>
  <div className="cards">
   <Card title="Infrastructures" value={totalInf} icon={<ClipboardList/>}/><Card title="Arrêts" value={totalArr} icon={<MapPin/>}/><Card title="Tables visibles" value={manifest.length} icon={<Menu/>}/><Card title="Rôles" value={roles.length} icon={<Users/>}/>
  </div>
  <div className="grid2">
   <section className="panel"><h2><BarChart3/> Avancement des EDT</h2>{edtData.map(e=><div className="progress" key={e.name}><span>{e.name}</span><div><i style={{width:e.progress+'%'}}></i></div><b>{e.progress}%</b></div>)}<button onClick={()=>setActive('Suivi des EDT')}>Ouvrir le suivi des EDT</button></section>
   <section className="panel"><h2><Bell/> Exigences V0.6 incluses</h2><ul className="checks"><li>Connexion sans création publique de compte</li><li>Recherche stricte sans faux résultats</li><li>Exports : table complète, résultats filtrés, rapport client avec photo</li><li>Photos nommées par Support ID + date + action</li><li>Application terrain : Infrastructures ou Arrêts</li></ul></section>
  </div>
 </div>
}
function Card({title,value,icon}){return <div className="card">{icon}<span>{title}</span><strong>{value}</strong></div>}
function TableView({name}){
 const rows=dataMap[name]||[]; const cols=getCols(rows); const [query,setQuery]=useState(''); const [filters,setFilters]=useState({}); const [selected,setSelected]=useState(null);
 const filtered=useMemo(()=>rows.filter(r=>strictMatches(r,query,cols)).filter(r=>Object.entries(filters).every(([c,v])=>!v||normalize(r[c]).includes(normalize(v)))) ,[rows,query,filters,cols]);
 const shown=filtered.slice(0,200);
 return <div className="tablePage">
  <header className="pageHead"><div><h1>{icons[name]||'📋'} {name}</h1><p>{filtered.length.toLocaleString('fr-CA')} résultat(s) sur {rows.length.toLocaleString('fr-CA')} ligne(s). Affichage limité à 200 lignes pour la rapidité.</p></div><div className="actions"><button onClick={()=>downloadCSV(`${name}_table_complete.csv`,rows,cols)}><Download/> Table complète</button><button onClick={()=>downloadCSV(`${name}_resultats_filtres.csv`,filtered,cols)}><FileSpreadsheet/> Résultats filtrés</button><button onClick={()=>alert('Rapport client illustré : structure prévue V0.6.1 avec photo principale par ligne + ZIP photos.') }><FileText/> Rapport client avec photo</button></div></header>
  <div className="searchbar"><Search/><input placeholder="Recherche exacte dans toutes les colonnes..." value={query} onChange={e=>setQuery(e.target.value)}/></div>
  <div className="tableWrap"><table><thead><tr>{cols.map(c=><th key={c}>{c}<input placeholder="Filtrer" value={filters[c]||''} onChange={e=>setFilters({...filters,[c]:e.target.value})}/></th>)}</tr></thead><tbody>{shown.map((r,i)=><tr key={i} onClick={()=>setSelected(r)}>{cols.map(c=><td key={c}>{String(r[c]??'').slice(0,160)}</td>)}</tr>)}</tbody></table></div>
  {selected&&<Detail name={name} row={selected} onClose={()=>setSelected(null)}/>} 
 </div>
}
function Detail({name,row,onClose}){ const cols=Object.keys(row); const support=row['Support ID']||row['Related Support']||row['#Du cadre']||row["# d'Arrêt"]||''; return <div className="drawer"><div className="drawerPanel"><button className="close" onClick={onClose}>×</button><h2>Fiche 360° — {name}</h2>{support&&<div className="support">Identifiant : <b>{support}</b></div>}<div className="detailGrid">{cols.map(c=><div key={c}><label>{c}</label><p>{row[c]||'—'}</p></div>)}</div>{name==='Infrastructures'&&<div className="relationBox"><h3>Relations prévues</h3><p>Campagnes, Photos, Bons de travail, Suivi des EDT, Historique, Enjeux, Répertoire des affiches.</p><button onClick={()=>alert('Carte interactive générée depuis Latitude/Longitude lorsque disponibles.')}>Ouvrir la carte</button></div>}</div></div>}
function MobileApp(){
 const [source,setSource]=useState('Infrastructures'); const [id,setId]=useState(''); const [action,setAction]=useState('installation'); const [msg,setMsg]=useState('');
 const rows=source==='Infrastructures'?infrastructures:arrets; const idField=source==='Infrastructures'?'Support ID':"# d'Arrêt"; const support=rows.find(r=>normalize(r[idField])===normalize(id));
 const format=support?.["Formats d'affichage"]||support?.['Type de support']||''; const compatible=campagnes.filter(c=>!format||normalize(JSON.stringify(c)).includes(normalize(format))).slice(0,20);
 function submit(){ if(!support){setMsg('Aucun résultat trouvé.'); return} setMsg(`Simulation enregistrée : ${photoName(id,action,1)}. Le moteur mettra à jour Infrastructures/Arrêts, Photos, EDT, Historique et Répertoire.`)}
 return <div className="mobileMock"><div className="phone"><h2>Application terrain</h2><label>Type de recherche</label><select value={source} onChange={e=>{setSource(e.target.value);setId('');setMsg('')}}><option>Infrastructures</option><option>Arrêts</option></select><label>{source==='Infrastructures'?'Support ID':'No d’arrêt'}</label><input value={id} onChange={e=>setId(e.target.value)} placeholder="Entrer l'identifiant"/>{support&&<div className="found"><b>Trouvé</b><span>{support['Emplacement/Visibilité']||support['Emplacement']||support['Site']||'Fiche trouvée'}</span><small>Format/type : {format||'non défini'}</small></div>}<label>Nouveau visuel compatible</label><select><option>Choisir un visuel</option>{compatible.map((c,i)=><option key={i}>{c['Visuel terrain de la campagne en exposition']||c['Nom de la campagne']||`Visuel ${i+1}`}</option>)}</select><label>Action photo</label><select value={action} onChange={e=>setAction(e.target.value)}><option>installation</option><option>inspection</option><option>enjeu</option><option>photo</option></select><button className="photo"><Camera/> Prendre / joindre une photo</button><button onClick={submit}>Terminer et synchroniser</button>{msg&&<p className="msg">{msg}</p>}<nav><span>Support</span><span>Photos</span><span>Enjeux</span><span>Profil</span></nav></div></div>
}
function LoginMock(){return <div className="login"><div className="loginCard"><h1>TOS Display Manager</h1><p>Connexion sécurisée — les comptes sont créés par un administrateur seulement.</p><input placeholder="Courriel"/><input placeholder="Mot de passe" type="password"/><button>Se connecter</button><small>Rôles : Administrateur, Coordonnateur, Installateur, Client-Admin, Client.</small></div></div>}
function App(){ const [active,setActive]=useState('Tableau de bord'); const [role,setRole]=useState('Administrateur'); const items=['Tableau de bord','Connexion','Application terrain',...manifest.map(m=>m.name)]; return <div className="app"><aside><div className="brand">TOS<span>Display Manager</span></div><select value={role} onChange={e=>setRole(e.target.value)}>{roles.map(r=><option key={r}>{r}</option>)}</select>{items.map(it=><button key={it} className={active===it?'active':''} onClick={()=>setActive(it)}>{it==='Tableau de bord'?'📊':it==='Connexion'?'🔐':it==='Application terrain'?'📱':(icons[it]||'📋')} {it}</button>)}</aside><main>{active==='Tableau de bord'?<Dashboard setActive={setActive}/>:active==='Connexion'?<LoginMock/>:active==='Application terrain'?<MobileApp/>:<TableView name={active}/>}</main></div>}

createRoot(document.getElementById('root')).render(<App/>);
