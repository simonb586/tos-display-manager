import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Search, Download, FileSpreadsheet, FileText, ShieldCheck, BarChart3,
  ClipboardList, Bell, Lock, LogOut, MapPin, Edit3, Save, X, History
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
import InteractiveMap from './components/InteractiveMap';
import RoleVisibilityAdmin from './components/RoleVisibilityAdmin';
import FinalReportsCenter from './components/FinalReportsCenter';
import EditableField from './components/EditableField';
import ChangeHistoryPanel from './components/ChangeHistoryPanel';
import PhotoInventoryCenter from './components/PhotoInventoryCenter';
import OperationsCenter from './components/OperationsCenter';
import GlobalButtonFeedback from './components/GlobalButtonFeedback';
import ColumnRelationMenu from './components/ColumnRelationMenu';
import AccountActivation from './components/AccountActivation';
import InstallerTerrainShell from './components/InstallerTerrainShell';
import TerrainSyncDiagnostics from './components/TerrainSyncDiagnostics';
import { infrastructureMapUrl } from './services/mapService';
import { getCurrentProfile } from './services/authProfileService';
import { getRoleVisibility, canSeeTable, columnsForTable } from './services/roleVisibilityService';
import { updateUniversalRow, updateUniversalRows, loadAutomaticFieldRules, primaryKeyFor } from './services/universalEditorService';
import { requiresAccountActivation } from './services/accountActivationService';

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

const INFRASTRUCTURE_LABELS = {
  support_id: 'Support ID',
  type_support: 'Type de support',
  format_affichage: 'Formats d’affichage',
  medium_recommande: 'Médium recommandé',
  emplacement_visibilite: 'Emplacement / visibilité',
  site: 'Site',
  type_site: 'Type de site',
  ligne_distribution: 'Ligne de distribution',
  type_ligne_distribution: 'Type de ligne de distribution',
  enjeux: 'Enjeux',
  type_enjeux: 'Type d’enjeux',
  actif: 'Actif',
  campagne_selon_visuel: 'Campagne selon le visuel',
  visuel_en_expo: 'Visuel en exposition',
  commentaires: 'Commentaires',
  campagne_actuelle: 'Nom de la campagne actuelle',
  visuel_campagne: 'Visuel de la campagne',
  visuel_actuel_cadre: 'Visuel actuel du cadre',
  date_derniere_manipulation: 'Date de la dernière manipulation',
  edt_associe: 'EDT associé',
  campagne_precedente: 'Campagne précédente',
  edt_precedent_associe: 'EDT précédent associé',
  coordonnees_gps: 'Coordonnées GPS',
  latitude: 'Latitude',
  longitude: 'Longitude',
  prochain_edt_cible: 'Prochain EDT ciblé',
  lien_carte_interactive: 'Lien vers la carte interactive'
};

const ALWAYS_HIDDEN_COLUMNS = {
  Infrastructures: ['format_visuel', 'photo_miniature_url', 'photo_principale_url']
};

const getRows = (dataStore, name) =>
  dataStore?.[name]?.rows || tableConfig[name]?.fallback || [];

const getCols = (rows, name) => {
  if (!rows?.length) return [];
  const hidden = new Set([
    'raw_data',
    'created_at',
    'updated_at',
    ...(ALWAYS_HIDDEN_COLUMNS[name] || [])
  ]);
  return Object.keys(rows[0]).filter(column => !hidden.has(column));
};

const columnLabel = (tableName, column) =>
  tableName === 'Infrastructures'
    ? (INFRASTRUCTURE_LABELS[column] || column)
    : column;

const sourceLabel = (dataStore, name) => dataStore?.[name]?.source || 'json';

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
      ? <img className="infrastructure-thumbnail" src={url} alt={`Photo du support ${row.support_id || ''}`}/>
      : <span className="infrastructure-thumbnail-missing">Aucune photo</span>;
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
      <div><h1>TOS Display Manager <span>v0.12.7.2</span></h1><p>Données, campagnes, relations, terrain, photos et validation système.</p></div>
      <div className="badge"><ShieldCheck/> {supabaseConfigured ? 'Supabase configuré' : 'Mode JSON local'}</div>
    </div>
    <div className="cards"><Card title="Infrastructures" value={infrastructures.length}/><Card title="Arrêts" value={arrets.length}/><Card title="EDT" value={edt.length}/><Card title="Bons de travail" value={bt.length}/></div>
    <div className="dashboard-v12-grid">
      <div className="dashboard-v12-card"><h3>Enjeux ouverts</h3><strong>{getRows(dataStore, 'Enjeux des cadres et supports').length.toLocaleString('fr-CA')}</strong><p>Éléments nécessitant un suivi.</p></div>
      <div className="dashboard-v12-card"><h3>Photos</h3><strong>{getRows(dataStore, 'Photos').length.toLocaleString('fr-CA')}</strong><p>Preuves et miniatures disponibles.</p></div>
      <div className="dashboard-v12-card"><h3>Campagnes</h3><strong>{getRows(dataStore, 'Campagnes et visuels').length.toLocaleString('fr-CA')}</strong><p>Campagnes et visuels suivis.</p></div>
    </div>
    <div className="grid2">
      <section className="panel"><h2><BarChart3/> Avancement des EDT</h2>{edtData.map(e => <div className="progress" key={e.name}><span>{e.name}</span><div><i style={{ width: `${Math.min(100, e.progress)}%` }}/></div><b>{e.progress}%</b></div>)}<button onClick={() => setActive('Suivi des EDT')}>Ouvrir le suivi des EDT</button></section>
      <section className="panel"><h2><Bell/> Modules v0.7</h2><ul className="checks"><li>Données complètes paginées.</li><li>Campagnes, phases, visuels et formats.</li><li>Studio des relations et Centre de validation.</li><li>Application terrain filtrée selon le format du support.</li></ul></section>
    </div>
  </div>;
}

function Card({ title, value }) { return <div className="card"><ClipboardList/><span>{title}</span><strong>{Number(value || 0).toLocaleString('fr-CA')}</strong></div>; }

function TableView({ name, dataStore, onOpenMap, rolePermission, role, onRowsUpdated }) {
  const rows = getRows(dataStore, name);
  const config = tableConfig[name];
  const allCols = getCols(rows, name);
  const cols = columnsForTable(rolePermission, name, allCols);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({});
  const [selected, setSelected] = useState(null);
  const [gridEditing, setGridEditing] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const filtered = useMemo(() => rows
    .filter(r => strictMatches(r, query, cols))
    .filter(r => Object.entries(filters).every(([c, v]) => !v || normalize(r[c]).includes(normalize(v)))), [rows, query, filters, cols]);
  const shown = filtered.slice(0, 200);
  const hasMapColumn = name === 'Infrastructures';
  const canEdit = role === 'Administrateur';

  function rowToken(row, index) {
    try {
      const key = primaryKeyFor(config, row);
      return `${key.field}:${key.value}`;
    } catch {
      return `row:${index}`;
    }
  }

  function changeCell(row, index, column, value) {
    const token = rowToken(row, index);
    setDrafts(current => ({
      ...current,
      [token]: {
        originalRow: row,
        changes: {
          ...(current[token]?.changes || {}),
          [column]: value
        }
      }
    }));
  }

  async function saveGrid() {
    const entries = Object.values(drafts);
    if (!entries.length) {
      setGridEditing(false);
      return;
    }

    if (!window.confirm(`Enregistrer ${entries.length} ligne(s) modifiée(s) dans ${name}?`)) return;

    setSaving(true);
    setMessage('');

    try {
      const updated = await updateUniversalRows({ config, entries });
      onRowsUpdated(name, updated);
      setDrafts({});
      setGridEditing(false);
      setMessage(`${updated.length} ligne(s) enregistrée(s).`);
    } catch (error) {
      setMessage(`Erreur : ${error.message || error}`);
    } finally {
      setSaving(false);
    }
  }

  return <div className="tablePage">
    <header className="pageHead"><div><h1>{icons[name] || '📋'} {name}</h1><p>{filtered.length.toLocaleString('fr-CA')} résultat(s) sur {rows.length.toLocaleString('fr-CA')} ligne(s). Source : {sourceLabel(dataStore, name)}.</p></div><div className="actions">
      {canEdit && !gridEditing && <button onClick={() => { setGridEditing(true); setMessage(''); }}><Edit3/> Modifier la grille</button>}
      <button onClick={() => downloadCSV(`${name}_table_complete.csv`, rows, cols)}><Download/> Table complète</button>
      <button onClick={() => downloadCSV(`${name}_resultats_filtres.csv`, filtered, cols)}><FileSpreadsheet/> Résultats filtrés</button>
    </div></header>

    {gridEditing && <div className="grid-edit-toolbar">
      <button className="grid-edit-primary" disabled={saving} onClick={saveGrid}><Save size={17}/> {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}</button>
      <button className="grid-edit-secondary" onClick={() => { setDrafts({}); setGridEditing(false); }}><X size={17}/> Annuler</button>
      <span className="grid-edit-note">{Object.keys(drafts).length} ligne(s) modifiée(s). Clique directement dans les cellules.</span>
    </div>}

    {message && <div className="v07-message">{message}</div>}

    <div className="searchbar"><Search/><input placeholder="Recherche exacte dans toutes les colonnes..." value={query} onChange={e => setQuery(e.target.value)}/></div>
    <div className="tableWrap"><table><thead><tr>{hasMapColumn && <th>Carte</th>}{cols.map(c => <th key={c}><div className="grid-column-header"><div className="grid-column-header-main"><span>{columnLabel(name, c)}</span><input placeholder="Filtrer" value={filters[c] || ''} onChange={e => setFilters({ ...filters, [c]: e.target.value })}/></div><ColumnRelationMenu sourceTable={config.table} sourceField={c} role={role}/></div></th>)}</tr></thead><tbody>{shown.map((r, i) => {
      const token = rowToken(r, i);
      const supportId = r.support_id || r['Support ID'] || '';
      const mapUrl = infrastructureMapUrl(r);
      return <tr key={token} className={drafts[token] ? 'editing-row' : ''} onClick={() => !gridEditing && setSelected(r)}>
        {hasMapColumn && <td>
          {mapUrl
            ? <button className="table-map-button" title={`Ouvrir ${supportId} sur la carte`} onClick={event => {
                event.stopPropagation();
                onOpenMap?.(supportId);
              }}><MapPin size={16}/> Carte</button>
            : <span className="table-map-missing">GPS absent</span>}
        </td>}
        {cols.map(c => {
          const changed = Object.prototype.hasOwnProperty.call(drafts[token]?.changes || {}, c);
          const value = changed ? drafts[token].changes[c] : r[c];
          return <td key={c} className={gridEditing ? `grid-edit-cell ${changed ? 'changed' : ''}` : ''}>
            {gridEditing
              ? <EditableField column={c} value={value} compact onChange={next => changeCell(r, i, c, next)}/>
              : renderTableCell(name, r, c)}
          </td>;
        })}
      </tr>;
    })}</tbody></table></div>
    {selected && <Detail name={name} row={selected} role={role} config={config} onSaved={updated => { onRowsUpdated(name, [updated]); setSelected(updated); }} onClose={() => setSelected(null)} onOpenMap={onOpenMap}/>}
  </div>;
}

function Detail({ name, row, role, config, onSaved, onClose, onOpenMap }) {
  const cols = getCols([row], name);
  const support = row.support_id || row.no_arret || row.related_support || row['Support ID'] || '';
  const mapUrl = name === 'Infrastructures' ? infrastructureMapUrl(row) : '';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row);
  const [rules, setRules] = useState({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const canEdit = role === 'Administrateur';

  useEffect(() => {
    loadAutomaticFieldRules(config.table).then(setRules);
  }, [config.table]);

  async function save() {
    const changes = Object.fromEntries(
      cols
        .filter(column => draft[column] !== row[column])
        .map(column => [column, draft[column]])
    );

    if (!Object.keys(changes).length) {
      setEditing(false);
      return;
    }

    if (!window.confirm(`Enregistrer les modifications de cette fiche ${name}?`)) return;

    setSaving(true);
    try {
      const updated = await updateUniversalRow({ config, originalRow: row, changes });
      setDraft(updated);
      onSaved(updated);
      setEditing(false);
      setMessage('Fiche enregistrée.');
    } catch (error) {
      setMessage(`Erreur : ${error.message || error}`);
    } finally {
      setSaving(false);
    }
  }

  return <div className="drawer"><div className="drawerPanel"><button className="close" onClick={onClose}>×</button><h2>Fiche 360° — {name}</h2>{support && <div className="support">Identifiant : <b>{support}</b></div>}

    {canEdit && <div className="detail-edit-actions">
      {!editing
        ? <button className="grid-edit-primary" onClick={() => { setDraft(row); setEditing(true); setMessage(''); }}><Edit3 size={17}/> Modifier la fiche</button>
        : <>
            <button className="grid-edit-primary" disabled={saving} onClick={save}><Save size={17}/> Enregistrer</button>
            <button className="grid-edit-secondary" onClick={() => { setDraft(row); setEditing(false); }}><X size={17}/> Annuler</button>
          </>}
    </div>}

    {message && <div className="v07-message">{message}</div>}
    {mapUrl && <button className="detail-map-button" onClick={() => onOpenMap?.(support)}><MapPin size={17}/> Voir ce support sur la carte interactive</button>}

    <div className="detailGrid">{cols.map(c => {
      if (!editing && name === 'Infrastructures' && c === 'visuel_actuel_cadre') {
        const url = thumbnailForInfrastructure(row);
        return <div key={c} className="detail-photo-card"><label>{columnLabel(name, c)}</label>{url
          ? <img src={url} alt={`Photo du support ${support}`}/>
          : <p>Aucune photo associée.</p>}</div>;
      }

      const rule = rules[c];
      return <div key={c}>
        <label>{columnLabel(name, c)}</label>
        {editing
          ? <>
              <EditableField column={c} value={draft[c]} onChange={value => setDraft(current => ({ ...current, [c]: value }))}/>
              {rule && !rule.is_primary_source && <small className="automatic-field-warning">Champ alimenté automatiquement depuis {rule.source_table || 'une relation'}.{rule.source_field || ''}. Une propagation future pourrait remplacer la valeur.</small>}
            </>
          : <p>{String(row[c] ?? '—')}</p>}
      </div>;
    })}</div>
    {name === 'Infrastructures' && support && <SupportPhotoGallery supportId={support}/>}
  </div></div>;
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
  const [loading, setLoading] = useState(false);
  const [mapFocusSupportId, setMapFocusSupportId] = useState('');
  const [rolePermission, setRolePermission] = useState({ visible_tables: ['*'], visible_columns: {} });

  async function refreshDataStore() {
    if (!session) return null;
    try {
      const ds = await loadManyTables(tableConfig);
      setDataStore(ds);
      return ds;
    } catch (error) {
      console.error('Rafraîchissement Supabase impossible', error);
      setDataStore(current => ({...current,__sync_error__:{rows:[],source:'error',error,complete:false}}));
      return null;
    }
  }

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    refreshDataStore().finally(() => setLoading(false));
  }, [session?.user?.id]);

  useEffect(() => {
    if (!supabase || !session) return undefined;
    const refresh = () => refreshDataStore();
    window.addEventListener('tos-terrain-data-updated', refresh);
    const channel = supabase
      .channel(`tos-terrain-live-sync-${session.user.id}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'infrastructures'},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'support_photos'},refresh)
      .subscribe();
    return () => {window.removeEventListener('tos-terrain-data-updated',refresh);supabase.removeChannel(channel);};
  }, [session?.user?.id]);

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

  useEffect(() => {
    let cancelled = false;

    getRoleVisibility(role)
      .then(permission => {
        if (!cancelled) setRolePermission(permission);
      })
      .catch(error => {
        console.error('Permissions d’interface introuvables', error);
      });

    return () => { cancelled = true; };
  }, [role]);

  const adminItems = role === 'Administrateur'
    ? ['Administration', 'Utilisateurs réels', 'Visibilité par rôle', 'Édition — Historique', 'Photos et inventaire', 'Centre EDT et BT', 'Diagnostic terrain', 'Rapports finaux', 'Studio des relations', 'Validation système', 'Import anciennes photos', 'Campagnes maîtres', 'Campagne — Visuels et formats']
    : role === 'Coordonnateur'
      ? ['Validation système', 'Campagnes maîtres', 'Campagne — Visuels et formats']
      : [];
  const visibleManifestTables = manifest
    .map(module => module.name)
    .filter(tableName => canSeeTable(rolePermission, tableName));

  const items = [
    'Tableau de bord',
    ...adminItems,
    'Carte interactive',
    'Application terrain',
    'Recherche terrain',
    ...visibleManifestTables
  ];

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

  if (!supabaseConfigured) return <SupabaseConfigurationError/>;
  if (profileLoading || (session && loading)) return <div className="login"><div className="loginCard"><h1>Chargement TDM...</h1><p>Validation de la session, du profil et des données Supabase.</p></div></div>;
  if (!session) return <ProductionLogin/>;

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

  if (role === 'Installateur') {
    return <InstallerTerrainShell
      dataStore={dataStore}
      role={role}
      session={session}
      profile={profile}
      onLogout={() => {
        setSession(null);
        setProfile(null);
      }}
    />;
  }

  let content;
  if (active === 'Tableau de bord') content = <Dashboard setActive={setActive} dataStore={dataStore}/>;
  else if (active === 'Connexion') content = <LoginView session={session} setSession={setSession} role={role} setRole={setRole}/>;
  else if (active === 'Administration') content = <AdminPanel role={role} currentRole={role} session={session}/>;
  else if (active === 'Utilisateurs réels') content = <UserProvisioningPanel role={role}/>;
  else if (active === 'Édition — Historique') content = <ChangeHistoryPanel role={role}/>;
  else if (active === 'Photos et inventaire') content = <PhotoInventoryCenter role={role}/>;
  else if (active === 'Centre EDT et BT') content = <OperationsCenter role={role}/>;
  else if (active === 'Diagnostic terrain') content = <TerrainSyncDiagnostics role={role}/>;
  else if (active === 'Rapports finaux') content = <FinalReportsCenter dataStore={dataStore} role={role}/>;
  else if (active === 'Visibilité par rôle') content = <RoleVisibilityAdmin dataStore={dataStore} tableNames={manifest.map(module => module.name)} role={role}/>;
  else if (active === 'Studio des relations') content = <RelationsStudio role={role}/>;
  else if (active === 'Validation système') content = <ValidationCenter role={role}/>;
  else if (active === 'Import anciennes photos') content = <LegacyPhotoImporter dataStore={dataStore} session={session}/>;
  else if (active === 'Campagnes maîtres') content = <CampaignsPanel role={role} session={session}/>;
  else if (active === 'Campagne — Visuels et formats') content = <CampaignVisualManager role={role}/>;
  else if (active === 'Carte interactive') content = <InteractiveMap dataStore={dataStore} focusSupportId={mapFocusSupportId} onClearFocus={() => setMapFocusSupportId('')}/>;
  else if (active === 'Application terrain') content = <TerrainApp dataStore={dataStore} role={role} session={session}/>;
  else if (active === 'Recherche terrain') content = <div className="dashboard"><FieldSearch dataStore={dataStore}/></div>;
  else if (active === 'Bons de travail') content = <WorkOrdersPanel dataStore={dataStore} role={role} session={session}/>;
  else content = <TableView name={active} dataStore={dataStore} rolePermission={rolePermission} role={role} onRowsUpdated={applyUpdatedRows} onOpenMap={supportId => { setMapFocusSupportId(String(supportId || '')); setActive('Carte interactive'); }}/>;

  return <div className="app">
    <GlobalButtonFeedback/>
    <aside>
      <div className="brand">TOS<span>Display Manager</span></div>
      <span className="role-badge">{profile?.nom || session?.user?.email}<br/>{role}</span>
      {items.map(it => <button key={it} className={active === it ? 'active' : ''} onClick={() => setActive(it)}>{it === 'Tableau de bord' ? '📊' : it === 'Administration' ? '⚙️' : it === 'Utilisateurs réels' ? '👤' : it === 'Édition — Historique' ? '🕘' : it === 'Photos et inventaire' ? '🖼️' : it === 'Centre EDT et BT' ? '🛠️' : it === 'Diagnostic terrain' ? '🧪' : it === 'Rapports finaux' ? '📨' : it === 'Visibilité par rôle' ? '👁️' : it === 'Studio des relations' ? '🔗' : it === 'Validation système' ? '✅' : it === 'Import anciennes photos' ? '📥' : it === 'Campagnes maîtres' ? '🎯' : it === 'Campagne — Visuels et formats' ? '🖼️' : it === 'Carte interactive' ? '🗺️' : it === 'Application terrain' ? '📱' : it === 'Recherche terrain' ? '🔎' : (icons[it] || '📋')} {it}</button>)}
      <button className="sidebar-logout" onClick={logoutFromPortal}><LogOut size={17}/> Déconnexion</button>
    </aside>
    <main>{dataStore?.__sync_error__&&<div className="sync-error-banner"><strong>Erreur de lecture Supabase</strong><span>Les données locales ne sont pas utilisées en production.</span><button onClick={refreshDataStore}>Recharger depuis Supabase</button></div>}{content}</main>
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
