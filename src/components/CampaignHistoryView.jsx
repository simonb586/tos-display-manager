import React,{useEffect,useMemo,useState} from 'react';
import {loadCampaignHistory} from '../services/campaignHistoryService';
import {summarizeCampaignHistory} from '../lib/campaignHistory';
import {downloadCSV,downloadExcel,downloadPDF} from '../lib/utils';
import {sortRows} from '../lib/gridSorting';
import UnifiedDataGrid from './UnifiedDataGrid';
import GridPagination from './GridPagination';
import PhotoImage from './PhotoImage';
import {clientPortalColumnsForView} from '../lib/clientPortalViewRegistry';
import {matchesGridFilters} from './DataGridColumnFilter';

const summaryColumns=[['date_installation','Date installation'],['date_retrait','Date retrait'],['campagne','Campagne'],['visuel','Visuel'],['no_edt','No EDT'],['nombre_supports','Nombre de supports'],['contexte','Contexte']];
const detailColumns=[['campagne','Campagne'],['visuel','Visuel'],['no_edt','No EDT'],['support_id','Support'],['site','Site'],['format_support','Format'],['date_installation','Date installation'],['date_retrait','Date retrait'],['statut','Statut'],['photo_installation','Photo']];
export default function CampaignHistoryView({context=null,previewTargetId=null,onNavigate,initialQuery='',permission,role}){
 const [source,setSource]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[query,setQuery]=useState(initialQuery),[page,setPage]=useState(1),[size,setSize]=useState(25),[sort,setSort]=useState(null);
 useEffect(()=>{let live=true;setLoading(true);setSource([]);loadCampaignHistory(previewTargetId).then(rows=>{if(live)setSource(rows);}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[previewTargetId]);
 const [filters,setFilters]=useState({});
 const allowed=clientPortalColumnsForView({id:context?(context==='marketing'?'campaigns':'communications'):'history'},(context?detailColumns:summaryColumns).map(([id])=>id),permission?.visible_columns);
 const columns=(context?detailColumns:summaryColumns).filter(([id])=>!['Client','Client-Admin'].includes(role)||allowed.includes(id)).map(([id,label])=>({id,label,sortable:id!=='photo_installation',filterable:id!=='photo_installation',type:id==='nombre_supports'?'number':'text'}));
 const rows=useMemo(()=>{
  const projected=context?source.filter(row=>row.business_context===context).map(row=>({...row,statut:row.movement_meta?.installation?.cancelled_at?'Annulé':row.date_retrait?'Historique':'En exposition'})):summarizeCampaignHistory(source);
  const q=query.toLocaleLowerCase('fr-CA');
  return sortRows(projected.filter(row=>columns.some(c=>String(row[c.id]??'').toLocaleLowerCase('fr-CA').includes(q))).filter(row=>matchesGridFilters(row,filters)),sort);
 },[source,context,query,sort,filters,permission,role]);
 const exportColumns=columns.filter(c=>c.id!=='photo_installation').map(c=>({key:c.id,label:c.label}));
 const unresolved=source.filter(row=>!row.business_context).length;
 const runExport=async fn=>{try{await fn();}catch(e){setError(e.message);}};
 return <section className="tablePage campaign-history-view"><h2>{context?'Déploiements par site et support':'Historique des campagnes — synthèse'}</h2>
  {error&&<p role="alert">{error}</p>}{loading&&<p role="status">Chargement…</p>}
  {unresolved>0&&<p>{unresolved} déploiement(s) avec contexte à valider dans l’historique.</p>}
  <div className="data-grid-toolbar"><label>Rechercher<input value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} placeholder="Campagne, visuel, EDT, site ou support"/></label>
   <button onClick={()=>runExport(()=>downloadCSV('historique-campagnes.csv',rows,exportColumns))}>CSV</button><button onClick={()=>runExport(()=>downloadExcel('historique-campagnes.xlsx',rows,exportColumns))}>Excel</button><button onClick={()=>runExport(()=>downloadPDF('historique-campagnes.pdf','Historique des campagnes',rows,exportColumns))}>PDF</button></div>
  <UnifiedDataGrid gridId={context?'deployments-'+context:'campaign-history-summary'} columns={columns} rows={rows.slice((page-1)*size,page*size)} filterRows={rows} filters={filters} onFilter={(key,value)=>{setFilters(current=>({...current,[key]:value}));setPage(1);}} rowKey={row=>row.id} sortState={sort} onSort={setSort} onResetSort={()=>setSort(null)} renderCell={(column,row)=>column.id==='photo_installation'?row.photo_installation?<PhotoImage className="infrastructure-thumbnail" photo={row.photo_installation} alt="Photo installation"/>:'':String(row[column.id]??'')} actions={!context&&onNavigate?row=>row.business_context&&<button onClick={()=>onNavigate(row.business_context,row.no_edt||row.campagne)}>Voir les déploiements</button>:undefined}/>
  <GridPagination currentPage={page} totalRows={rows.length} pageSize={size} onPageChange={setPage} onPageSizeChange={value=>{setSize(value);setPage(1);}}/>
 </section>;
}
