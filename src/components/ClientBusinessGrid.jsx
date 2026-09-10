import {downloadEdtReport} from '../services/reportDataService';
import PhotoImage from './PhotoImage';
import {businessColumns,businessColumnLabel} from '../lib/businessColumns';
import useRefreshRequest from '../hooks/useRefreshRequest';
import React,{useEffect,useMemo,useRef,useState}from'react';
import{Download,FileSpreadsheet,FileText,MapPin,RotateCcw,Search}from'lucide-react';
import UnifiedDataGrid from'./UnifiedDataGrid';
import GridPagination from'./GridPagination';
import DataGridSettings,{useDataGridSettings}from'./DataGridSettings';
import{matchesGridFilters}from'./DataGridColumnFilter';
import{downloadCSV,downloadExcel,downloadExcelSelectionWithPhotos,downloadPDF,professionalExportName,strictMatches}from'../lib/utils';
import{clientPortalColumnsForView}from'../lib/clientPortalViewRegistry';
import{sortRows}from'../lib/gridSorting';

const INTERNAL_COLUMNS=new Set(['id','client_id','organization_id','campaign_id','campagne_id','visuel_id','report_path','photo_url','thumbnail_url','chemin_appartenance']);
const value=v=>v==null||v===''?'—':String(v);

export default function ClientBusinessGrid({view,result,onLoad,onLoadAll,onOpenMap,readOnly=true,initialQuery='',refreshing=false,scopeKey='',columnPermissions={}}){
 const rows=result?.rows||[],allColumns=useMemo(()=>clientPortalColumnsForView(view,businessColumns(rows,view.id==='infrastructures'?'Infrastructures':view.label).filter(key=>!INTERNAL_COLUMNS.has(key)),columnPermissions),[rows,view,columnPermissions]);
 const labelFor=key=>businessColumnLabel(view.id==='infrastructures'?'Infrastructures':view.label,key);
 const settings=useDataGridSettings(`client-${scopeKey}-${view.id}`,allColumns),columns=settings.columns;
 const refreshRequest=useRefreshRequest(scopeKey);
 const exportLock=useRef(false),lastQuery=useRef(initialQuery);
 const[error,setError]=useState('');
 const[downloading,setDownloading]=useState(null);const downloadLock=useRef(false);
 async function downloadReport(row){if(downloadLock.current)return;downloadLock.current=true;setDownloading(row.id);setError('');try{await downloadEdtReport(row)}catch{setError('Rapport privé inaccessible. Actualisez la liste et réessayez.')}finally{downloadLock.current=false;setDownloading(null)}}
 const[query,setQuery]=useState(initialQuery),[filters,setFilters]=useState({}),[sortState,setSortState]=useState(null),[exporting,setExporting]=useState(''),[selected,setSelected]=useState(()=>new Set());
 useEffect(()=>setQuery(initialQuery),[initialQuery]);
 const localRows=useMemo(()=>sortRows(rows.filter(row=>strictMatches(row,query,columns)).filter(row=>matchesGridFilters(row,filters)),sortState),[rows,query,columns,filters,sortState]);
 const activeFilterCount=Object.values(filters).filter(item=>item?.length).length;
 useEffect(()=>{if(query===lastQuery.current)return;const timer=setTimeout(()=>{lastQuery.current=query;onLoad?.(1,result?.page_size||25,{search:query})},250);return()=>clearTimeout(timer)},[query,onLoad,result?.page_size]);
 useEffect(()=>setSelected(new Set()),[rows]);
 const rowKey=(row,index)=>row.id??row.support_id??index;
 const selectedRows=localRows.filter((row,index)=>selected.has(rowKey(row,index)));
 const selection={selected,toggle:key=>setSelected(current=>{const next=new Set(current);next.has(key)?next.delete(key):next.add(key);return next}),togglePage:(pageRows,checked)=>setSelected(current=>{const next=new Set(current);pageRows.forEach((row,index)=>{const key=rowKey(row,index);checked?next.add(key):next.delete(key)});return next})};
 async function exportRows(kind,scope='filtered'){if(exportLock.current)return;exportLock.current=true;setExporting(kind);setError('');try{const permitted=scope==='selected'?selectedRows:await onLoadAll({search:query});const filtered=scope==='selected'?permitted:sortRows(permitted.filter(row=>matchesGridFilters(row,filters)),sortState),labels=Object.fromEntries(columns.map(key=>[key,labelFor(key)])),options={moduleName:view.label,labels,filters:{recherche:query},sortState,exportType:scope==='selected'?'Sélection autorisée':'Ensemble filtré autorisé'};if(kind==='csv')downloadCSV(professionalExportName(view.label,'csv'),filtered,columns.map(key=>({key,label:labels[key]})));if(kind==='xlsx'&&scope==='selected')await downloadExcelSelectionWithPhotos(professionalExportName(view.label,'xlsx'),filtered,columns,options);else if(kind==='xlsx')await downloadExcel(professionalExportName(view.label,'xlsx'),filtered,columns,options);if(kind==='pdf')await downloadPDF(professionalExportName(view.label,'pdf'),`${view.label} — résultats filtrés`,filtered,columns,options)}catch(e){console.error('Client export failed',e);setError('Export impossible. Réessayez.')}finally{exportLock.current=false;setExporting('')}}
 return <div className="client-business-grid" data-reference-component="UnifiedDataGrid">
  <div className="data-grid-toolbar"><div className="searchbar"><Search/><input aria-label={`Recherche globale — ${view.label}`} placeholder="Rechercher dans les données autorisées…" value={query} onChange={event=>setQuery(event.target.value)}/></div>{activeFilterCount>0&&<button type="button" onClick={()=>setFilters({})}><RotateCcw/> Réinitialiser ({activeFilterCount})</button>}</div>
  {error&&<div role="alert">{error}</div>}
  <div className="actions client-grid-actions"><button type="button" disabled={refreshing} onClick={refreshRequest.onClick(()=>onLoad(result?.page||1,result?.page_size||25,{search:query}))}><RotateCcw/>{refreshing?'Actualisation…':'Actualiser'}</button><DataGridSettings gridId={`client-${scopeKey}-${view.id}`} columns={allColumns} labels={Object.fromEntries(allColumns.map(key=>[key,labelFor(key)]))} preferences={settings.preferences} setPreferences={settings.setPreferences} onReset={settings.reset}/>{view.id==='infrastructures'&&<button onClick={onOpenMap}><MapPin/> Carte</button>}<button disabled={Boolean(exporting)} onClick={()=>exportRows('csv')}><Download/> CSV résultats</button><button disabled={Boolean(exporting)} onClick={()=>exportRows('xlsx')}><FileSpreadsheet/> Excel résultats</button><button disabled={Boolean(exporting)||!selectedRows.length} onClick={()=>exportRows('xlsx','selected')}><FileSpreadsheet/> Excel sélection ({selectedRows.length})</button><button disabled={Boolean(exporting)} onClick={()=>exportRows('pdf')}><FileText/> PDF</button></div>
  <UnifiedDataGrid gridId={`client-${scopeKey}-${view.id}`} columns={columns.map(id=>({id,label:labelFor(id)}))} rows={localRows} filterRows={rows} filters={filters} onFilter={(column,next)=>setFilters(current=>({...current,[column]:next}))} sortState={sortState} onSort={setSortState} onResetSort={()=>setSortState(null)} rowKey={rowKey} selection={selection} actions={view.id==='reports'?row=><button type="button" disabled={downloading!==null||!row.report_path} onClick={()=>downloadReport(row)}><Download/>{downloading===row.id?'Téléchargement…':'Télécharger le rapport'}</button>:undefined} renderCell={(column,row)=>column.id==='signed_thumbnail_url'?<PhotoImage className="infrastructure-thumbnail" loading="lazy" photo={row} alt={`Photo du support ${row.support_id||''}`}/>:value(row[column.id])} emptyMessage="Aucune donnée disponible pour les filtres actifs."/>
  <GridPagination currentPage={result?.page||1} totalRows={result?.total||0} pageSize={result?.page_size||25} onPageChange={page=>onLoad(page,result?.page_size||25,{search:query})} onPageSizeChange={size=>onLoad(1,size,{search:query})}/>
  {readOnly&&<small className="client-readonly-note">Consultation limitée par votre rôle et votre organisation.</small>}
 </div>;
}
