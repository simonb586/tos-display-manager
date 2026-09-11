import React, {useEffect,useMemo,useRef,useState} from 'react';
import {Search,Download,FileSpreadsheet,FileText,MapPin,Edit3,Save,X} from 'lucide-react';
import PhotoImage from './PhotoImage';
import Support360Panel from './Support360Panel';
import EditableField from './EditableField';
import GridColumnHeader from './GridColumnHeader';
import DataGridFilterRow from './DataGridFilterRow';
import {matchesGridFilters} from './DataGridColumnFilter';
import DataGridSettings,{useDataGridSettings} from './DataGridSettings';
import GridPagination from './GridPagination';
import {businessColumns as getCols,businessColumnLabel as columnLabel} from '../lib/businessColumns';
import {tableConfig} from '../lib/businessTableConfig';
import {canEditBusinessView} from '../lib/businessCapabilities';
import {columnsForTable} from '../services/roleVisibilityService';
import {strictMatches,downloadCSV,downloadExcel,downloadExcelSelectionWithPhotos,downloadPDF,professionalExportName} from '../lib/utils';
import {sortRows,defaultSortForColumn} from '../lib/gridSorting';
import {defaultSortColumnForTable} from '../lib/gridPresentation';
import {friendlyError} from '../config/businessLanguage';
import {infrastructureMapUrl} from '../services/mapService';
import {updateUniversalRow,updateUniversalRows,loadAutomaticFieldRules,primaryKeyFor} from '../services/universalEditorService';
const protectedClientColumn = (role,column) => role==='Client-Admin' && ['id','client_id','support_id','campagne_id','edt_id','business_context','client_published','publiee_terrain'].includes(column);
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

export default function TableView({ name, dataStore, onOpenMap, rolePermission, role, onRowsUpdated, initialSupportId='', initialGridContext=null, scopedData=null, scopeKey='', previewMode=false, previewTargetId=null }) {
  const rows = dataStore?.[name]?.rows || [];
  const config = tableConfig[name];
  const allCols = getCols(rows, name);
  const permittedCols = columnsForTable(rolePermission, name, allCols);
  const gridSettings = useDataGridSettings(`table-${scopeKey ? scopeKey+'-' : ''}${name}`, permittedCols);
  const cols = gridSettings.columns;
  const restoredContext = name === 'Infrastructures' && initialGridContext?.sourceView === 'infrastructures' ? initialGridContext : null;
  const [query, setQuery] = useState(restoredContext?.search || '');
  const [filters, setFilters] = useState(restoredContext?.filters || {});
  const [sortState, setSortState] = useState(() => {
    if (restoredContext?.sort) return restoredContext.sort;
    try {
      const stored=JSON.parse(sessionStorage.getItem(`tdm-grid-sort:${scopeKey}:${name}`));
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
  const gridSaveActive = useRef(false);
  const gridExportActive = useRef(false);
  const [exporting, setExporting] = useState(false);
  async function runGridExport(action) {
    if (gridExportActive.current) return;
    gridExportActive.current = true;
    setExporting(true);
    setMessage('');
    try { await action(); }
    catch (error) { setMessage(friendlyError(error, 'Export impossible. Réessayez.')); }
    finally { gridExportActive.current = false; setExporting(false); }
  }
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(restoredContext?.page || 1);
  const [pageSize, setPageSize] = useState(restoredContext?.pageSize || 50);
  const [selectedRows, setSelectedRows] = useState(()=>new Set());

  useEffect(() => {
    if (!restoredContext?.visibleColumns) return;
    gridSettings.setPreferences(restoredContext.visibleColumns);
  }, []);

  useEffect(() => {
    if (!restoredContext || typeof restoredContext.scrollY !== 'number') return;
    const timer = window.setTimeout(() => window.scrollTo({ top: restoredContext.scrollY, behavior: 'auto' }), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(()=>{
    if(name!=='Infrastructures'||!initialSupportId)return;
    setSelected(rows.find(row=>String(row.support_id||row['Support ID']||'')===String(initialSupportId))||null);
  },[name,initialSupportId,rows]);

  const filtered = useMemo(() => rows
    .filter(r => strictMatches(r, query, cols))
    .filter(r => matchesGridFilters(r, filters)), [rows, query, filters, cols]);
  const sorted = useMemo(() => sortRows(filtered, sortState), [filtered, sortState]);
  const sortedComplete = useMemo(() => sortRows(rows, sortState), [rows, sortState]);
  const pageCount = Math.max(1,Math.ceil(sorted.length/pageSize));
  const currentPage = Math.min(page,pageCount);
  const shown = sorted.slice((currentPage-1)*pageSize,currentPage*pageSize);
  const selectedFiltered = sorted.filter((row,index)=>selectedRows.has(rowToken(row,index)));
  const hasMapColumn = name === 'Infrastructures';
  const canEdit = canEditBusinessView(role, rolePermission, name) && !config.readOnly;
  const exportLabels = Object.fromEntries(cols.map(column=>[column,columnLabel(name,column)]));
  const exportOptions = {moduleName:name,labels:exportLabels,filters:{recherche:query,...Object.fromEntries(Object.entries(filters).map(([key,value])=>[key,value.join(' | ')]))},sortState};
  const activeFilterCount = Object.values(filters).filter(value => value?.length).length;

  useEffect(() => {
    const key = `tdm-grid-sort:${scopeKey}:${name}`;
    if (sortState) sessionStorage.setItem(key, JSON.stringify(sortState));
    else sessionStorage.removeItem(key);
  }, [name, sortState]);

  useEffect(()=>setPage(1),[query,filters,sortState,pageSize,name]);
  useEffect(()=>{
    if (restoredContext?.page) setPage(restoredContext.page);
  },[]);

  function infrastructureNavigationContext(supportId) {
    return {
      sourceView: 'infrastructures',
      page: currentPage,
      pageSize,
      filters,
      search: query,
      sort: sortState,
      visibleColumns: gridSettings.preferences,
      scrollY: window.scrollY,
      supportId: String(supportId || ''),
      mapRows: sorted
    };
  }

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
    if (!canEdit || previewMode || gridSaveActive.current) return;
    const entries = Object.values(drafts);
    if (!entries.length) {
      setGridEditing(false);
      return;
    }

    if (!window.confirm(`Enregistrer ${entries.length} ligne(s) modifiée(s) dans ${name}?`)) return;
    gridSaveActive.current = true;
    setSaving(true);
    setMessage('');

    try {
      const updated = await updateUniversalRows({ config, entries });
      onRowsUpdated?.(name, updated);
      setDrafts({});
      setGridEditing(false);
      setMessage(`${updated.length} ligne(s) enregistrée(s).`);
    } catch (error) {
      setMessage(friendlyError(error, 'Impossible d’enregistrer ces modifications.'));
    } finally {
      gridSaveActive.current = false;
      setSaving(false);
    }
  }

  return <div className="tablePage" data-business-role={role} data-can-edit={canEdit}>
    <header className="pageHead"><div><h1>📋 {name}</h1><p>{filtered.length.toLocaleString('fr-CA')} résultat(s) sur {rows.length.toLocaleString('fr-CA')} ligne(s).</p></div><div className="actions">
      {hasMapColumn && <button type="button" onClick={() => onOpenMap?.('', infrastructureNavigationContext(''))}><MapPin/> Carte</button>}
      <DataGridSettings gridId={`table-${name}`} columns={permittedCols} labels={Object.fromEntries(permittedCols.map(column=>[column,columnLabel(name,column)]))} preferences={gridSettings.preferences} setPreferences={gridSettings.setPreferences} onReset={gridSettings.reset}/>
      {canEdit && !gridEditing && <button data-business-write="update" onClick={() => { setGridEditing(true); setMessage(''); }}><Edit3/> Modifier la grille</button>}
      <button disabled={exporting} onClick={() => runGridExport(() => downloadCSV(professionalExportName(name,'csv'), sorted, cols.map(key=>({key,label:exportLabels[key]}))))}><Download/> CSV résultats ({sorted.length})</button>
      <button disabled={exporting || !selectedFiltered.length} onClick={() => runGridExport(() => downloadExcelSelectionWithPhotos(professionalExportName(name,'xlsx'), selectedFiltered, cols, {...exportOptions,exportType:'Sélection'}))}><FileSpreadsheet/> Excel sélection ({selectedFiltered.length})</button>
      <button disabled={exporting} onClick={() => runGridExport(() => downloadExcel(professionalExportName(name,'xlsx'), sorted, cols, {...exportOptions,exportType:'Résultats filtrés'}))}><FileSpreadsheet/> Excel résultats ({sorted.length})</button>
      <button disabled={exporting} onClick={() => runGridExport(() => downloadPDF(professionalExportName(name,'pdf'), `${name} — résultats filtrés`, sorted, cols, exportOptions))}><FileText/> PDF ensemble filtré</button>
    </div></header>

    {gridEditing && <div className="grid-edit-toolbar">
      <button className="grid-edit-primary" disabled={saving||previewMode} onClick={saveGrid}><Save size={17}/> {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}</button>
      <button className="grid-edit-secondary" disabled={saving} onClick={() => { if (gridSaveActive.current) return; setDrafts({}); setGridEditing(false); }}><X size={17}/> Annuler</button>
      <span className="grid-edit-note">{Object.keys(drafts).length} ligne(s) modifiée(s). Clique directement dans les cellules.</span>
    </div>}

    {message && <div className="v07-message">{message}</div>}

    <div className="data-grid-toolbar"><div className="searchbar"><Search/><input aria-label={`Recherche globale — ${name}`} placeholder="Recherche exacte dans toutes les colonnes..." value={query} onChange={e => setQuery(e.target.value)}/></div>{activeFilterCount>0&&<><span className="grid-active-filter-count">Filtres actifs : {activeFilterCount}</span><button type="button" onClick={()=>setFilters({})}>Effacer tous les filtres</button></>}</div>
    <div className="tableWrap professional-grid" data-grid-id={`table-${name}`}><table><thead><tr className="data-grid-header-row" data-grid-zone="headers"><th className="selection-column"><input type="checkbox" aria-label="Sélectionner la page" checked={shown.length>0&&shown.every((row,index)=>selectedRows.has(rowToken(row,(currentPage-1)*pageSize+index)))} onChange={event=>setSelectedRows(current=>{const next=new Set(current);shown.forEach((row,index)=>{const token=rowToken(row,(currentPage-1)*pageSize+index);event.target.checked?next.add(token):next.delete(token)});return next})}/></th>{hasMapColumn && <th className="action-column">Carte</th>}{cols.map(c => <GridColumnHeader key={c} column={c} label={columnLabel(name,c)} rows={filtered} sortState={sortState} onSort={setSortState} onReset={()=>setSortState(null)}/>)}</tr><DataGridFilterRow columns={cols.map(c=>({key:c,label:columnLabel(name,c)}))} rows={rows} filters={filters} onFilter={(column,value)=>setFilters(current=>({...current,[column]:value}))} leadingCells={hasMapColumn?2:1}/></thead><tbody>{shown.map((r, i) => {
      const token = rowToken(r, (currentPage-1)*pageSize+i);
      const supportId = r.support_id || r['Support ID'] || '';
      const mapUrl = infrastructureMapUrl(r);
      return <tr key={token} className={drafts[token] ? 'editing-row' : ''} onClick={() => !gridEditing && setSelected(r)}>
        <td className="selection-column" onClick={event=>event.stopPropagation()}><input type="checkbox" aria-label={`Sélectionner ${supportId||token}`} checked={selectedRows.has(token)} onChange={()=>setSelectedRows(current=>{const next=new Set(current);next.has(token)?next.delete(token):next.add(token);return next})}/></td>
        {hasMapColumn && <td>
          {mapUrl
            ? <button className="table-map-button" title={`Ouvrir ${supportId} sur la carte`} onClick={event => {
                event.stopPropagation();
                onOpenMap?.(supportId, infrastructureNavigationContext(supportId));
              }}><MapPin size={16}/> Carte</button>
            : <span className="table-map-missing">GPS absent</span>}
        </td>}
        {cols.map(c => {
          const changed = Object.prototype.hasOwnProperty.call(drafts[token]?.changes || {}, c);
          const value = changed ? drafts[token].changes[c] : r[c];
          return <td key={c} className={gridEditing ? `grid-edit-cell ${changed ? 'changed' : ''}` : ''}>
            {gridEditing
              ? <EditableField disabled={protectedClientColumn(role,c)} column={c} value={value} compact onChange={next => changeCell(r, i, c, next)}/>
              : renderTableCell(name, r, c)}
          </td>;
        })}
      </tr>;
    })}</tbody></table></div>
    <GridPagination page={currentPage} pageCount={pageCount} pageSize={pageSize} total={sorted.length} selectedCount={hasMapColumn?selectedRows.size:0} onPage={setPage} onPageSize={setPageSize}/>
    {selected && <Detail previewTargetId={previewTargetId} previewMode={previewMode} rolePermission={rolePermission} scopedData={scopedData} name={name} row={selected} role={role} config={config} onSaved={updated => { onRowsUpdated?.(name, [updated]); setSelected(updated); }} onClose={() => setSelected(null)} onOpenMap={onOpenMap}/>}
  </div>;
}

export function Detail({ name, row, role, config, onSaved, onClose, onOpenMap, rolePermission, scopedData, previewMode=false, previewTargetId=null }) {
  const cols = columnsForTable(rolePermission, name, getCols([row], name));
  const support = row.support_id || row.no_arret || row.related_support || row['Support ID'] || '';
  const mapUrl = name === 'Infrastructures' ? infrastructureMapUrl(row) : '';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row);
  const [rules, setRules] = useState({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const detailSaveActive = useRef(false);
  const canEdit = canEditBusinessView(role, rolePermission, name) && !config.readOnly;

  useEffect(() => {
    loadAutomaticFieldRules(config.table).then(setRules);
  }, [config.table]);

  async function save() {
    if (!canEdit || previewMode || detailSaveActive.current) return;
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
    detailSaveActive.current = true;
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
      detailSaveActive.current = false;
      setSaving(false);
    }
  }

  return <div className="drawer"><div className="drawerPanel"><button className="close" disabled={saving} onClick={() => { if (!detailSaveActive.current) onClose(); }}>×</button><h2>Fiche 360° — {name}</h2>{support && <div className="support">Identifiant : <b>{support}</b></div>}

    {canEdit && <div className="detail-edit-actions">
      {!editing
        ? <button className="grid-edit-primary" onClick={() => { setDraft(row); setEditing(true); setMessage(''); }}><Edit3 size={17}/> Modifier la fiche</button>
        : <>
            <button className="grid-edit-primary" disabled={saving||previewMode} onClick={save}><Save size={17}/> Enregistrer</button>
            <button className="grid-edit-secondary" disabled={saving} onClick={() => { if (detailSaveActive.current) return; setDraft(row); setEditing(false); }}><X size={17}/> Annuler</button>
          </>}
    </div>}

    {message && <div className="v07-message">{message}</div>}
    {mapUrl && <button className="detail-map-button" onClick={() => onOpenMap?.(support)}><MapPin size={17}/> Voir ce support sur la carte interactive</button>}

    <div className="detailGrid">{cols.map(c => {
      if (!editing && name === 'Infrastructures' && c === 'visuel_actuel_cadre') {
        const url = thumbnailForInfrastructure(row);
        return <div key={c} className="detail-photo-card"><label>{columnLabel(name, c)}</label>{url
          ? <PhotoImage photo={url} alt={`Photo du support ${support}`}/>
          : <p>Aucune photo associée.</p>}</div>;
      }

      const rule = rules[c];
      return <div key={c}>
        <label>{columnLabel(name, c)}</label>
        {editing
          ? <>
              <EditableField disabled={protectedClientColumn(role,c)} column={c} value={draft[c]} onChange={value => setDraft(current => ({ ...current, [c]: value }))}/>
              {rule && !rule.is_primary_source && <small className="automatic-field-warning">Champ alimenté automatiquement depuis {rule.source_table || 'une relation'}.{rule.source_field || ''}. Une propagation future pourrait remplacer la valeur.</small>}
            </>
          : <p>{String(row[c] ?? '—')}</p>}
      </div>;
    })}</div>
    {name === 'Infrastructures' && support && <Support360Panel supportId={support} role={role} scopedData={scopedData} previewTargetId={previewTargetId}/>}
  </div></div>;
}
