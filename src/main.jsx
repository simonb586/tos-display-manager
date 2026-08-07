import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
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

import manifest from './data/manifest.json';
import {
  strictMatches,
  downloadCSV,
  downloadExcel,
  downloadPDF,
  professionalExportName,
  normalize
} from './lib/utils';
import { sortRows } from './lib/gridSorting';
import { supabase, supabaseConfigured } from './lib/supabaseClient';
import { businessFieldLabel, enforceApplicationTitle, friendlyError } from './config/businessLanguage';
import GridColumnHeader from './components/GridColumnHeader';
import GridPagination from './components/GridPagination';
import { defaultSortColumnForTable } from './lib/gridPresentation';
import { defaultSortForColumn } from './lib/gridSorting';
import { loadManyTables } from './services/dataService';
import { loadTerrainSyncStatus } from './services/terrainSyncStatus';

import SupportPhotoGallery from './components/SupportPhotoGallery';
import Support360Panel from './components/Support360Panel';
import EditableField from './components/EditableField';
import ChangeHistoryPanel from './components/ChangeHistoryPanel';
import GlobalButtonFeedback from './components/GlobalButtonFeedback';
import RecentActivityWidget from './components/RecentActivityWidget';
import AccountActivation from './components/AccountActivation';
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
const InteractiveMap = lazy(() => import('./components/InteractiveMap'));
const RoleVisibilityAdmin = lazy(() => import('./components/RoleVisibilityAdmin'));
const FinalReportsCenter = lazy(() => import('./components/FinalReportsCenter'));
const PhotoInventoryCenter = lazy(() => import('./components/PhotoInventoryCenter'));
const OperationsCenter = lazy(() => import('./components/OperationsCenter'));
const InstallerTerrainShell = lazy(() => import('./components/InstallerTerrainShell'));
const TerrainSyncDiagnostics = lazy(() => import('./components/TerrainSyncDiagnostics'));
const ActivityJournal = lazy(() => import('./components/ActivityJournal'));
const AutomationAssistant = lazy(() => import('./components/AutomationAssistant'));
const FieldCatalogManager = lazy(() => import('./components/FieldCatalogManager'));

function ScreenFallback() {
  return <div className="screen-fallback" role="status" aria-live="polite"><span aria-hidden="true"/>Chargement du module…</div>;
}

const tableConfig = {
  Infrastructures: { table: 'infrastructures', fallback: () => import('./data/infrastructures.json').then(module => module.default), idField: 'support_id', labelField: 'emplacement_visibilite' },
  'Campagnes et visuels': { table: 'campagnes_et_visuels', fallback: () => import('./data/campagnes_et_visuels.json').then(module => module.default) },
  'Répertoire des affiches': { table: 'repertoire_des_affiches', fallback: () => import('./data/repertoire_des_affiches.json').then(module => module.default) },
  'Communications opérationnelles': { table: 'communications_operationnelles', fallback: () => import('./data/communications_operationnelles.json').then(module => module.default) },
  'Enjeux des cadres et supports': { table: 'enjeux_des_cadres_et_supports', fallback: () => import('./data/enjeux_des_cadres_et_supports.json').then(module => module.default) },
  "Centres d’information": { table: 'centres_dinformation', fallback: () => import('./data/centres_dinformation.json').then(module => module.default) },
  'C.I. avec enjeux': { table: 'ci_avec_enjeux', fallback: () => import('./data/c_i_avec_enjeux.json').then(module => module.default) },
  'Liste des arrêts': { table: 'liste_des_arrets', fallback: () => import('./data/liste_des_arrets.json').then(module => module.default), idField: 'no_arret', labelField: 'emplacement_visibilite' },
  'Voitures / trains': { table: 'voitures_trains', fallback: () => import('./data/voitures_trains.json').then(module => module.default) },
  Photos: { table: 'photos', fallback: () => import('./data/photos.json').then(module => module.default) },
  'Bons de travail': { table: 'bons_de_travail', fallback: () => import('./data/bons_de_travail.json').then(module => module.default) },
  'Historique des campagnes': { table: 'historique_des_campagnes', fallback: () => import('./data/historique_des_campagnes.json').then(module => module.default) },
  'Suivi des EDT': { table: 'suivi_des_edt', fallback: () => import('./data/suivi_des_edt.json').then(module => module.default) },
  Utilisateurs: { table: 'utilisateurs', fallback: () => import('./data/utilisateurs.json').then(module => module.default) },
  Clients: { table: 'clients', fallback: () => import('./data/clients.json').then(module => module.default) },
  'Journal des événements': { table: 'journal_des_evenements', fallback: () => import('./data/journal_des_evenements.json').then(module => module.default) }
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
  support_id: 'Numéro du support',
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
  visuel_precedent: 'Visuel précédent',
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
  dataStore?.[name]?.rows || [];

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
      <div className="hero-brand"><BrandLogo/><div><h1>TOS Display Manager</h1><p>Données, campagnes, relations, terrain, photos et validation système.</p></div></div>
      <div className="badge"><ShieldCheck/> Espace opérationnel sécurisé</div>
    </div>
    <div className="cards"><Card title="Infrastructures" value={infrastructures.length}/><Card title="Arrêts" value={arrets.length}/><Card title="EDT" value={edt.length}/><Card title="Bons de travail" value={bt.length}/></div>
    <div className="dashboard-v12-grid">
      <div className="dashboard-v12-card"><h3>Enjeux ouverts</h3><strong>{getRows(dataStore, 'Enjeux des cadres et supports').length.toLocaleString('fr-CA')}</strong><p>Éléments nécessitant un suivi.</p></div>
      <div className="dashboard-v12-card"><h3>Photos</h3><strong>{getRows(dataStore, 'Photos').length.toLocaleString('fr-CA')}</strong><p>Preuves et miniatures disponibles.</p></div>
      <div className="dashboard-v12-card"><h3>Campagnes</h3><strong>{getRows(dataStore, 'Campagnes et visuels').length.toLocaleString('fr-CA')}</strong><p>Campagnes et visuels suivis.</p></div>
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
  const campaigns=getRows(dataStore,'Campagnes et visuels');
  const edt=getRows(dataStore,'Suivi des EDT');
  const photos=getRows(dataStore,'Photos');
  const issues=getRows(dataStore,'Enjeux des cadres et supports');
  const work=getRows(dataStore,'Bons de travail');
  const activeInfra=infra.filter(row=>![false,'false','inactif','inactive'].includes(typeof row.actif==='string'?normalize(row.actif):row.actif)).length;
  const activeCampaigns=campaigns.filter(row=>['active','actif','en cours'].includes(normalize(row.statut_campagne||row.statut))).length;
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
    <header className="executive-hero"><div className="hero-brand"><BrandLogo priority/><div><span className="eyebrow">Centre de pilotage</span><h1>Vue exécutive</h1><p>État opérationnel consolidé à partir des données disponibles.</p></div></div><div className="executive-status"><span className="status-dot"/> Données {dataStore?.__sync_error__?'partiellement disponibles':'synchronisées'}</div></header>
    <section className="executive-kpis" aria-label="Indicateurs clés">{metrics.map(([label,value,target,Icon])=><button key={label} className="executive-kpi" onClick={()=>setActive(target)}><span><Icon/>{label}</span><strong>{value==null?'Non disponible':typeof value==='number'?value.toLocaleString('fr-CA'):value}</strong><small>Ouvrir le module</small></button>)}</section>
    <section className="executive-layout">
      <RecentActivityWidget onNavigate={setActive} role={role} permission={rolePermission}/>
      <div className="executive-stack"><article className="executive-panel"><header><div><span className="eyebrow">À surveiller</span><h2>Priorités</h2></div><Bell/></header>{priorities.length?<ul className="priority-list">{priorities.map(item=><li key={item}>{item}</li>)}</ul>:<div className="executive-empty">Aucune priorité calculable.</div>}</article><article className="executive-panel"><header><div><span className="eyebrow">Navigation</span><h2>Accès rapides</h2></div></header><div className="quick-actions">{[['Application terrain','Terrain'],['Carte interactive','Carte'],['Infrastructures','Supports'],['Rapports finaux','Rapports']].map(([target,label])=><button key={target} onClick={()=>setActive(target)}>{label}<ChevronRight/></button>)}</div></article></div>
    </section>
  </div>;
}

function TableView({ name, dataStore, onOpenMap, rolePermission, role, onRowsUpdated }) {
  const rows = getRows(dataStore, name);
  const config = tableConfig[name];
  const allCols = getCols(rows, name);
  const cols = columnsForTable(rolePermission, name, allCols);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({});
  const [sortState, setSortState] = useState(() => {
    try {
      const stored=JSON.parse(sessionStorage.getItem(`tdm-grid-sort:${name}`));
      if(stored)return stored;
    } catch {
      // Revenir au classement métier par défaut.
    }
    const column=defaultSortColumnForTable(name,cols);
    return column?defaultSortForColumn(rows,column):null;
  });
  const [selected, setSelected] = useState(null);
  const [gridEditing, setGridEditing] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedRows, setSelectedRows] = useState(()=>new Set());

  const filtered = useMemo(() => rows
    .filter(r => strictMatches(r, query, cols))
    .filter(r => Object.entries(filters).every(([c, v]) => !v || normalize(r[c]).includes(normalize(v)))), [rows, query, filters, cols]);
  const sorted = useMemo(() => sortRows(filtered, sortState), [filtered, sortState]);
  const sortedComplete = useMemo(() => sortRows(rows, sortState), [rows, sortState]);
  const pageCount = Math.max(1,Math.ceil(sorted.length/pageSize));
  const currentPage = Math.min(page,pageCount);
  const shown = sorted.slice((currentPage-1)*pageSize,currentPage*pageSize);
  const selectedFiltered = sorted.filter((row,index)=>selectedRows.has(rowToken(row,index)));
  const hasMapColumn = name === 'Infrastructures';
  const canEdit = role === 'Administrateur';
  const exportLabels = Object.fromEntries(cols.map(column=>[column,columnLabel(name,column)]));
  const exportOptions = {moduleName:name,labels:exportLabels,filters:{recherche:query,...filters},sortState};

  useEffect(() => {
    const key = `tdm-grid-sort:${name}`;
    if (sortState) sessionStorage.setItem(key, JSON.stringify(sortState));
    else sessionStorage.removeItem(key);
  }, [name, sortState]);

  useEffect(()=>setPage(1),[query,filters,sortState,pageSize,name]);

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
      setMessage(friendlyError(error, 'Impossible d’enregistrer ces modifications.'));
    } finally {
      setSaving(false);
    }
  }

  return <div className="tablePage">
    <header className="pageHead"><div><h1>{icons[name] || '📋'} {name}</h1><p>{filtered.length.toLocaleString('fr-CA')} résultat(s) sur {rows.length.toLocaleString('fr-CA')} ligne(s).</p></div><div className="actions">
      {canEdit && !gridEditing && <button onClick={() => { setGridEditing(true); setMessage(''); }}><Edit3/> Modifier la grille</button>}
      <button onClick={() => downloadCSV(professionalExportName(name,'csv'), hasMapColumn?shown:sortedComplete, cols.map(key=>({key,label:exportLabels[key]})))}><Download/> CSV {hasMapColumn?'page visible':'complet trié'}</button>
      {hasMapColumn&&<button disabled={!selectedFiltered.length} onClick={() => downloadExcel(professionalExportName(name,'xlsx'), selectedFiltered, cols, {...exportOptions,exportType:'Sélection'})}><FileSpreadsheet/> Excel sélection ({selectedFiltered.length})</button>}
      <button onClick={() => downloadPDF(professionalExportName(name,'pdf'), `${name} — résultats filtrés`, sorted, cols, exportOptions)}><FileText/> PDF ensemble filtré</button>
    </div></header>

    {gridEditing && <div className="grid-edit-toolbar">
      <button className="grid-edit-primary" disabled={saving} onClick={saveGrid}><Save size={17}/> {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}</button>
      <button className="grid-edit-secondary" onClick={() => { setDrafts({}); setGridEditing(false); }}><X size={17}/> Annuler</button>
      <span className="grid-edit-note">{Object.keys(drafts).length} ligne(s) modifiée(s). Clique directement dans les cellules.</span>
    </div>}

    {message && <div className="v07-message">{message}</div>}

    <div className="searchbar"><Search/><input placeholder="Recherche exacte dans toutes les colonnes..." value={query} onChange={e => setQuery(e.target.value)}/></div>
    <div className="tableWrap professional-grid"><table><thead><tr>{hasMapColumn&&<th className="selection-column"><input type="checkbox" aria-label="Sélectionner la page" checked={shown.length>0&&shown.every((row,index)=>selectedRows.has(rowToken(row,(currentPage-1)*pageSize+index)))} onChange={event=>setSelectedRows(current=>{const next=new Set(current);shown.forEach((row,index)=>{const token=rowToken(row,(currentPage-1)*pageSize+index);event.target.checked?next.add(token):next.delete(token)});return next})}/></th>}{hasMapColumn && <th className="action-column">Carte</th>}{cols.map(c => <GridColumnHeader key={c} column={c} label={columnLabel(name,c)} rows={filtered} filterValue={filters[c]} onFilter={value=>setFilters({...filters,[c]:value})} sortState={sortState} onSort={setSortState} onReset={()=>setSortState(null)}/>)}</tr></thead><tbody>{shown.map((r, i) => {
      const token = rowToken(r, (currentPage-1)*pageSize+i);
      const supportId = r.support_id || r['Support ID'] || '';
      const mapUrl = infrastructureMapUrl(r);
      return <tr key={token} className={drafts[token] ? 'editing-row' : ''} onClick={() => !gridEditing && setSelected(r)}>
        {hasMapColumn&&<td className="selection-column" onClick={event=>event.stopPropagation()}><input type="checkbox" aria-label={`Sélectionner ${supportId}`} checked={selectedRows.has(token)} onChange={()=>setSelectedRows(current=>{const next=new Set(current);next.has(token)?next.delete(token):next.add(token);return next})}/></td>}
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
    <GridPagination page={currentPage} pageCount={pageCount} pageSize={pageSize} total={sorted.length} selectedCount={hasMapColumn?selectedRows.size:0} onPage={setPage} onPageSize={setPageSize}/>
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
      setMessage(friendlyError(error, 'Impossible d’enregistrer cette fiche.'));
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
    {name === 'Infrastructures' && support && <Support360Panel supportId={support} role={role}/>} 
  </div></div>;
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

function App() {
  enforceApplicationTitle();
  const [active, setActive] = useState('Tableau de bord');
  const [role, setRole] = useState('Administrateur');
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [dataStore, setDataStore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mapFocusSupportId, setMapFocusSupportId] = useState('');
  const [rolePermission, setRolePermission] = useState({ visible_tables: ['*'], visible_columns: {} });
  const [terrainSyncStatus, setTerrainSyncStatus] = useState('État global non centralisé');

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
    if (!session || active !== 'Tableau de bord') return;
    loadTerrainSyncStatus().then(setTerrainSyncStatus);
  }, [session?.user?.id, active]);

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
    ? ['Administration', 'Utilisateurs réels', 'Visibilité par rôle', 'Édition — Historique', 'Photos et inventaire', 'Centre EDT et BT', 'Rapports finaux', 'Automatisations', 'Import anciennes photos', 'Campagnes maîtres', 'Campagne — Visuels et formats']
    : role === 'Coordonnateur'
      ? ['Campagnes maîtres', 'Campagne — Visuels et formats']
      : [];
  const visibleManifestTables = manifest
    .map(module => module.name)
    .filter(tableName => canSeeTable(rolePermission, tableName));

  const items = [
    'Tableau de bord',
    'Centre de commandement',
    ...(role === 'Administrateur' ? ['Gestionnaire des champs'] : []),
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

  if (!supabaseConfigured) return <ServiceConfigurationError/>;
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

  if (role === 'Installateur') {
    return <Suspense fallback={<ScreenFallback/>}><InstallerTerrainShell
      dataStore={dataStore}
      role={role}
      session={session}
      profile={profile}
      onLogout={() => {
        setSession(null);
        setProfile(null);
      }}
    /></Suspense>;
  }

  let content;
  if (active === 'Tableau de bord') content = <ExecutiveDashboard setActive={setActive} dataStore={dataStore} terrainSyncStatus={terrainSyncStatus} role={role} rolePermission={rolePermission}/>;
  else if (active === 'Centre de commandement') content = <OperationalCommandCenter dataStore={dataStore} onNavigate={setActive}/>;
  else if (active === 'Connexion') content = <LoginView session={session} setSession={setSession} role={role} setRole={setRole}/>;
  else if (active === 'Administration') content = <AdminPanel role={role} currentRole={role} session={session}/>;
  else if (active === 'Gestionnaire des champs') content = <FieldCatalogManager role={role}/>;
  else if (active === 'Utilisateurs réels') content = <UserProvisioningPanel role={role}/>;
  else if (active === 'Édition — Historique') content = <ChangeHistoryPanel role={role}/>;
  else if (active === 'Photos et inventaire') content = <PhotoInventoryCenter role={role}/>;
  else if (active === 'Centre EDT et BT') content = <OperationsCenter role={role}/>;
  else if (active === 'Diagnostic terrain') content = <TerrainSyncDiagnostics role={role}/>;
  else if (active === 'Journal des événements') content = <ActivityJournal role={role}/>;
  else if (active === 'Rapports finaux') content = <FinalReportsCenter dataStore={dataStore} role={role}/>;
  else if (active === 'Visibilité par rôle') content = <RoleVisibilityAdmin dataStore={dataStore} tableNames={manifest.map(module => module.name)} role={role}/>;
  else if (active === 'Automatisations') content = <AutomationAssistant role={role}/>;
  else if (active === 'Validation système') content = <ValidationCenter role={role}/>;
  else if (active === 'Import anciennes photos') content = <LegacyPhotoImporter dataStore={dataStore} session={session}/>;
  else if (active === 'Campagnes maîtres') content = <CampaignsPanel role={role} session={session}/>;
  else if (active === 'Campagne — Visuels et formats') content = <CampaignVisualManager role={role}/>;
  else if (active === 'Carte interactive') content = <InteractiveMap dataStore={dataStore} focusSupportId={mapFocusSupportId} onClearFocus={() => setMapFocusSupportId('')} onNavigate={setActive} role={role}/>;
  else if (active === 'Application terrain') content = <TerrainApp dataStore={dataStore} role={role} session={session}/>;
  else if (active === 'Recherche terrain') content = <div className="dashboard"><FieldSearch dataStore={dataStore}/></div>;
  else if (active === 'Bons de travail') content = <WorkOrdersPanel dataStore={dataStore} role={role} session={session}/>;
  else content = <TableView name={active} dataStore={dataStore} rolePermission={rolePermission} role={role} onRowsUpdated={applyUpdatedRows} onOpenMap={supportId => { setMapFocusSupportId(String(supportId || '')); setActive('Carte interactive'); }}/>;

  return <div className="app">
    <GlobalButtonFeedback/>
    <aside>
      <div className="brand"><BrandLogo priority/><span>Display Manager</span></div>
      <span className="role-badge">{profile?.nom || session?.user?.email}<br/>{role}</span>
      {items.map(it => <button key={it} className={active === it ? 'active' : ''} onClick={() => setActive(it)}>{it === 'Tableau de bord' ? '📊' : it === 'Administration' ? '⚙️' : it === 'Utilisateurs réels' ? '👤' : it === 'Édition — Historique' ? '🕘' : it === 'Photos et inventaire' ? '🖼️' : it === 'Centre EDT et BT' ? '🛠️' : it === 'Rapports finaux' ? '📨' : it === 'Visibilité par rôle' ? '👁️' : it === 'Automatisations' ? '🤖' : it === 'Import anciennes photos' ? '📥' : it === 'Campagnes maîtres' ? '🎯' : it === 'Campagne — Visuels et formats' ? '🖼️' : it === 'Carte interactive' ? '🗺️' : it === 'Application terrain' ? '📱' : it === 'Recherche terrain' ? '🔎' : (icons[it] || '📋')} {it}</button>)}
      <button className="sidebar-logout" onClick={logoutFromPortal}><LogOut size={17}/> Déconnexion</button>
    </aside>
    <main>{dataStore?.__sync_error__&&<div className="sync-error-banner"><strong>Données momentanément indisponibles</strong><span>La dernière mise à jour n’a pas pu être chargée.</span><button onClick={refreshDataStore}>Réessayer</button></div>}<Suspense fallback={<ScreenFallback/>}>{content}</Suspense></main>
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
