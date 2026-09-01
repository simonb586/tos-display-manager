import React,{useEffect,useState}from'react';
import{Search,X}from'lucide-react';
import GridPagination from'./GridPagination';
import{listActivityEvents}from'../services/activityLogService';
import{formatActivityDate}from'../lib/recentActivity';

export default function ActivityJournal({role,supportId=''}){
  const[rows,setRows]=useState([]),[total,setTotal]=useState(0),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(50),[query,setQuery]=useState(''),[filters,setFilters]=useState(()=>supportId?{support_id:String(supportId)}:{}),[selected,setSelected]=useState(null),[message,setMessage]=useState('');
  useEffect(()=>{setPage(1);setFilters(current=>supportId?{...current,support_id:String(supportId)}:current)},[supportId]);
  const allowed=['Administrateur','Coordonnateur'].includes(role);
  async function reload(){try{const result=await listActivityEvents({page,pageSize,query,filters});setRows(result.rows);setTotal(result.total);setMessage('')}catch(error){setMessage(error.message)}}
  useEffect(()=>{if(allowed)reload()},[allowed,page,pageSize,query,JSON.stringify(filters)]);
  if(!allowed)return<div className="v07-card">Accès réservé.</div>;
  const field=(name,label,type='text')=><label>{label}<input type={type} value={filters[name]||''} onChange={event=>{setPage(1);setFilters({...filters,[name]:event.target.value})}}/></label>;
  return <div className="operations-page activity-journal">
    <header className="operations-hero"><div><h1>Journal des événements</h1><p>Activité centralisée, traçable et conservée.</p></div></header>
    {message&&<div className="v07-message">{message}</div>}
    <div className="searchbar"><Search/><input aria-label="Recherche globale" value={query} onChange={event=>{setPage(1);setQuery(event.target.value)}}/></div>
    <section className="activity-filters">{field('date_from','Du','date')}{field('date_to','Au','date')}{field('actor_email','Utilisateur')}{field('actor_role','Rôle')}{field('module','Module')}{field('action','Action')}{field('campaign_id','Campagne')}{field('edt_id','EDT')}{field('support_id','Support')}{field('client_id','Client')}{field('status','Statut')}</section>
    <div className="tableWrap"><table><thead><tr><th>Date</th><th>Utilisateur</th><th>Rôle</th><th>Action</th><th>Module</th><th>Objet</th><th>Campagne</th><th>EDT</th><th>Support</th><th>Client</th><th>Statut</th><th>Source</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} onClick={()=>setSelected(row)}><td>{formatActivityDate(row.occurred_at)}</td><td>{row.actor_email||'—'}</td><td>{row.actor_role||'—'}</td><td>{row.action}</td><td>{row.module}</td><td>{row.entity_type||'—'} {row.entity_id||''}</td><td>{row.campaign_id||'—'}</td><td>{row.edt_id||'—'}</td><td>{row.support_id||'—'}</td><td>{row.client_id||'—'}</td><td>{row.status||'—'}</td><td>{row.source_system}</td></tr>)}</tbody></table></div>
    <GridPagination page={page} pageCount={Math.max(1,Math.ceil(total/pageSize))} pageSize={pageSize} total={total} onPage={setPage} onPageSize={value=>{setPage(1);setPageSize(value)}}/>
    {selected&&<div className="modal"><div className="modalCard"><button onClick={()=>setSelected(null)}><X/> Fermer</button><h2>Détail de l’événement</h2><dl>{Object.entries(selected).map(([key,value])=><div key={key}><dt>{key}</dt><dd><code>{typeof value==='object'?JSON.stringify(value):String(value??'—')}</code></dd></div>)}</dl></div></div>}
  </div>;
}
