import {loadBusinessContext} from '../services/businessParityService';
import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, ClipboardList, History, Image, ListChecks } from 'lucide-react';
import SupportPhotoGallery from './SupportPhotoGallery';
import PhotoImage from './PhotoImage';
import {GenericCampaignVisual,VisualReferenceProvider} from './VisualReferences';
import {formatBusinessValue} from '../lib/businessTime';
import { loadSupport360 } from '../services/support360Service';
import SortableHeader from './SortableHeader';
import useSortableRows from '../hooks/useSortableRows';

function DataTable({rows,empty='Aucune donnée.'}) {
  const {sortedRows,sortState,setSortState}=useSortableRows(rows||[]);
  if(!rows?.length)return <p className="support360-empty">{empty}</p>;
  const cols=[...new Set(rows.flatMap(Object.keys))].filter(c=>!['id'].includes(c)).slice(0,10);
  return <div className="tableWrap support360-table"><table><thead><tr>{cols.map(c=><SortableHeader key={c} label={c} column={c} rows={rows} sortState={sortState} onSort={setSortState} onReset={()=>setSortState(null)}/>)}</tr></thead><tbody>{sortedRows.map((r,i)=><tr key={r.id||i}>{cols.map(c=><td key={c}>{r[c]==null?'—':String(formatBusinessValue(r[c],c))}</td>)}</tr>)}</tbody></table></div>;
}

export default function Support360Panel({supportId,support=null,role,scopedData=null,previewTargetId=null}) {
  const [tab,setTab]=useState('photos');
  const [data,setData]=useState({history:[],issues:[],inspections:[],workOrders:[],edtLinks:[],logs:[]});
  const [message,setMessage]=useState('');
  useEffect(()=>{let active=true;setMessage('');if(scopedData!==null){setData(scopedData);return;}const load=()=>(previewTargetId?loadBusinessContext('support',supportId,previewTargetId):loadSupport360(supportId)).then(x=>active&&setData(x)).catch(e=>active&&setMessage(e.message||'Chargement incomplet.'));load();window.addEventListener('tos-terrain-data-updated',load);return()=>{active=false;window.removeEventListener('tos-terrain-data-updated',load)};},[supportId,scopedData,previewTargetId]);
  const canDelete=!previewTargetId&&role==='Administrateur';
  const canManage=!previewTargetId&&['Administrateur','Coordonnateur'].includes(role);
  const tabs=[
    ['photos',Image,'Photos'],
    ['history',History,'Historique des campagnes'],
    ['edt',ListChecks,'EDT'],
    ['issues',AlertTriangle,'Enjeux et inspections'],
    ['orders',ClipboardList,'Bons de travail'],
    ['activity',Activity,'Activité'],
  ];
  return <section className="support360-module">
    {(support||data.support)&&<section aria-label="Référence du visuel installé"><h3>Visuel générique de référence</h3><VisualReferenceProvider scopeKey={`${role}:${supportId}`} previewTargetId={previewTargetId}><GenericCampaignVisual support={support||data.support} all/></VisualReferenceProvider></section>}
    <div className="support360-tabs">{tabs.map(([id,Icon,label])=><button type="button" key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}><Icon size={16}/>{label}</button>)}</div>
    {message&&<div className="v07-message">{message}</div>}
    {tab==='photos'&&<SupportPhotoGallery supportId={supportId} canDelete={canDelete} canManage={canManage} scopedPhotos={previewTargetId?(data.photos||[]):scopedData?.photos ?? null}/>}
    {tab==='history'&&<DataTable rows={data.history} empty="Aucun historique de campagne pour ce support."/>}
    {tab==='edt'&&<DataTable rows={data.edtLinks} empty="Aucun EDT associé à ce support."/>}
    {tab==='issues'&&<><h3>Enjeux</h3>{!data.issues?.length&&<p>Aucun enjeu.</p>}{data.issues?.map(issue=><article key={issue.id}><h4>{issue.type_enjeu}</h4><p>{issue.description||issue.commentaire}</p><p>{issue.resolved_at?"Résolu le "+new Date(issue.resolved_at).toLocaleString("fr-CA"):"Déclaré le "+new Date(issue.created_at).toLocaleString("fr-CA")}</p>{issue.photo_url&&<figure style={{margin:0}}><PhotoImage photo={issue.photo_url} style={{maxWidth:"100%",maxHeight:240,objectFit:"contain"}} alt="Photo de l’enjeu"/><figcaption>Photo de déclaration</figcaption></figure>}{(issue.resolution_photo||data.photos?.find(p=>p.id===issue.resolution_photo_id))&&<figure style={{margin:0}}><PhotoImage photo={issue.resolution_photo||data.photos?.find(p=>p.id===issue.resolution_photo_id)} style={{maxWidth:"100%",maxHeight:240,objectFit:"contain"}} alt="Photo de résolution"/><figcaption>Photo de résolution</figcaption></figure>}</article>)}<h3>Inspections</h3><DataTable rows={data.inspections} empty="Aucune inspection."/></>}
    {tab==='orders'&&<DataTable rows={data.workOrders} empty="Aucun bon de travail."/>}
    {tab==='activity'&&<DataTable rows={data.logs} empty="Aucune activité photo consignée."/>}
  </section>;
}
