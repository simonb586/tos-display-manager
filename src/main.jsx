import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Search, Download, FileSpreadsheet, FileText, Camera, MapPin, ShieldCheck, Users, Menu, BarChart3, ClipboardList, Bell, Lock, LogOut } from 'lucide-react';
import './styles.css';
import manifest from './data/manifest.json';
import infrastructuresJson from './data/infrastructures.json';
import campagnesJson from './data/campagnes_et_visuels.json';
import repertoireJson from './data/repertoire_des_affiches.json';
import communicationsJson from './data/communications_operationnelles.json';
import enjeuxJson from './data/enjeux_des_cadres_et_supports.json';
import ciJson from './data/centres_dinformation.json';
import ciEnjeuxJson from './data/c_i_avec_enjeux.json';
import arretsJson from './data/liste_des_arrets.json';
import voituresJson from './data/voitures_trains.json';
import photosJson from './data/photos.json';
import btJson from './data/bons_de_travail.json';
import histoJson from './data/historique_des_campagnes.json';
import edtJson from './data/suivi_des_edt.json';
import usersJson from './data/utilisateurs.json';
import clientsJson from './data/clients.json';
import journalJson from './data/journal_des_evenements.json';
import { strictMatches, downloadCSV, photoName, normalize } from './lib/utils';
import { supabase, supabaseConfigured } from './lib/supabaseClient';
import { loadManyTables } from './services/dataService';

const tableConfig = {
  'Infrastructures': { table: 'infrastructures', fallback: infrastructuresJson, idField: 'support_id', labelField: 'emplacement_visibilite' },
  'Campagnes et visuels': { table: 'campagnes_et_visuels', fallback: campagnesJson },
  'Répertoire des affiches': { table: 'repertoire_des_affiches', fallback: repertoireJson },
  'Communications opérationnelles': { table: 'communications_operationnelles', fallback: communicationsJson },
  'Enjeux des cadres et supports': { table: 'enjeux_des_cadres_et_supports', fallback: enjeuxJson },
  'Centres d’information': { table: 'centres_dinformation', fallback: ciJson },
  'C.I. avec enjeux': { table: 'ci_avec_enjeux', fallback: ciEnjeuxJson },
  'Liste des arrêts': { table: 'liste_des_arrets', fallback: arretsJson, idField: 'no_arret', labelField: 'emplacement_visibilite' },
  'Voitures / trains': { table: 'voitures_trains', fallback: voituresJson },
  'Photos': { table: 'photos', fallback: photosJson },
  'Bons de travail': { table: 'bons_de_travail', fallback: btJson },
  'Historique des campagnes': { table: 'historique_des_campagnes', fallback: histoJson },
  'Suivi des EDT': { table: 'suivi_des_edt', fallback: edtJson },
  'Utilisateurs': { table: 'utilisateurs', fallback: usersJson },
  'Clients': { table: 'clients', fallback: clientsJson },
  'Journal des événements': { table: 'journal_des_evenements', fallback: journalJson }
};

const icons = { 'Infrastructures':'🏗️','Campagnes et visuels':'🎯','Répertoire des affiches':'📦','Photos':'📷','Bons de travail':'🛠️','Suivi des EDT':'📋','Enjeux des cadres et supports':'⚠️','Liste des arrêts':'🚏','Voitures / trains':'🚍','Clients':'🏢','Utilisateurs':'👥','Journal des événements':'🧾' };
const roles = ['Administrateur','Coordonnateur','Installateur','Client-Admin','Client'];
const getCols = (rows) => rows?.length ? Object.keys(rows[0]).filter(c => !['raw_data','created_at','updated_at'].includes(c)) : [];
const getRows = (dataStore, name) => dataStore?.[name]?.rows || tableConfig[name]?.fallback || [];
const sourceLabel = (dataStore, name) => dataStore?.[name]?.source || 'json';

function Dashboard({ setActive, dataStore }) {
  const infrastructures = getRows(dataStore, 'Infrastructures');
  const arrets = getRows(dataStore, 'Liste des arrêts');
  const edt = getRows(dataStore, 'Suivi des EDT');
  const bt = getRows(dataStore, 'Bons de travail');
  const edtData = edt.length ? edt.slice(0, 6).map((e, i) => ({ name: e.no_edt || e['No EDT'] || `EDT-${i+1}`, progress: Number(e.avancement ?? e['Avancement'] ?? 0) || 0 })) : [{name:'EDT-DEMO-001',progress:0}];
  return <div className="dashboard">
    <div className="hero"><div><h1>TOS Display Manager <span>Blocs 1-2-3</span></h1><p>Base Supabase, recherche Infrastructure/Arrêt, première authentification et rôles.</p></div><div className="badge"><ShieldCheck/> {supabaseConfigured ? 'Supabase configuré' : 'Mode JSON local'}</div></div>
    <div className="cards"><Card title="Infrastructures" value={infrastructures.length}/><Card title="Arrêts" value={arrets.length}/><Card title="EDT" value={edt.length}/><Card title="Bons de travail" value={bt.length}/></div>
    <div className="grid2"><section className="panel"><h2><BarChart3/> Avancement des EDT</h2>{edtData.map(e=><div className="progress" key={e.name}><span>{e.name}</span><div><i style={{width: Math.min(100,e.progress)+'%'}}></i></div><b>{e.progress}%</b></div>)}<button onClick={()=>setActive('Suivi des EDT')}>Ouvrir le suivi des EDT</button></section><section className="panel"><h2><Bell/> Blocs installés</h2><ul className="checks"><li>Bloc 1 : données Supabase avec fallback JSON.</li><li>Bloc 2 : recherche Infrastructure / Arrêt.</li><li>Bloc 3 : connexion et rôles en première version.</li></ul></section></div>
  </div>;
}
function Card({title,value}){return <div className="card"><ClipboardList/><span>{title}</span><strong>{Number(value||0).toLocaleString('fr-CA')}</strong></div>}

function TableView({ name, dataStore }) {
  const rows = getRows(dataStore, name);
  const cols = getCols(rows);
  const [query,setQuery] = useState('');
  const [filters,setFilters] = useState({});
  const [selected,setSelected] = useState(null);
  const filtered = useMemo(()=>rows.filter(r=>strictMatches(r,query,cols)).filter(r=>Object.entries(filters).every(([c,v])=>!v||normalize(r[c]).includes(normalize(v)))), [rows,query,filters,cols]);
  const shown = filtered.slice(0, 200);
  return <div className="tablePage"><header className="pageHead"><div><h1>{icons[name]||'📋'} {name}</h1><p>{filtered.length.toLocaleString('fr-CA')} résultat(s) sur {rows.length.toLocaleString('fr-CA')} ligne(s). Source : {sourceLabel(dataStore, name)}.</p></div><div className="actions"><button onClick={()=>downloadCSV(`${name}_table_complete.csv`,rows,cols)}><Download/> Table complète</button><button onClick={()=>downloadCSV(`${name}_resultats_filtres.csv`,filtered,cols)}><FileSpreadsheet/> Résultats filtrés</button><button onClick={()=>alert('Rapport client illustré : Bloc Rapports.') }><FileText/> Rapport client avec photo</button></div></header><div className="searchbar"><Search/><input placeholder="Recherche exacte dans toutes les colonnes..." value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="tableWrap"><table><thead><tr>{cols.map(c=><th key={c}>{c}<input placeholder="Filtrer" value={filters[c]||''} onChange={e=>setFilters({...filters,[c]:e.target.value})}/></th>)}</tr></thead><tbody>{shown.map((r,i)=><tr key={r.id || i} onClick={()=>setSelected(r)}>{cols.map(c=><td key={c}>{String(r[c]??'').slice(0,160)}</td>)}</tr>)}</tbody></table></div>{selected&&<Detail name={name} row={selected} onClose={()=>setSelected(null)}/>}</div>;
}
function Detail({name,row,onClose}){ const cols=Object.keys(row).filter(c=>c !== 'raw_data'); const support=row.support_id||row.no_arret||row.related_support||row['Support ID']||''; return <div className="drawer"><div className="drawerPanel"><button className="close" onClick={onClose}>×</button><h2>Fiche 360° — {name}</h2>{support&&<div className="support">Identifiant : <b>{support}</b></div>}<div className="detailGrid">{cols.map(c=><div key={c}><label>{c}</label><p>{String(row[c]??'—')}</p></div>)}</div></div></div>}

function FieldSearch({ dataStore }) {
  const [source,setSource] = useState('Infrastructures');
  const [id,setId] = useState('');
  const rows = source==='Infrastructures' ? getRows(dataStore,'Infrastructures') : getRows(dataStore,'Liste des arrêts');
  const idField = source==='Infrastructures' ? 'support_id' : 'no_arret';
  const labelField = 'emplacement_visibilite';
  const result = rows.find(r => normalize(r[idField]) === normalize(id));
  const suggestions = id ? rows.filter(r => normalize(r[idField]).includes(normalize(id))).slice(0,8) : [];
  return <section className="panel"><h2><Search/> Recherche terrain</h2><div className="fieldGrid"><label>Type</label><select value={source} onChange={e=>{setSource(e.target.value);setId('')}}><option>Infrastructures</option><option>Arrêts</option></select><label>{source==='Infrastructures'?'Support ID':'No d’arrêt'}</label><input value={id} onChange={e=>setId(e.target.value)} placeholder="Entrer l’identifiant"/></div>{result?<div className="found"><b>Résultat trouvé</b><span>{result[labelField] || result.site || 'Fiche trouvée'}</span><small>{idField}: {result[idField]}</small></div>:id&&<div className="suggestions">{suggestions.map((s,i)=><button key={i} onClick={()=>setId(s[idField])}>{s[idField]} — {s[labelField] || s.site || ''}</button>)}</div>}</section>;
}

function MobileApp({ dataStore, role }) {
  const canUseApp = ['Administrateur','Coordonnateur','Installateur'].includes(role);
  const [action,setAction] = useState('installation');
  const [msg,setMsg] = useState('');
  if (!canUseApp) return <div className="dashboard"><div className="panel"><h1>Accès non autorisé</h1><p>L’application terrain est réservée aux administrateurs, coordonnateurs et installateurs.</p></div></div>;
  return <div className="mobileMock"><div className="phone"><h2>Application terrain</h2><FieldSearch dataStore={dataStore}/><label>Action photo</label><select value={action} onChange={e=>setAction(e.target.value)}><option>installation</option><option>inspection</option><option>enjeu</option><option>photo</option></select><button className="photo"><Camera/> Prendre / joindre une photo</button><button onClick={()=>setMsg(`Photo prévue : ${photoName('SUPPORT', action, 1)}. Synchronisation Photos + EDT + Historique.`)}>Terminer</button>{msg&&<p className="msg">{msg}</p>}<nav><span>Support</span><span>Photos</span><span>Enjeux</span><span>Profil</span></nav></div></div>;
}

function LoginView({ session, setSession, role, setRole }) {
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [message,setMessage] = useState('');
  async function login(){
    if (!supabase) { setMessage('Supabase non configuré : connexion en mode démo.'); setSession({ user:{ email: email || 'demo@groupetos.com' }}); return; }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setMessage(error.message); return; }
    setSession(data.session); setMessage('Connexion réussie.');
  }
  async function logout(){ if (supabase) await supabase.auth.signOut(); setSession(null); }
  return <div className="login"><div className="loginCard"><h1><Lock/> TOS Display Manager</h1><p>Connexion sécurisée. Aucun compte public.</p>{session ? <><p>Connecté : <b>{session.user?.email}</b></p><label>Rôle de validation</label><select value={role} onChange={e=>setRole(e.target.value)}>{roles.map(r=><option key={r}>{r}</option>)}</select><button onClick={logout}><LogOut/> Déconnexion</button></> : <><input placeholder="Courriel" value={email} onChange={e=>setEmail(e.target.value)}/><input placeholder="Mot de passe" type="password" value={password} onChange={e=>setPassword(e.target.value)}/><button onClick={login}>Se connecter</button></>}{message&&<small>{message}</small>}<small>Rôles : Administrateur, Coordonnateur, Installateur, Client-Admin, Client.</small></div></div>;
}

function App(){
  const [active,setActive] = useState('Tableau de bord');
  const [role,setRole] = useState('Administrateur');
  const [session,setSession] = useState(null);
  const [dataStore,setDataStore] = useState(null);
  const [loading,setLoading] = useState(true);
  useEffect(()=>{ loadManyTables(tableConfig).then(ds=>{ setDataStore(ds); setLoading(false); console.log('Données TDM chargées', Object.fromEntries(Object.entries(ds).map(([k,v])=>[k,{source:v.source,count:v.rows.length}]))); }); },[]);
  useEffect(()=>{ if (!supabase) return; supabase.auth.getSession().then(({data})=>setSession(data.session)); const { data: listener } = supabase.auth.onAuthStateChange((_event, currentSession)=>setSession(currentSession)); return ()=>listener?.subscription?.unsubscribe(); },[]);
  const items=['Tableau de bord','Connexion','Application terrain','Recherche terrain',...manifest.map(m=>m.name)];
  if (loading) return <div className="login"><div className="loginCard"><h1>Chargement TDM...</h1><p>Lecture Supabase avec fallback JSON.</p></div></div>;
  return <div className="app"><aside><div className="brand">TOS<span>Display Manager</span></div><select value={role} onChange={e=>setRole(e.target.value)}>{roles.map(r=><option key={r}>{r}</option>)}</select>{items.map(it=><button key={it} className={active===it?'active':''} onClick={()=>setActive(it)}>{it==='Tableau de bord'?'📊':it==='Connexion'?'🔐':it==='Application terrain'?'📱':it==='Recherche terrain'?'🔎':(icons[it]||'📋')} {it}</button>)}</aside><main>{active==='Tableau de bord'?<Dashboard setActive={setActive} dataStore={dataStore}/>:active==='Connexion'?<LoginView session={session} setSession={setSession} role={role} setRole={setRole}/>:active==='Application terrain'?<MobileApp dataStore={dataStore} role={role}/>:active==='Recherche terrain'?<div className="dashboard"><FieldSearch dataStore={dataStore}/></div>:<TableView name={active} dataStore={dataStore}/>}</main></div>;
}

createRoot(document.getElementById('root')).render(<App/>);
