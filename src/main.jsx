import {getUserViewPreview,setUserViewPreview,userViewSession} from './lib/userViewPreview';
import UserViewPreview from './components/UserViewPreview';
import TableView, {Detail} from './components/BusinessTable';
import PhotoImage from './components/PhotoImage';
import {businessColumns as getCols,businessColumnLabel as columnLabel} from './lib/businessColumns';
import {knownBusinessRoute} from './lib/businessViewRegistry';
import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { clearSignedPhotoUrlCache } from './services/photoAccessService';
import { createRoot } from 'react-dom/client';
import {
  Search, Download, FileSpreadsheet, FileText, ShieldCheck, BarChart3,
  ClipboardList, Bell, Lock, LogOut, MapPin, Edit3, Save, X, History
  , ChevronRight, AlertTriangle, Camera, CalendarClock
} from 'lucide-react';
import './styles.css';
import './features/admin/bloc4-admin.css';
import './features/terrain/bloc5-terrain.css';
import './features/workorders/bloc6-workorders.css';
import './features/v07/bloc-7-3.css';
import './features/v07/bloc-7-4.css';
import 'leaflet/dist/leaflet.css';
import './features/v08/bloc-8-map.css';
import './features/v08/bloc-8-role-visibility.css';
import './features/v09/bloc-9-reports.css';
import './features/v10/bloc-10-editor.css';
import './features/v11/bloc-11-operations.css';
import './features/v11/correctifs-urgence.css';
import './features/v12/bloc-12.css';
import './features/v12/account-activation.css';
import './features/v12/installer-terrain-shell.css';
import './features/v13/automation-assistant.css';
import './features/v13/grid-sorting.css';
import './features/v13/recent-activity.css';
import './features/v13/field-catalog.css';
import './features/v14/module-14.css';
import './features/v15/module-15.css';
import './features/v17/client-portal.css';

import manifest from './data/manifest.json';
import {
  strictMatches,
  downloadCSV,
  downloadExcel,
  downloadExcelSelectionWithPhotos,
  downloadPDF,
  professionalExportName,
  normalize
} from './lib/utils';
import { sortRows } from './lib/gridSorting';
import { supabase, supabaseConfigured } from './lib/supabaseClient';
import { businessFieldLabel, enforceApplicationTitle, friendlyError } from './config/businessLanguage';
import GridColumnHeader from './components/GridColumnHeader';
import DataGridFilterRow from './components/DataGridFilterRow';
import { matchesGridFilters } from './components/DataGridColumnFilter';
import DataGridSettings, { useDataGridSettings } from './components/DataGridSettings';
import GridPagination from './components/GridPagination';
import { defaultSortColumnForTable } from './lib/gridPresentation';
import { defaultSortForColumn } from './lib/gridSorting';
import { clearTableCache, loadManyTables, loadTable } from './services/dataService';
import { loadInternalIssues } from './services/internalIssuesService';
import { loadTerrainSyncStatus } from './services/terrainSyncStatus';

import SupportPhotoGallery from './components/SupportPhotoGallery';
import Support360Panel from './components/Support360Panel';
import EditableField from './components/EditableField';
import ChangeHistoryPanel from './components/ChangeHistoryPanel';
import GlobalButtonFeedback from './components/GlobalButtonFeedback';
import RecentActivityWidget from './components/RecentActivityWidget';
import AccountActivation from './components/AccountActivation';
import InvitationAcceptance from './components/InvitationAcceptance';
import BrandLogo from './components/BrandLogo';
import OperationalCommandCenter from './components/OperationalCommandCenter';
import { infrastructureMapUrl } from './services/mapService';
import { getCurrentProfile } from './services/authProfileService';
import { getRoleVisibility, canSeeTable, columnsForTable } from './services/roleVisibilityService';
import { updateUniversalRow, updateUniversalRows, loadAutomaticFieldRules, primaryKeyFor } from './services/universalEditorService';
import { requiresAccountActivation } from './services/accountActivationService';

const AdminPanel = lazy(() => import('./components/AdminPanel'));
const TerrainApp = lazy(() => import('./components/TerrainApp'));
const WorkOrdersPanel = lazy(() => import('./components/WorkOrdersPanel'));
const CampaignsPanel = lazy(() => import('./components/CampaignsPanel'));
const CampaignVisualManager = lazy(() => import('./components/CampaignVisualManager'));
const ValidationCenter = lazy(() => import('./components/ValidationCenter'));
const LegacyPhotoImporter = lazy(() => import('./components/LegacyPhotoImporter'));
const ProductionLogin = lazy(() => import('./components/ProductionLogin'));
const UserProvisioningPanel = lazy(() => import('./components/UserProvisioningPanel'));
const ClientsAccessAdmin = lazy(() => import('./components/ClientsAccessAdmin'));
const InteractiveMap = lazy(() => import('./components/InteractiveMap'));
const RoleVisibilityAdmin = lazy(() => import('./components/RoleVisibilityAdmin'));
const FinalReportsCenter = lazy(() => import('./components/FinalReportsCenter'));
const Module15Reports = lazy(() => import('./components/Module15Reports'));
const PhotoInventoryCenter = lazy(() => import('./components/PhotoInventoryCenter'));
const OperationsCenter = lazy(() => import('./components/OperationsCenter'));
const InstallerTerrainShell = lazy(() => import('./components/InstallerTerrainShell'));
const TerrainSyncDiagnostics = lazy(() => import('./components/TerrainSyncDiagnostics'));
const ActivityJournal = lazy(() => import('./components/ActivityJournal'));
const AutomationAssistant = lazy(() => import('./components/AutomationAssistant'));
const FieldCatalogManager = lazy(() => import('./components/FieldCatalogManager'));
const Module14Dashboard = lazy(() => import('./components/Module14Dashboard'));
const ClientPortal = lazy(() => import('./components/ClientPortal'));
const SiteSupportAssignmentsView = lazy(() => import('./components/SiteSupportAssignmentsView'));
const ExportsCenter = lazy(() => import('./components/ExportsCenter'));
import { BUSINESS_CONTEXT } from './lib/businessContext';

function ScreenFallback() {
  return <div className="screen-fallback" role="status" aria-live="polite"><span aria-hidden="true"/>Chargement du module…</div>;
}

import {tableConfig} from './lib/businessTableConfig';

const STARTUP_TABLES = [
  'Infrastructures', 'Liste des arrêts', 'Suivi des EDT',
  'Bons de travail', 'Enjeux des cadres et supports', 'Photos', 'Clients'
];

const icons = {
  Infrastructures: '🏗️', 'Campagnes et visuels': '🎯', 'Répertoire des affiches': '📦',
  Photos: '📷', 'Bons de travail': '🛠️', 'Suivi des EDT': '📋',
  'Enjeux des cadres et supports': '⚠️', 'Liste des arrêts': '🚏',
  'Voitures / trains': '🚍', Clients: '🏢', Utilisateurs: '👥',
  'Journal des événements': '🧾'
};
const roles = ['Administrateur', 'Coordonnateur', 'Installateur', 'Client-Admin', 'Client'];





const getRows = (dataStore, name) =>
  dataStore?.[name]?.rows || [];





const thumbnailForInfrastructure = row =>
  row.photo_miniature_url ||
  row.photo_principale_url ||
  (String(row.visuel_actuel_cadre || '').match(/^https?:\/\//i)
    ? row.visuel_actuel_cadre
    : '');

function renderTableCell(tableName, row, column) {
  if (tableName === 'Infrastructures' && column === 'visuel_actuel_cadre') {
    const url = thumbnailForInfrastructure(row);
    return url
      ? <PhotoImage className="infrastructure-thumbnail" photo={url} alt={`Photo du support ${row.support_id || ''}`}/>
      : <span className="infrastructure-thumbnail-missing">Aucune photo</span>;
  }

  if (tableName === 'Infrastructures' && column === 'visuel_en_expo') {
    const visual = String(row.visuel_en_expo || row.visuel_campagne || '').trim();
    const format = String(row.format_affichage || row.format_visuel || '').trim();
    return visual ? `${visual}${format ? ` (${format})` : ''}` : '';
  }

  if (tableName === 'Infrastructures' && column === 'campagne_actuelle') {
    const campaign = String(row.campagne_actuelle || row.campagne_selon_visuel || '').trim();
    const visual = String(row.visuel_campagne || '').trim();
    return [campaign, visual].filter(Boolean).join(' – ');
  }

  return String(row[column] ?? '').slice(0, 160);
}

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
      <div className="hero-brand"><BrandLogo/><div><h1>TOS Display Manager</h1><p>Données, campagnes, relations, terrain, photos et validation système.</p></div></div>
      <div className="badge"><ShieldCheck/> Espace opérationnel sécurisé</div>
    </div>
    <div className="cards"><Card title="Infrastructures" value={infrastructures.length}/><Card title="Arrêts" value={arrets.length}/><Card title="EDT" value={edt.length}/><Card title="Bons de travail" value={bt.length}/></div>
    <div className="dashboard-v12-grid">
      <div className="dashboard-v12-card"><h3>Enjeux ouverts</h3><strong>{getRows(dataStore, 'Enjeux des cadres et supports').length.toLocaleString('fr-CA')}</strong><p>Éléments nécessitant un suivi.</p></div>
      <div className="dashboard-v12-card"><h3>Photos</h3><strong>{getRows(dataStore, 'Photos').length.toLocaleString('fr-CA')}</strong><p>Preuves et miniatures disponibles.</p></div>
      <div className="dashboard-v12-card"><h3>Campagnes</h3><strong>Module 14</strong><p>Indicateurs issus de la source consolidée.</p></div>
    </div>
    <div className="grid2">
      <section className="panel"><h2><BarChart3/> Avancement des EDT</h2>{edtData.map(e => <div className="progress" key={e.name}><span>{e.name}</span><div><i style={{ width: `${Math.min(100, e.progress)}%` }}/></div><b>{e.progress}%</b></div>)}<button onClick={() => setActive('Suivi des EDT')}>Ouvrir le suivi des EDT</button></section>
      <section className="panel"><h2><Bell/> Modules opérationnels</h2><ul className="checks"><li>Données complètes paginées.</li><li>Campagnes, phases, visuels et formats.</li><li>Studio des relations et Centre de validation.</li><li>Application terrain filtrée selon le format du support.</li></ul></section>
    </div>
  </div>;
}

function Card({ title, value }) { return <div className="card"><ClipboardList/><span>{title}</span><strong>{Number(value || 0).toLocaleString('fr-CA')}</strong></div>; }

function ExecutiveDashboard({setActive,dataStore,terrainSyncStatus,role,rolePermission}) {
  const infra=getRows(dataStore,'Infrastructures');
  const edt=getRows(dataStore,'Suivi des EDT');
  const photos=getRows(dataStore,'Photos');
  const issues=getRows(dataStore,'Enjeux des cadres et supports');
  const work=getRows(dataStore,'Bons de travail');
  const activeInfra=infra.filter(row=>![false,'false','inactif','inactive'].includes(typeof row.actif==='string'?normalize(row.actif):row.actif)).length;
  const activeCampaigns=null;
  const plannedInstalls=edt.filter(row=>['planifie','planifiee','brouillon'].includes(normalize(row.statut))).length;
  const inspections=photos.filter(row=>normalize(row.action||row.type_photo).includes('inspection')).length;
  const openIssues=issues.filter(row=>!['ferme','fermee','resolu','resolue','annule'].includes(normalize(row.statut))).length;
  const urgentWork=work.filter(row=>normalize(row.priorite).includes('urgent')&&!['termine','ferme','annule'].includes(normalize(row.statut))).length;
  const missingPhotos=infra.filter(row=>!thumbnailForInfrastructure(row)).length;
  const metrics=[
    ['Supports actifs',activeInfra,'Infrastructures',ClipboardList],
    ['Campagnes actives',activeCampaigns,'Campagnes maîtres',BarChart3],
    ['Installations prévues',plannedInstalls,'Suivi des EDT',CalendarClock],
    ['Inspections',inspections,'Photos et inventaire',ShieldCheck],
    ['Enjeux ouverts',openIssues,'Enjeux des cadres et supports',AlertTriangle],
    ['Travaux urgents',urgentWork,'Bons de travail',Bell],
    ['Synchronisations Terrain',terrainSyncStatus,'Diagnostic terrain',History],
    ['Photos manquantes',missingPhotos,'Infrastructures',Camera]
  ];
  const priorities=[
    urgentWork>0&&`${urgentWork} bon(s) de travail urgent(s) à traiter`,
    openIssues>0&&`${openIssues} enjeu(x) ouvert(s) à examiner`,
    missingPhotos>0&&`${missingPhotos} support(s) sans photo`,
    plannedInstalls>0&&`${plannedInstalls} installation(s) planifiée(s)`
  ].filter(Boolean);
  return <div className="dashboard executive-dashboard">
    <header className="executive-hero"><div className="hero-brand"><BrandLogo priority/><div><h1>Tableau de bord</h1></div></div><div className="executive-status"><span className="status-dot"/> Données {dataStore?.__sync_error__?'partiellement disponibles':'synchronisées'}</div></header>
    <section className="executive-kpis" aria-label="Indicateurs clés">{metrics.map(([label,value,target,Icon])=><button key={label} className="executive-kpi" onClick={()=>setActive(target)}><span><Icon/>{label}</span><strong>{value==null?'Non disponible':typeof value==='number'?value.toLocaleString('fr-CA'):value}</strong><small>Ouvrir le module</small></button>)}</section>
    <section className="executive-layout">
      <RecentActivityWidget onNavigate={setActive} role={role} permission={rolePermission}/>
      <div className="executive-stack"><article className="executive-panel"><header><div><span className="eyebrow">À surveiller</span><h2>Priorités</h2></div><Bell/></header>{priorities.length?<ul className="priority-list">{priorities.map(item=><li key={item}>{item}</li>)}</ul>:<div className="executive-empty">Aucune priorité calculable.</div>}</article><article className="executive-panel"><header><div><span className="eyebrow">Navigation</span><h2>Accès rapides</h2></div></header><div className="quick-actions">{[['Application terrain','Terrain'],['Carte interactive','Carte'],['Infrastructures','Supports'],['Rapports finaux','Rapports']].map(([target,label])=><button key={target} onClick={()=>setActive(target)}>{label}<ChevronRight/></button>)}</div></article></div>
    </section>
  </div>;
}

function FieldSearch({ dataStore }) {
  const [source, setSource] = useState('Infrastructures');
  const [id, setId] = useState('');
  const rows = source === 'Infrastructures' ? getRows(dataStore, 'Infrastructures') : getRows(dataStore, 'Liste des arrêts');
  const idField = source === 'Infrastructures' ? 'support_id' : 'no_arret';
  const result = rows.find(r => normalize(r[idField]) === normalize(id));
  const suggestions = id ? rows.filter(r => normalize(r[idField]).includes(normalize(id))).slice(0, 8) : [];
  return <section className="panel"><h2><Search/> Recherche terrain</h2><div className="fieldGrid"><label>Type</label><select value={source} onChange={e => { setSource(e.target.value); setId(''); }}><option>Infrastructures</option><option>Arrêts</option></select><label>{source === 'Infrastructures' ? 'Numéro du support' : 'Numéro d’arrêt'}</label><input value={id} onChange={e => setId(e.target.value)} placeholder="Entrer l’identifiant"/></div>{result ? <div className="found"><b>Résultat trouvé</b><span>{result.emplacement_visibilite || result.site || 'Fiche trouvée'}</span><small>{businessFieldLabel(idField)} : {result[idField]}</small></div> : id && <div className="suggestions">{suggestions.map((s, i) => <button key={i} onClick={() => setId(s[idField])}>{s[idField]} — {s.emplacement_visibilite || s.site || ''}</button>)}</div>}</section>;
}

function LoginView({ session, setSession, role, setRole }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  async function login() {
    if (!supabase) { setMessage('Le service de connexion est momentanément indisponible.'); return; }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setMessage(friendlyError(error, 'Courriel ou mot de passe invalide.')); return; }
    setSession(data.session); setMessage('Connexion réussie.');
  }
  async function logout() { if (supabase) await supabase.auth.signOut(); setSession(null); }
  return <div className="login"><div className="loginCard"><h1><Lock/> TOS Display Manager</h1><p>Connexion sécurisée.</p>{session ? <><p>Connecté : <b>{session.user?.email}</b></p><label>Rôle de validation</label><select value={role} onChange={e => setRole(e.target.value)}>{roles.map(r => <option key={r}>{r}</option>)}</select><button onClick={logout}><LogOut/> Déconnexion</button></> : <><input placeholder="Courriel" value={email} onChange={e => setEmail(e.target.value)}/><input placeholder="Mot de passe" type="password" value={password} onChange={e => setPassword(e.target.value)}/><button onClick={login}>Se connecter</button></>}{message && <small>{message}</small>}</div></div>;
}


function ServiceConfigurationError() {
  return (
    <div className="production-login-page">
      <div className="production-login-card">
        <div className="production-login-logo"><BrandLogo priority/><span>Display Manager</span></div>
        <div className="production-login-icon"><ShieldCheck size={30}/></div>
        <h1>Service temporairement indisponible</h1>
        <p>La connexion sécurisée à votre espace ne peut pas être établie pour le moment.</p>
        <p>Communiquez avec votre administrateur ou réessayez dans quelques instants.</p>
      </div>
    </div>
  );
}

function App(){
 const [target,setTarget]=useState(getUserViewPreview);
 useEffect(()=>{const change=()=>{clearTableCache();clearSignedPhotoUrlCache();setTarget(getUserViewPreview());};window.addEventListener('tos-user-view-preview',change);return()=>window.removeEventListener('tos-user-view-preview',change)},[]);
 return <>{target&&<div className="ca-preview-banner"><strong>Voir en tant que : {target.nom} — {target.role}</strong><span>Consultation uniquement. Votre session Admin reste active.</span><button onClick={()=>setUserViewPreview(null)}>Revenir à ma vue Admin</button></div>}<ApplicationSession key={target?.id||'self'}/></>;
}
function ApplicationSession() {
  const [userPreviewOpen,setUserPreviewOpen]=useState(false);
  enforceApplicationTitle();
  const isAcceptInvitationRoute = window.location.pathname.replace(/\/+$/, '') === '/accept-invitation';
  const isSetPasswordRoute = window.location.pathname.replace(/\/+$/, '') === '/set-password';
  const [active, setActive] = useState('Tableau de bord');
  const [role, setRole] = useState('Administrateur');
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [dataStore, setDataStore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mapFocusSupportId, setMapFocusSupportId] = useState('');
  const [navigationContext,setNavigationContext]=useState({});
  const [rolePermission, setRolePermission] = useState({ visible_tables: ['*'], visible_columns: {} });
  const [terrainSyncStatus, setTerrainSyncStatus] = useState('État global non centralisé');
  const dataScope = useRef('');
  const currentDataScope = [session?.user?.id,profile?.id,profile?.role,profile?.client_id].join(':');
  dataScope.current = currentDataScope;

  async function refreshDataStore(labels = STARTUP_TABLES, { force = false } = {}) {
    if (!session || !profile || ['Client','Client-Admin'].includes(profile.role)) return null;
    const scope = currentDataScope;
    try {
      const selectedConfig = Object.fromEntries(labels.filter(label => tableConfig[label]).map(label => [label, tableConfig[label]]));
      if (force) clearTableCache(Object.values(selectedConfig).flatMap(config => config.cacheTables || [config.table]));
      const ds = await loadManyTables(selectedConfig, { onTable: (label, value) => {
        if (dataScope.current === scope) setDataStore(current => ({ ...(current || {}), [label]: value }));
      } });
      if(dataScope.current !== scope) return null;
      setDataStore(current => ({ ...(current || {}), ...ds }));
      return ds;
    } catch (error) {
      if(dataScope.current !== scope) return null;
      console.error('Rafraîchissement Supabase impossible', error);
      setDataStore(current => ({...current,__sync_error__:{rows:[],source:'error',error,complete:false}}));
      return null;
    }
  }

  useEffect(() => {
    if (!session || profileLoading || !profile) return;
    clearTableCache();
    clearSignedPhotoUrlCache();
    setDataStore(null);
    if (['Client','Client-Admin'].includes(profile.role)) { setDataStore(null); setLoading(false); return; }
    setLoading(false);
    if(profile.role==='Installateur')refreshDataStore(STARTUP_TABLES);
  }, [session?.user?.id, profile?.id, profile?.role, profile?.client_id, profileLoading]);

  useEffect(() => {
    if (!session || !profile || profileLoading || ['Client','Client-Admin'].includes(profile.role)) return;
    const dependencies={
      'Carte interactive':['Infrastructures'],
      'Application terrain':['Infrastructures','Liste des arrêts'],
      'Recherche terrain':['Infrastructures','Liste des arrêts'],
      'Visibilité par rôle':STARTUP_TABLES,
      'Import anciennes photos':['Infrastructures'],
      'Rapports finaux':['Infrastructures','Suivi des EDT','Clients','Enjeux des cadres et supports','Campagnes et visuels'],
      'Centre de commandement':STARTUP_TABLES
    };
    const required=tableConfig[active]?[active]:(dependencies[active]||[]);
    const missing=required.filter(label=>!dataStore?.[label]);
    if(missing.length)refreshDataStore(missing);
  }, [active, session?.user?.id, profile?.id, profile?.role, profile?.client_id, profileLoading]);

  useEffect(() => {
    if (!session || active !== 'Tableau de bord' || profile?.role !== 'Installateur') return;
    loadTerrainSyncStatus().then(setTerrainSyncStatus);
  }, [session?.user?.id, active]);

  useEffect(() => {
    if (!supabase || !session || getUserViewPreview()) return undefined;
    const refresh = () => refreshDataStore(
      Object.keys(dataStore || {}).filter(label => tableConfig[label]),
      { force: true }
    );
    window.addEventListener('tos-terrain-data-updated', refresh);
    const channel = supabase
      .channel(`tos-terrain-live-sync-${session.user.id}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'infrastructures'},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'support_photos'},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'enjeux_des_cadres_et_supports'},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'enjeux_terrain'},refresh)
      .subscribe();
    return () => {window.removeEventListener('tos-terrain-data-updated',refresh);supabase.removeChannel(channel);};
  }, [session?.user?.id, dataStore]);

  useEffect(() => {
    if (!supabase) {
      setProfileLoading(false);
      return undefined;
    }

    supabase.auth.getSession().then(({ data }) => setSession(userViewSession(data.session)));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      dataScope.current = '';
      clearTableCache();
      clearSignedPhotoUrlCache();
      if(['SIGNED_IN','SIGNED_OUT','USER_UPDATED'].includes(_event)) setDataStore(null);
      setSession(userViewSession(currentSession));
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
        if (!cancelled) { setProfile(nextProfile); if(nextProfile?.role)setRole(nextProfile.role); }
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

  useEffect(() => {
    const restoreInfrastructureHistory = () => {
      if (active === 'Carte interactive' && navigationContext.sourceView === 'infrastructures') setActive('Infrastructures');
    };
    window.addEventListener('popstate', restoreInfrastructureHistory);
    return () => window.removeEventListener('popstate', restoreInfrastructureHistory);
  }, [active, navigationContext.sourceView]);

  useEffect(() => {
    let cancelled = false;

    if (!profile?.role) return;
    getRoleVisibility(profile.role)
      .then(permission => {
        if (!cancelled) setRolePermission(permission);
      })
      .catch(error => {
        console.error('Permissions d’interface introuvables', error);
      });

    return () => { cancelled = true; };
  }, [profile?.role]);

  const adminItems = role === 'Administrateur'
    ? ['Administration', 'Utilisateurs réels', 'Visibilité par rôle', 'Édition — Historique', 'Photos et inventaire', 'Centre EDT et BT', 'Rapports EDT', 'Automatisations', 'Campagnes maîtres', 'Campagne — Visuels et formats', 'Campagnes et visuels par site et supports', 'Communications opérationnelles', 'Communication opérationnelle — Visuels', 'Communications opérationnelles par site et supports']
    : role === 'Coordonnateur'
      ? ['Rapports EDT', 'Campagnes maîtres', 'Campagne — Visuels et formats', 'Campagnes et visuels par site et supports', 'Communications opérationnelles', 'Communication opérationnelle — Visuels', 'Communications opérationnelles par site et supports']
      : [];
  const visibleManifestTables = manifest
    .map(module => module.name)
    .filter(tableName => !['Campagnes et visuels','Communications opérationnelles'].includes(tableName))
    .filter(tableName => canSeeTable(rolePermission, tableName));

  const items = [
    'Tableau de bord',
    'Exports',
    ...(['Administrateur','Coordonnateur'].includes(role) ? ['Centre de commandement'] : []),
    ...(role === 'Administrateur' ? ['Gestionnaire des champs'] : []),
    ...adminItems,
    'Carte interactive',
    'Application terrain',
    'Recherche terrain',
    ...visibleManifestTables
  ].map(knownBusinessRoute);

  function applyUpdatedRows(tableLabel, updatedRows) {
    setDataStore(current => {
      const module = current?.[tableLabel];
      if (!module) return current;
      const config = tableConfig[tableLabel];

      const nextRows = module.rows.map(existing => {
        try {
          const existingKey = primaryKeyFor(config, existing);
          const replacement = updatedRows.find(candidate => {
            try {
              const candidateKey = primaryKeyFor(config, candidate);
              return candidateKey.field === existingKey.field &&
                String(candidateKey.value) === String(existingKey.value);
            } catch {
              return false;
            }
          });
          return replacement || existing;
        } catch {
          return existing;
        }
      });

      return {
        ...current,
        [tableLabel]: {
          ...module,
          rows: nextRows
        }
      };
    });
  }

  if (!supabaseConfigured) return <ServiceConfigurationError/>;
  if (isAcceptInvitationRoute) return <InvitationAcceptance/>;
  if (isSetPasswordRoute) return <AccountActivation
    session={session}
    profile={profile}
    loading={profileLoading}
    onActivated={async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw authError || new Error('Session utilisateur introuvable.');
      const nextProfile = await getCurrentProfile({ ...session, user: authData.user });
      if (!nextProfile?.role || !nextProfile?.client_id && ['Client', 'Client-Admin'].includes(nextProfile?.role)) throw new Error('Profil applicatif complet introuvable.');
      setSession(current => ({ ...current, user: authData.user }));
      setProfile(nextProfile);
      setRole(nextProfile.role);
      window.history.replaceState({}, '', '/');
    }}
  />;
  if (profileLoading || (session && loading)) return (
    <div className="app-startup" role="status" aria-live="polite">
      <div className="app-startup-card">
        <div className="app-startup-spinner" aria-hidden="true"/>
        <h1>TOS Display Manager</h1>
        <p>Ouverture sécurisée de votre espace…</p>
        
      </div>
    </div>
  );
  if (!session) return <Suspense fallback={<ScreenFallback/>}><ProductionLogin/></Suspense>;

  if (session && profile && requiresAccountActivation(session, profile)) {
    return <AccountActivation session={session} profile={profile} onActivated={async () => {
      const { data } = await supabase.from('utilisateurs').select('*').or(`auth_user_id.eq.${session.user.id},courriel.eq.${session.user.email}`).maybeSingle();
      if (data) setProfile(data);
      setActive('Application terrain');
    }}/>;
  }
  if (session && (!profile || String(profile.statut || '').toLowerCase() !== 'actif')) {
    return <div className="production-login-page"><div className="production-login-card"><h1>Accès non autorisé</h1><p>Aucun profil applicatif actif n’est associé à ce compte.</p><button onClick={() => supabase.auth.signOut()}>Déconnexion</button></div></div>;
  }

  async function logoutFromPortal() {
    try {
      await supabase.auth.signOut();
    } finally {
      setSession(null);
      setProfile(null);
    }
  }

  function navigateToView(target,context={}) {
    setNavigationContext(context?.supportId?{supportId:String(context.supportId),open360:Boolean(context.open360)}:{});
    setActive(target);
  }

  if (['Client','Client-Admin'].includes(role)) {
    return <Suspense fallback={<ScreenFallback/>}><ClientPortal profile={profile} onLogout={logoutFromPortal}/></Suspense>;
  }

  if (role === 'Installateur') {
    return <Suspense fallback={<ScreenFallback/>}><InstallerTerrainShell
      dataStore={dataStore}
      role={role}
      session={session}
      profile={profile}
      permission={rolePermission}
      onLogout={() => {
        setSession(null);
        setProfile(null);
      }}
    /></Suspense>;
  }

  let content;
  if (active === 'Tableau de bord') content = ['Administrateur','Coordonnateur'].includes(role)?<Module14Dashboard dataStore={dataStore} onNavigate={setActive} terrainSyncStatus={terrainSyncStatus} role={role} permission={rolePermission} scopeKey={currentDataScope}/>:<Dashboard setActive={setActive} dataStore={dataStore}/>;
  else if (active === 'Exports') { const extra=['Administrateur','Coordonnateur'].includes(role)?[{id:'campagnes_maitres',label:'Campagnes'},{id:'campagne_visuels_formats',label:'Visuels'},{id:'edt_phases',label:'Phases EDT'},{id:'activity_events',label:'Historique'}]:[]; const domains=[...visibleManifestTables.map(label=>({id:tableConfig[label]?.table||label,label})),...extra]; content=<ExportsCenter domains={[...new Map(domains.map(domain=>[domain.id,domain])).values()]} loadRows={async domain=>{const config=tableConfig[domain.label];return(config?.loader?await config.loader():await loadTable(domain.id,config?.fallback||[])).rows}}/>; }
  else if (active === 'Centre de commandement') content = <OperationalCommandCenter dataStore={dataStore} onNavigate={setActive}/>;
  else if (active === 'Connexion') content = <LoginView session={session} setSession={setSession} role={role} setRole={setRole}/>;
  else if (active === 'Administration') content = <AdminPanel role={role} currentRole={role} session={session}/>;
  else if (active === 'Gestionnaire des champs') content = <FieldCatalogManager role={role}/>;
  else if (active === 'Utilisateurs réels') content = <UserProvisioningPanel role={role}/>;
  else if (active === 'Clients') content = <ClientsAccessAdmin role={role}/>;
  else if (active === 'Édition — Historique') content = <ChangeHistoryPanel role={role}/>;
  else if (active === 'Photos et inventaire') content = <PhotoInventoryCenter role={role} supportId={navigationContext.supportId} onClearSupportContext={()=>setNavigationContext({})}/>;
  else if (active === 'Centre EDT et BT' || active === 'Suivi des EDT') content = <OperationsCenter role={role} supportId={navigationContext.supportId} onClearSupportContext={()=>setNavigationContext({})}/>;
  else if (active === 'Diagnostic terrain') content = <TerrainSyncDiagnostics role={role}/>;
  // Contrat historique: <ActivityJournal role={role}/> étendu par le contexte support.
  else if (active === 'Journal des événements') content = <ActivityJournal role={role} supportId={navigationContext.supportId}/>;
  else if (active === 'Rapports finaux') content = <FinalReportsCenter dataStore={dataStore} role={role}/>;
  else if (active === 'Rapports EDT') content = <Module15Reports dataStore={dataStore} role={role}/>;
  else if (active === 'Visibilité par rôle') content = <RoleVisibilityAdmin dataStore={dataStore} tableNames={manifest.map(module => module.name)} role={role}/>;
  else if (active === 'Automatisations') content = <AutomationAssistant role={role}/>;
  else if (active === 'Validation système') content = <ValidationCenter role={role}/>;
  else if (active === 'Import anciennes photos') content = <LegacyPhotoImporter dataStore={dataStore} session={session}/>;
  else if (active === 'Campagnes maîtres') content = <CampaignsPanel scopeKey={[currentDataScope,Boolean(getUserViewPreview())].join(':')} role={role} session={session} businessContext={BUSINESS_CONTEXT.MARKETING}/>;
  else if (active === 'Campagne — Visuels et formats') content = <CampaignVisualManager role={role} businessContext={BUSINESS_CONTEXT.MARKETING}/>;
  else if (active === 'Communications opérationnelles') content = <CampaignsPanel scopeKey={[currentDataScope,Boolean(getUserViewPreview())].join(':')} role={role} session={session} businessContext={BUSINESS_CONTEXT.OPERATIONAL}/>;
  else if (active === 'Communication opérationnelle — Visuels') content = <CampaignVisualManager role={role} businessContext={BUSINESS_CONTEXT.OPERATIONAL}/>;
  else if (active === 'Campagnes et visuels par site et supports') content = <SiteSupportAssignmentsView context={BUSINESS_CONTEXT.MARKETING} role={role} onNavigate={setActive}/>;
  else if (active === 'Communications opérationnelles par site et supports') content = <SiteSupportAssignmentsView context={BUSINESS_CONTEXT.OPERATIONAL} role={role} onNavigate={setActive}/>;
  else if (active === 'Carte interactive') content = <InteractiveMap dataStore={navigationContext.mapRows?{Infrastructures:{rows:navigationContext.mapRows}}:dataStore} focusSupportId={mapFocusSupportId} onClearFocus={() => setMapFocusSupportId('')} onNavigate={navigateToView} onBackToInfrastructures={() => setActive('Infrastructures')} hasInfrastructureContext={navigationContext.sourceView==='infrastructures'} role={role}/>;
  else if (active === 'Application terrain') content = <TerrainApp dataStore={dataStore} role={role} session={session}/>;
  else if (active === 'Recherche terrain') content = <div className="dashboard"><FieldSearch dataStore={dataStore}/></div>;
  else if (active === 'Bons de travail') content = <WorkOrdersPanel dataStore={dataStore} role={role} session={session}/>;
  else if (tableConfig[active] && !dataStore?.[active]) content = <ScreenFallback/>;
  else content = <TableView name={active} dataStore={dataStore} rolePermission={rolePermission} role={role} initialSupportId={navigationContext.open360?navigationContext.supportId:''} initialGridContext={active==='Infrastructures'?navigationContext:null} onRowsUpdated={applyUpdatedRows} onOpenMap={(supportId,context) => { setNavigationContext(context||{}); setMapFocusSupportId(String(supportId || '')); window.history.pushState({view:'map',sourceView:context?.sourceView||null},''); setActive('Carte interactive'); }}/>;

  return <div className="app">
    <GlobalButtonFeedback/>{userPreviewOpen&&<UserViewPreview onClose={()=>setUserPreviewOpen(false)}/>}
    <aside>
      <div className="brand"><BrandLogo priority/><span>Display Manager</span></div>
      <span className="role-badge">{profile?.nom || session?.user?.email}<br/>{role}</span>
      {role==='Administrateur'&&!getUserViewPreview()&&<button onClick={()=>setUserPreviewOpen(true)}>Voir en tant que</button>}{items.map(it => <button key={it} className={active === it ? 'active' : ''} onClick={() => { if (it === 'Carte interactive') { setNavigationContext({}); setMapFocusSupportId(''); } setActive(it); }}>{it === 'Tableau de bord' ? '📊' : it === 'Administration' ? '⚙️' : it === 'Utilisateurs réels' ? '👤' : it === 'Édition — Historique' ? '🕘' : it === 'Photos et inventaire' ? '🖼️' : it === 'Centre EDT et BT' ? '🛠️' : it === 'Rapports finaux' ? '📨' : it === 'Visibilité par rôle' ? '👁️' : it === 'Automatisations' ? '🤖' : it === 'Import anciennes photos' ? '📥' : it === 'Campagnes maîtres' ? '🎯' : it === 'Campagne — Visuels et formats' ? '🖼️' : it === 'Carte interactive' ? '🗺️' : it === 'Application terrain' ? '📱' : it === 'Recherche terrain' ? '🔎' : (icons[it] || '📋')} {it}</button>)}
      <button className="sidebar-logout" onClick={logoutFromPortal}><LogOut size={17}/> Déconnexion</button>
    </aside>
    <main>{dataStore?.__sync_error__&&<div className="sync-error-banner"><strong>Données momentanément indisponibles</strong><span>La dernière mise à jour n’a pas pu être chargée.</span><button onClick={refreshDataStore}>Réessayer</button></div>}<Suspense fallback={<ScreenFallback/>}>{content}</Suspense></main>
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
