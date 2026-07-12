import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Search, Download, FileSpreadsheet, FileText, ShieldCheck, BarChart3,
  ClipboardList, Bell, Lock, LogOut
} from 'lucide-react';
import './styles.css';
import './features/admin/bloc4-admin.css';
import './features/terrain/bloc5-terrain.css';
import './features/workorders/bloc6-workorders.css';
import './features/v07/bloc-7-3.css';
import './features/v07/bloc-7-4.css';

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

import { strictMatches, downloadCSV, normalize } from './lib/utils';
import { supabase, supabaseConfigured } from './lib/supabaseClient';
import { loadManyTables } from './services/dataService';

import AdminPanel from './components/AdminPanel';
import TerrainApp from './components/TerrainApp';
import WorkOrdersPanel from './components/WorkOrdersPanel';
import CampaignsPanel from './components/CampaignsPanel';
import CampaignVisualManager from './components/CampaignVisualManager';
import RelationsStudio from './components/RelationsStudio';
import ValidationCenter from './components/ValidationCenter';
import LegacyPhotoImporter from './components/LegacyPhotoImporter';
import SupportPhotoGallery from './components/SupportPhotoGallery';
import ProductionLogin from './components/ProductionLogin';
import UserProvisioningPanel from './components/UserProvisioningPanel';
import { getCurrentProfile } from './services/authProfileService';

const tableConfig = {
  Infrastructures: { table: 'infrastructures', fallback: infrastructuresJson, idField: 'support_id', labelField: 'emplacement_visibilite' },
  'Campagnes et visuels': { table: 'campagnes_et_visuels', fallback: campagnesJson },
  'Répertoire des affiches': { table: 'repertoire_des_affiches', fallback: repertoireJson },
  'Communications opérationnelles': { table: 'communications_operationnelles', fallback: communicationsJson },
  'Enjeux des cadres et supports': { table: 'enjeux_des_cadres_et_supports', fallback: enjeuxJson },
  "Centres d’information": { table: 'centres_dinformation', fallback: ciJson },
  'C.I. avec enjeux': { table: 'ci_avec_enjeux', fallback: ciEnjeuxJson },
  'Liste des arrêts': { table: 'liste_des_arrets', fallback: arretsJson, idField: 'no_arret', labelField: 'emplacement_visibilite' },
  'Voitures / trains': { table: 'voitures_trains', fallback: voituresJson },
  Photos: { table: 'photos', fallback: photosJson },
  'Bons de travail': { table: 'bons_de_travail', fallback: btJson },
  'Historique des campagnes': { table: 'historique_des_campagnes', fallback: histoJson },
  'Suivi des EDT': { table: 'suivi_des_edt', fallback: edtJson },
  Utilisateurs: { table: 'utilisateurs', fallback: usersJson },
  Clients: { table: 'clients', fallback: clientsJson },
  'Journal des événements': { table: 'journal_des_evenements', fallback: journalJson }
};

const icons = {
  Infrastructures: '🏗️', 'Campagnes et visuels': '🎯', 'Répertoire des affiches': '📦',
  Photos: '📷', 'Bons de travail': '🛠️', 'Suivi des EDT': '📋',
  'Enjeux des cadres et supports': '⚠️', 'Liste des arrêts': '🚏',
  'Voitures / trains': '🚍', Clients: '🏢', Utilisateurs: '👥',
  'Journal des événements': '🧾'
};
const roles = ['Administrateur', 'Coordonnateur', 'Installateur', 'Client-Admin', 'Client'];
const getCols = rows => rows?.length ? Object.keys(rows[0]).filter(c => !['raw_data', 'created_at', 'updated_at'].includes(c)) : [];
const getRows = (dataStore, name) => dataStore?.[name]?.rows || tableConfig[name]?.fallback || [];
const sourceLabel = (dataStore, name) => dataStore?.[name]?.source || 'json';

function Dashboard({ setActive, dataStore }) {
  const infrastructures = getRows(dataStore, 'Infrastructures');
  const arrets = getRows(dataStore, 'Liste des arrêts');
  const edt = getRows(dataStore, 'Suivi des EDT');
  const bt = getRows(dataStore, 'Bons de travail');
  const edtData = edt.length
    ? edt.slice(0, 6).map((e, i) => ({ name: e.no_edt || e['No EDT'] || `EDT-${i + 1}`, progress: Number(e.avancement ?? e['Avancement'] ?? 0) || 0 }))
    : [{ name: 'EDT-DEMO-001', progress: 0 }];

  return <div className="dashboard">
    <div className="hero">
      <div><h1>TOS Display Manager <span>v0.7 consolidée</span></h1><p>Données, campagnes, relations, terrain, photos et validation système.</p></div>
      <div className="badge"><ShieldCheck/> {supabaseConfigured ? 'Supabase configuré' : 'Mode JSON local'}</div>
    </div>
    <div className="cards"><Card title="Infrastructures" value={infrastructures.length}/><Card title="Arrêts" value={arrets.length}/><Card title="EDT" value={edt.length}/><Card title="Bons de travail" value={bt.length}/></div>
    <div className="grid2">
      <section className="panel"><h2><BarChart3/> Avancement des EDT</h2>{edtData.map(e => <div className="progress" key={e.name}><span>{e.name}</span><div><i style={{ width: `${Math.min(100, e.progress)}%` }}/></div><b>{e.progress}%</b></div>)}<button onClick={() => setActive('Suivi des EDT')}>Ouvrir le suivi des EDT</button></section>
      <section className="panel"><h2><Bell/> Modules v0.7</h2><ul className="checks"><li>Données complètes paginées.</li><li>Campagnes, phases, visuels et formats.</li><li>Studio des relations et Centre de validation.</li><li>Application terrain filtrée selon le format du support.</li></ul></section>
    </div>
  </div>;
}

function Card({ title, value }) { return <div className="card"><ClipboardList/><span>{title}</span><strong>{Number(value || 0).toLocaleString('fr-CA')}</strong></div>; }

function TableView({ name, dataStore }) {
  const rows = getRows(dataStore, name);
  const cols = getCols(rows);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({});
  const [selected, setSelected] = useState(null);
  const filtered = useMemo(() => rows
    .filter(r => strictMatches(r, query, cols))
    .filter(r => Object.entries(filters).every(([c, v]) => !v || normalize(r[c]).includes(normalize(v)))), [rows, query, filters, cols]);
  const shown = filtered.slice(0, 200);

  return <div className="tablePage">
    <header className="pageHead"><div><h1>{icons[name] || '📋'} {name}</h1><p>{filtered.length.toLocaleString('fr-CA')} résultat(s) sur {rows.length.toLocaleString('fr-CA')} ligne(s). Source : {sourceLabel(dataStore, name)}.</p></div><div className="actions"><button onClick={() => downloadCSV(`${name}_table_complete.csv`, rows, cols)}><Download/> Table complète</button><button onClick={() => downloadCSV(`${name}_resultats_filtres.csv`, filtered, cols)}><FileSpreadsheet/> Résultats filtrés</button><button onClick={() => alert('Rapport client illustré : module Rapports à venir.')}><FileText/> Rapport client avec photo</button></div></header>
    <div className="searchbar"><Search/><input placeholder="Recherche exacte dans toutes les colonnes..." value={query} onChange={e => setQuery(e.target.value)}/></div>
    <div className="tableWrap"><table><thead><tr>{cols.map(c => <th key={c}>{c}<input placeholder="Filtrer" value={filters[c] || ''} onChange={e => setFilters({ ...filters, [c]: e.target.value })}/></th>)}</tr></thead><tbody>{shown.map((r, i) => <tr key={r.id || i} onClick={() => setSelected(r)}>{cols.map(c => <td key={c}>{String(r[c] ?? '').slice(0, 160)}</td>)}</tr>)}</tbody></table></div>
    {selected && <Detail name={name} row={selected} onClose={() => setSelected(null)}/>} 
  </div>;
}

function Detail({ name, row, onClose }) {
  const cols = Object.keys(row).filter(c => c !== 'raw_data');
  const support = row.support_id || row.no_arret || row.related_support || row['Support ID'] || '';
  return <div className="drawer"><div className="drawerPanel"><button className="close" onClick={onClose}>×</button><h2>Fiche 360° — {name}</h2>{support && <div className="support">Identifiant : <b>{support}</b></div>}<div className="detailGrid">{cols.map(c => <div key={c}><label>{c}</label><p>{String(row[c] ?? '—')}</p></div>)}</div>{name === 'Infrastructures' && support && <SupportPhotoGallery supportId={support}/>}</div></div>;
}

function FieldSearch({ dataStore }) {
  const [source, setSource] = useState('Infrastructures');
  const [id, setId] = useState('');
  const rows = source === 'Infrastructures' ? getRows(dataStore, 'Infrastructures') : getRows(dataStore, 'Liste des arrêts');
  const idField = source === 'Infrastructures' ? 'support_id' : 'no_arret';
  const result = rows.find(r => normalize(r[idField]) === normalize(id));
  const suggestions = id ? rows.filter(r => normalize(r[idField]).includes(normalize(id))).slice(0, 8) : [];
  return <section className="panel"><h2><Search/> Recherche terrain</h2><div className="fieldGrid"><label>Type</label><select value={source} onChange={e => { setSource(e.target.value); setId(''); }}><option>Infrastructures</option><option>Arrêts</option></select><label>{source === 'Infrastructures' ? 'Support ID' : 'No d’arrêt'}</label><input value={id} onChange={e => setId(e.target.value)} placeholder="Entrer l’identifiant"/></div>{result ? <div className="found"><b>Résultat trouvé</b><span>{result.emplacement_visibilite || result.site || 'Fiche trouvée'}</span><small>{idField}: {result[idField]}</small></div> : id && <div className="suggestions">{suggestions.map((s, i) => <button key={i} onClick={() => setId(s[idField])}>{s[idField]} — {s.emplacement_visibilite || s.site || ''}</button>)}</div>}</section>;
}

function LoginView({ session, setSession, role, setRole }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  async function login() {
    if (!supabase) { setMessage('Supabase non configuré : connexion en mode démo.'); setSession({ user: { email: email || 'demo@groupetos.com' } }); return; }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setMessage(error.message); return; }
    setSession(data.session); setMessage('Connexion réussie.');
  }
  async function logout() { if (supabase) await supabase.auth.signOut(); setSession(null); }
  return <div className="login"><div className="loginCard"><h1><Lock/> TOS Display Manager</h1><p>Connexion sécurisée.</p>{session ? <><p>Connecté : <b>{session.user?.email}</b></p><label>Rôle de validation</label><select value={role} onChange={e => setRole(e.target.value)}>{roles.map(r => <option key={r}>{r}</option>)}</select><button onClick={logout}><LogOut/> Déconnexion</button></> : <><input placeholder="Courriel" value={email} onChange={e => setEmail(e.target.value)}/><input placeholder="Mot de passe" type="password" value={password} onChange={e => setPassword(e.target.value)}/><button onClick={login}>Se connecter</button></>}{message && <small>{message}</small>}</div></div>;
}


function SupabaseConfigurationError() {
  return (
    <div className="production-login-page">
      <div className="production-login-card">
        <div className="production-login-logo">TOS<span>Display Manager</span></div>
        <div className="production-login-icon"><ShieldCheck size={30}/></div>
        <h1>Configuration Vercel incomplète</h1>
        <p>
          Les variables VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY
          ne sont pas disponibles dans cet environnement.
        </p>
        <p>
          Active-les pour Preview et Production dans Vercel, puis redéploie.
        </p>
      </div>
    </div>
  );
}

function App() {
  const [active, setActive] = useState('Tableau de bord');
  const [role, setRole] = useState('Administrateur');
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [dataStore, setDataStore] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadManyTables(tableConfig)
      .then(ds => { setDataStore(ds); setLoading(false); })
      .catch(error => { console.error(error); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!supabase) {
      setProfileLoading(false);
      return undefined;
    }

    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      if (!currentSession) setProfile(null);
    });
    return () => listener?.subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      if (!session) {
        setProfile(null);
        setProfileLoading(false);
        return;
      }
      setProfileLoading(true);
      try {
        const nextProfile = await getCurrentProfile(session);
        if (!cancelled) setProfile(nextProfile);
      } catch (error) {
        console.error('Profil applicatif introuvable', error);
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    }
    loadProfile();
    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => {
    if (profile?.role) setRole(profile.role);
  }, [profile]);

  const adminItems = role === 'Administrateur'
    ? ['Administration', 'Utilisateurs réels', 'Studio des relations', 'Validation système', 'Import anciennes photos', 'Campagnes maîtres', 'Campagne — Visuels et formats']
    : role === 'Coordonnateur'
      ? ['Validation système', 'Campagnes maîtres', 'Campagne — Visuels et formats']
      : [];
  const items = ['Tableau de bord', ...adminItems, 'Application terrain', 'Recherche terrain', ...manifest.map(m => m.name)];

  if (!supabaseConfigured) return <SupabaseConfigurationError/>;
  if (loading || profileLoading) return <div className="login"><div className="loginCard"><h1>Chargement TDM...</h1><p>Validation de la session et du profil.</p></div></div>;
  if (!session) return <ProductionLogin/>;
  if (session && (!profile || String(profile.statut || '').toLowerCase() !== 'actif')) {
    return <div className="production-login-page"><div className="production-login-card"><h1>Accès non autorisé</h1><p>Aucun profil applicatif actif n’est associé à ce compte.</p><button onClick={() => supabase.auth.signOut()}>Déconnexion</button></div></div>;
  }

  let content;
  if (active === 'Tableau de bord') content = <Dashboard setActive={setActive} dataStore={dataStore}/>;
  else if (active === 'Connexion') content = <LoginView session={session} setSession={setSession} role={role} setRole={setRole}/>;
  else if (active === 'Administration') content = <AdminPanel role={role} currentRole={role} session={session}/>;
  else if (active === 'Utilisateurs réels') content = <UserProvisioningPanel role={role}/>;
  else if (active === 'Studio des relations') content = <RelationsStudio role={role}/>;
  else if (active === 'Validation système') content = <ValidationCenter role={role}/>;
  else if (active === 'Import anciennes photos') content = <LegacyPhotoImporter dataStore={dataStore} session={session}/>;
  else if (active === 'Campagnes maîtres') content = <CampaignsPanel role={role} session={session}/>;
  else if (active === 'Campagne — Visuels et formats') content = <CampaignVisualManager role={role}/>;
  else if (active === 'Application terrain') content = <TerrainApp dataStore={dataStore} role={role} session={session}/>;
  else if (active === 'Recherche terrain') content = <div className="dashboard"><FieldSearch dataStore={dataStore}/></div>;
  else if (active === 'Bons de travail') content = <WorkOrdersPanel dataStore={dataStore} role={role} session={session}/>;
  else content = <TableView name={active} dataStore={dataStore}/>;

  return <div className="app"><aside><div className="brand">TOS<span>Display Manager</span></div><span className="role-badge">{profile?.nom || session?.user?.email}<br/>{role}</span>{items.map(it => <button key={it} className={active === it ? 'active' : ''} onClick={() => setActive(it)}>{it === 'Tableau de bord' ? '📊' : it === 'Administration' ? '⚙️' : it === 'Utilisateurs réels' ? '👤' : it === 'Studio des relations' ? '🔗' : it === 'Validation système' ? '✅' : it === 'Import anciennes photos' ? '📥' : it === 'Campagnes maîtres' ? '🎯' : it === 'Campagne — Visuels et formats' ? '🖼️' : it === 'Application terrain' ? '📱' : it === 'Recherche terrain' ? '🔎' : (icons[it] || '📋')} {it}</button>)}</aside><main>{content}</main></div>;
}

createRoot(document.getElementById('root')).render(<App/>);
