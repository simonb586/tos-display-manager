import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, ClipboardList, History, Image, ListChecks } from 'lucide-react';
import SupportPhotoGallery from './SupportPhotoGallery';
import { loadSupport360 } from '../services/support360Service';
import SortableHeader from './SortableHeader';
import useSortableRows from '../hooks/useSortableRows';

function DataTable({rows,empty='Aucune donnée.'}) {
  const {sortedRows,sortState,setSortState}=useSortableRows(rows||[]);
  if(!rows?.length)return <p className="support360-empty">{empty}</p>;
  const cols=[...new Set(rows.flatMap(Object.keys))].filter(c=>!['id'].includes(c)).slice(0,10);
  return <div className="tableWrap support360-table"><table><thead><tr>{cols.map(c=><SortableHeader key={c} label={c} column={c} rows={rows} sortState={sortState} onSort={setSortState} onReset={()=>setSortState(null)}/>)}</tr></thead><tbody>{sortedRows.map((r,i)=><tr key={r.id||i}>{cols.map(c=><td key={c}>{r[c]==null?'—':String(r[c])}</td>)}</tr>)}</tbody></table></div>;
}

export default function Support360Panel({supportId,role}) {
  const [tab,setTab]=useState('photos');
  const [data,setData]=useState({history:[],issues:[],inspections:[],workOrders:[],edtLinks:[],logs:[]});
  const [message,setMessage]=useState('');
  useEffect(()=>{let active=true;loadSupport360(supportId).then(x=>active&&setData(x)).catch(e=>active&&setMessage(e.message||'Chargement incomplet.'));return()=>{active=false};},[supportId]);
  const canDelete=role==='Administrateur';
  const canManage=['Administrateur','Coordonnateur'].includes(role);
  const tabs=[
    ['photos',Image,'Photos'],
    ['history',History,'Historique des campagnes'],
    ['edt',ListChecks,'EDT'],
    ['issues',AlertTriangle,'Enjeux et inspections'],
    ['orders',ClipboardList,'Bons de travail'],
    ['activity',Activity,'Activité'],
  ];
  return <section className="support360-module">
    <div className="support360-tabs">{tabs.map(([id,Icon,label])=><button type="button" key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}><Icon size={16}/>{label}</button>)}</div>
    {message&&<div className="v07-message">{message}</div>}
    {tab==='photos'&&<SupportPhotoGallery supportId={supportId} canDelete={canDelete} canManage={canManage}/>}
    {tab==='history'&&<DataTable rows={data.history} empty="Aucun historique de campagne pour ce support."/>}
    {tab==='edt'&&<DataTable rows={data.edtLinks} empty="Aucun EDT associé à ce support."/>}
    {tab==='issues'&&<><h3>Enjeux</h3><DataTable rows={data.issues} empty="Aucun enjeu."/><h3>Inspections</h3><DataTable rows={data.inspections} empty="Aucune inspection."/></>}
    {tab==='orders'&&<DataTable rows={data.workOrders} empty="Aucun bon de travail."/>}
    {tab==='activity'&&<DataTable rows={data.logs} empty="Aucune activité photo consignée."/>}
  </section>;
}
