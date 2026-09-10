import React,{useState}from'react';
import{AlertTriangle,BarChart3,RefreshCw}from'lucide-react';
import BrandLogo from'./BrandLogo';
import RecentActivityWidget from'./RecentActivityWidget';
import{displayKpiValue}from'../lib/module14Kpi.js';
import useDashboardSummary from'../hooks/useDashboardSummary';

export const DASHBOARD_CARDS={
 general:[['infrastructures_active','Infrastructures actives','Infrastructures'],['marketing_active','Campagnes marketing actives','Campagnes maîtres'],['operational_active','Communications opérationnelles actives','Communications opérationnelles'],['edt_active','EDT actifs','Suivi des EDT'],['issues_open','Enjeux ouverts','Enjeux des cadres et supports'],['photos','Photos ajoutées','Photos et inventaire'],['reports','Rapports','Rapports EDT'],['terrain','Synchronisations Terrain','Diagnostic terrain']],
 marketing:[['marketing_active','Campagnes actives','Campagnes maîtres'],['marketing_places','Supports affectés','Campagnes maîtres'],['marketing_visuals','Visuels','Campagne — Visuels et formats'],['marketing_soon','Fin prochaine','Campagnes maîtres']],
 operational:[['operational_active','Communications actives','Communications opérationnelles'],['operational_places','Emplacements utilisés','Communications opérationnelles'],['operational_visuals','Visuels actifs','Communication opérationnelle — Visuels'],['operational_soon','Expiration prochaine','Communications opérationnelles']],
 terrain:[['work_orders','Bons de travail','Bons de travail'],['photos','Photos','Photos et inventaire'],['terrain_errors','Erreurs Terrain actives','Diagnostic terrain']],
 edt:[['edt_active','EDT actifs','Suivi des EDT'],['edt_late','EDT en retard','Suivi des EDT']],
 infrastructure:[['infrastructures_total','Infrastructures','Infrastructures'],['missing_photos','Nécessitant attention','Infrastructures'],['infrastructures_total','Carte','Carte interactive']],
 clients:[['clients','Clients','Clients']],
 reports:[['reports_completed','EDT complétés','Rapports EDT'],['reports_sent','Rapports envoyés','Rapports EDT'],['reports_to_send','Rapports à envoyer','Rapports EDT'],['reports_errors','Erreurs','Rapports EDT']],
 alerts:[['edt_late','EDT en retard','Suivi des EDT'],['marketing_soon','Campagne marketing terminant bientôt','Campagnes maîtres'],['operational_soon','Communication expirant bientôt','Communications opérationnelles'],['urgent_work_orders','Enjeu Terrain urgent','Bons de travail'],['missing_photos','Photo manquante','Infrastructures']]
};
const tabs=[['general','Vue générale'],['marketing','Marketing'],['operational','Communication opérationnelle'],['terrain','Terrain'],['edt','EDT'],['infrastructure','Infrastructures'],['clients','Clients'],['reports','Rapports'],['alerts','Alertes'],['trends','Tendances']];
function Kpi({label,value,target,onNavigate,id}){return <button className="executive-kpi" data-kpi={id} onClick={()=>target&&onNavigate(target)} disabled={!target}><span><BarChart3/>{label}</span><strong>{displayKpiValue(value)}</strong><small>{target?'Ouvrir le module':'Source non disponible'}</small></button>}
function DashboardHeader({status,onRefresh,refreshing}){return <header className="executive-hero"><div className="hero-brand"><BrandLogo priority/><div><h1>Tableau de bord</h1></div></div><div className="executive-status"><span className="status-dot"/> {status}{onRefresh&&<button type="button" onClick={onRefresh} disabled={refreshing} aria-busy={refreshing} aria-label="Actualiser le tableau de bord"><RefreshCw/>{refreshing?'Actualisation…':'Actualiser'}</button>}</div></header>}
function Failure({message,retry}){return message?<div className="sync-error-banner" role="alert"><span>{message}</span><button type="button" onClick={retry}>Réessayer</button></div>:null}
function Bars({marketing,operational}){const max=Math.max(marketing,operational,1);return <article className="executive-panel"><header><div><span className="eyebrow">Répartition</span><h2>Marketing vs communication opérationnelle</h2></div><BarChart3/></header><div className="m14-bars">{[['Marketing',marketing],['Communication opérationnelle',operational]].map(([label,count])=><div key={label}><span>{label}</span><div><i style={{width:`${count/max*100}%`}}/></div><b>{count}</b></div>)}</div></article>}
function InternalDashboard({onNavigate,role,permission,scopeKey}){
 const summary=useDashboardSummary(scopeKey||role),[tab,setTab]=useState('general');
 const kpis=summary.value?.kpis,available=key=>kpis&&Object.hasOwn(kpis,key);
 const value=key=>available(key)?kpis[key]:{status:summary.error?'error':'loading'};
 const cards=(DASHBOARD_CARDS[tab]||[]).filter(([key])=>!kpis||available(key));
 const bars=available('marketing_total')&&available('operational_total')?<Bars marketing={kpis.marketing_total} operational={kpis.operational_total}/>:null;
 return <div className="dashboard executive-dashboard module14" data-dashboard-state={summary.error?'error':summary.loading?'loading':'ready'}>
 <DashboardHeader status={summary.error?'Actualisation indisponible':summary.loading?'Chargement des indicateurs…':'Données synchronisées'} onRefresh={summary.refresh} refreshing={summary.refreshing}/>
 <nav className="command-tabs" aria-label="Vues du centre de pilotage">{tabs.filter(([id])=>!kpis||id==='general'||id==='trends'||DASHBOARD_CARDS[id]?.some(([key])=>available(key))).map(([id,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}</nav>
 <Failure message={summary.error} retry={summary.refresh}/>
 {tab==='alerts'?<section className="command-alerts">{cards.map(([key,label,target])=><button key={key} onClick={()=>onNavigate(target)}><AlertTriangle/><span>{label}</span><strong>{displayKpiValue(value(key))}</strong></button>)}</section>:tab==='trends'?<>{bars}<div className="command-empty">Les autres tendances seront affichées lorsqu’une série temporelle réelle sera disponible.</div></>:<section className="executive-kpis">{cards.map(([key,label,target])=><Kpi key={key+label} id={key} label={label} value={value(key)} target={target} onNavigate={onNavigate}/>)}</section>}
 {['general','marketing','operational'].includes(tab)&&summary.value&&<section className="executive-layout">{bars}<RecentActivityWidget onNavigate={onNavigate} role={role} permission={summary.value.permission||permission}/></section>}
 </div>;
}
// Client previews remain projections supplied by the existing scoped preview RPC.
export default function Module14Dashboard(props){
 if(props.clientProjection){
  const{identity,views=[],sections={},loading=false,error='',refresh,refreshing=false}=props.clientProjection;
  return <div className="dashboard executive-dashboard module14 client-dashboard" data-reference-component="Module14Dashboard" data-dashboard-state={error?'error':loading?'loading':'ready'}><DashboardHeader status={loading?'Chargement des indicateurs…':`Données sécurisées · ${identity?.client_name||'Mon organisation'}`} onRefresh={refresh} refreshing={refreshing}/><Failure message={error} retry={refresh}/><section className="executive-kpis">{views.filter(view=>!['requests','members'].includes(view.id)).map(view=><Kpi key={view.id} id={view.section} label={view.label} value={sections[view.section]?.error?{status:'error'}:Number.isSafeInteger(sections[view.section]?.total)?sections[view.section].total:{status:loading?'loading':'error'}} target={view.id} onNavigate={props.onNavigate}/>)}</section>{!views.length&&!loading&&!error&&<div className="client-empty">Aucune vue n’est actuellement autorisée pour votre profil.</div>}</div>;
 }
 if(['Client','Client-Admin'].includes(props.role))return <div role="alert">Données autorisées indisponibles.</div>;
 return <InternalDashboard {...props}/>;
}
