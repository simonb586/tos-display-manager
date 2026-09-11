import OperationsCenter from './OperationsCenter';
import BusinessTable from './BusinessTable';
import CampaignsPanel from './CampaignsPanel';
import {CLIENT_BUSINESS_ROUTES} from '../lib/clientBusinessRoutes';
import {loadBusinessRows,loadPreviewSummary} from '../services/businessParityService';
import useDashboardSummary from '../hooks/useDashboardSummary';
import {clearSignedPhotoUrlCache} from '../services/photoAccessService';
import {businessCapabilities} from '../lib/businessCapabilities';
import Module14Dashboard from './Module14Dashboard';
import React,{useCallback,useEffect,useMemo,useRef,useState}from'react';
import{ArrowLeft,BarChart3,Download,LogOut,MapPin,Menu,X}from'lucide-react';
import BrandLogo from'./BrandLogo';
import ClientBusinessGrid from'./ClientBusinessGrid';
import ExportsCenter from'./ExportsCenter';
import InteractiveMap from'./InteractiveMap';
import Support360Panel from'./Support360Panel';
import BulkSupportSelector from'./BulkSupportSelector';
import{selectedSiteCount}from'../lib/bulkSupportSelection';
import{resolveClientPortalViews,isAllowedClientPortalView,projectClientExportRows}from'../lib/clientPortalViewRegistry';
import{createMultiSupportClientRequest,listAllClientPortalSection,listClientPortalSection,listClientPortalSupportContext}from'../services/clientPortalService';
import{prepareMapInfrastructureRows}from'../services/mapService';

// Les miniatures de la grille partagée restent chargées avec loading="lazy".

function ClientRequestForm({supports,onCreated,previewMode=false}){const lock=useRef(false);const[requestError,setRequestError]=useState('');const[selected,setSelected]=useState(new Set()),[form,setForm]=useState({type:'Installation',priority:'Normale',description:''}),[confirming,setConfirming]=useState(false),[busy,setBusy]=useState(false),sites=selectedSiteCount(supports,selected);async function submit(){if(previewMode||lock.current)return;lock.current=true;setBusy(true);setRequestError('');try{await createMultiSupportClientRequest({type:form.type,priority:form.priority,description:form.description,supportIds:[...selected]});setSelected(new Set());setConfirming(false);onCreated('Requête créée et supports validés par le serveur.')}catch(e){console.error('Client request failed',e);setRequestError('La requête n’a pas été enregistrée. Réessayez.')}finally{lock.current=false;setBusy(false)}}return <div className="client-request-form">{requestError&&<div role="alert">{requestError}</div>}<label>Type<select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option>Installation</option><option>Retrait</option><option>Inspection</option><option>Réparation</option></select></label><label>Priorité<select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}><option>Basse</option><option>Normale</option><option>Haute</option><option>Urgente</option></select></label><label>Description<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><BulkSupportSelector rows={supports} selected={selected} onChange={setSelected}/>{confirming?<section className="client-request-summary"><h2>Confirmer la requête</h2><strong>Supports : {selected.size}</strong><span>Sites : {sites}</span><button type="button" onClick={()=>setConfirming(false)}>Modifier la sélection</button><button type="button" disabled={busy||previewMode} onClick={submit}>Soumettre la requête</button></section>:<button type="button" disabled={!selected.size} onClick={()=>setConfirming(true)}>Vérifier avant soumission</button>}</div>}

function ClientDashboard({identity,views,sections,onNavigate,summary}){return <Module14Dashboard role={identity?.role} onNavigate={onNavigate} clientProjection={{identity,views,sections,kpis:summary?.value?.kpis,permission:summary?.value?.permission,loading:summary?.loading,error:summary?.error,refresh:summary?.refresh,refreshing:summary?.refreshing}}/>}

export default function ClientPortal(props){
 const target=props.preview?.target_user||props.preview?.user||props.preview||props.profile||{};
 const scope=[Boolean(props.preview),target.auth_user_id||target.id||target.courriel,target.client_id||target.organization_id,target.role].join(':');
 useEffect(()=>{clearSignedPhotoUrlCache();return clearSignedPhotoUrlCache},[scope]);
 return <ClientPortalSession key={scope} {...props}/>;
}
function ClientPortalSession({profile={},onLogout,preview=null,onClose}){
 const previewMode=Boolean(preview),previewUser=preview?.target_user||preview?.user||preview,previewSections=useMemo(()=>preview?.sections||{},[preview]);
 const dashboard=useDashboardSummary([profile.auth_user_id||profile.id,profile.role,profile.client_id].join(':'),!previewMode);
 const requestId=useRef(0),mapRequestId=useRef(0),infrastructureContext=useRef(null);
 const rememberInfrastructureContext=useCallback(context=>{infrastructureContext.current=context},[]);
 const [mapLoading,setMapLoading]=useState(false);
 const[summaries,setSummaries]=useState(previewSections);
 const[refreshing,setRefreshing]=useState(false);
 const[previewSummary,setPreviewSummary]=useState({value:null,loading:previewMode,error:''});
 const targetUserId=previewUser?.profile_id||previewUser?.id;
 useEffect(()=>{if(!previewMode)return;let live=true;setPreviewSummary({value:null,loading:true,error:''});loadPreviewSummary(targetUserId).then(value=>{if(!live)return;setPreviewSummary({value,loading:false,error:''});setIdentity(value.identity);setPermission(value.permission);setSummaries(value.sections);}).catch(e=>{if(live)setPreviewSummary({value:null,loading:false,error:e.message})});return()=>{live=false}},[previewMode,targetUserId]);
 useEffect(()=>()=>{requestId.current+=1;mapRequestId.current+=1},[]);
 const[active,setActive]=useState('dashboard'),[identity,setIdentity]=useState(previewUser||null),[permission,setPermission]=useState(preview?{visible_tables:preview.visible_tables||previewUser?.visible_tables||[],visible_columns:preview.visible_columns||previewUser?.visible_columns||{}}:null),[sections,setSections]=useState(previewSections),[result,setResult]=useState({rows:[],total:0,page:1,page_size:25}),[loading,setLoading]=useState(!preview),[error,setError]=useState(''),[menu,setMenu]=useState(false),[mapRows,setMapRows]=useState(null),[navigationContext,setNavigationContext]=useState({});
 const resolved=useMemo(()=>resolveClientPortalViews(permission?.visible_tables),[permission]),available=resolved.views,currentView=available.find(view=>view.id===active);
 useEffect(()=>{
  if(previewMode)return;
  setLoading(dashboard.loading);
  if(!dashboard.value)return;
  const {identity:id,permission:views,sections:totals}=dashboard.value;
  setIdentity(id);setPermission(views);setSummaries(totals);
  const allowed=resolveClientPortalViews(views.visible_tables).views;
  if(new URLSearchParams(window.location.search).get('section')==='reports'&&allowed.some(view=>view.id==='reports'))setActive('reports');
 },[previewMode,dashboard.value,dashboard.loading]);
 const load=useCallback(async(view,page=1,pageSize=25,filters={})=>{
  if(!view)return;
  const id=++requestId.current;
  setRefreshing(true);setError('');
  try{
   let next;
   if(view.id==='requests'){next=await loadBusinessRows('Infrastructures',{targetUserId:previewMode?targetUserId:null});}
   else if(CLIENT_BUSINESS_ROUTES[view.id]){next=await loadBusinessRows(CLIENT_BUSINESS_ROUTES[view.id],{targetUserId:previewMode?targetUserId:null});}
   else if(previewMode){const base=previewSections[view.section]||{rows:[],total:0,page:1,page_size:25},wanted=navigationContext.supportId;const rows=wanted?(base.rows||[]).filter(row=>String(row.support_id||'')===String(wanted)):base.rows||[];next={...base,rows,total:rows.length};}
   else next=navigationContext.supportId&&['photos','edt','history'].includes(view.section)?await listClientPortalSupportContext(view.section,navigationContext.supportId):view.id==='requests'?{rows:await listAllClientPortalSection('supports'),page:1,page_size:25,total:0}:await listClientPortalSection(view.section,{page,pageSize,filters});
   if(id!==requestId.current)return;
   setResult(next);setSections(current=>({...current,[view.section]:next}));

  }catch(e){if(id===requestId.current)setError(e.message||'Données client indisponibles.');}
  finally{if(id===requestId.current)setRefreshing(false);}
 },[previewMode,previewSections,navigationContext.supportId,targetUserId]);
 useEffect(()=>{if(currentView)load(currentView,1,25);return()=>{requestId.current+=1}},[currentView?.id,load]);
 const loadCurrent=useCallback((page,size,filters)=>load(currentView,page,size,filters),[load,currentView]);
 const navigate=(id,context={})=>{if(id==='support360'){if(!isAllowedClientPortalView(available,'infrastructures')){setError('Accès refusé.');return}}else if(!['dashboard','exports'].includes(id)&&!isAllowedClientPortalView(available,id)){setError('Accès refusé.');return}if(id==='exports'&&!available.some(view=>!['requests','members'].includes(view.id))){setError('Aucun export autorisé.');return}mapRequestId.current+=1;setMapLoading(false);setMapRows(null);setMenu(false);if(id===active&&String(context?.supportId||'')===String(navigationContext.supportId||''))return;requestId.current+=1;setRefreshing(false);setResult({rows:[],total:0,page:1,page_size:25});setNavigationContext(context?.supportId?{supportId:String(context.supportId)}:{});setActive(id);setMapRows(null);setMenu(false)};
 const navigateFromMap=(target,context)=>navigate(target==='Infrastructures'?'support360':target==='Photos et inventaire'?'photos':target==='Centre EDT et BT'?'edt':'history',context);
 async function openMap(supportId='',context={}){
  const id=++mapRequestId.current;
  const gridContext=context.mapRows?context:active==='infrastructures'?infrastructureContext.current:null;
  setMenu(false);setError('');
  if(gridContext?.mapRows&&!refreshing){infrastructureContext.current=gridContext;setMapRows(gridContext.mapRows);setMapLoading(false);return;}
  setMapLoading(true);
  try{const rows=(await loadBusinessRows('Infrastructures',{targetUserId:previewMode?targetUserId:null})).rows;if(id===mapRequestId.current)setMapRows(rows)}
  catch(e){if(id===mapRequestId.current)setError(e.message)}
  finally{if(id===mapRequestId.current)setMapLoading(false)}
 }
 function returnToTable(){mapRequestId.current+=1;setMapLoading(false);setMapRows(null);if(active!=='infrastructures')navigate('infrastructures');}

 useEffect(()=>{if(previewMode||active!=='support360')return;let live=true;const allowed=['photos','history','edt'].filter(section=>available.some(view=>view.section===section));Promise.all(allowed.map(async section=>[section,await listClientPortalSupportContext(section,navigationContext.supportId)])).then(entries=>{if(live)setSections(current=>({...current,...Object.fromEntries(entries)}))}).catch(error=>{if(live)setError(error.message)});return()=>{live=false}},[previewMode,active,navigationContext.supportId,permission]);
 const supportScope=useMemo(()=>{const source=previewMode?previewSections:sections;const rows=section=>(source[section]?.rows||[]).filter(row=>String(row.support_id)===String(navigationContext.supportId));return {photos:rows('photos'),history:rows('history'),issues:rows('issues'),inspections:[],workOrders:rows('work_orders'),edtLinks:rows('edt'),logs:[]}},[previewMode,previewSections,sections,navigationContext.supportId]);
 const exportDomainRows=async(view,filters={})=>projectClientExportRows(view,CLIENT_BUSINESS_ROUTES[view.id]?(await loadBusinessRows(CLIENT_BUSINESS_ROUTES[view.id],{targetUserId:previewMode?targetUserId:null})).rows:previewMode?(previewSections[view.section]?.rows||[]):await listAllClientPortalSection(view.section,{filters}),permission?.visible_columns);
 const loadAll=filters=>exportDomainRows(currentView,filters);
 let content;if(active==='dashboard')content=<ClientDashboard identity={identity} views={available} sections={summaries} onNavigate={navigate} summary={previewMode?previewSummary:dashboard}/>;else if(active==='support360')content=<Support360Panel key={navigationContext.supportId} supportId={navigationContext.supportId} role={identity?.role||profile.role} previewTargetId={previewMode?targetUserId:null}/>;else if(active==='exports'){const domains=available.filter(view=>!['requests','members'].includes(view.id)).map(view=>({id:view.id,label:view.label,section:view.section}));content=<ExportsCenter title="Exports" domains={domains} loadRows={domain=>exportDomainRows(domain)}/>;}else if(currentView?.id==='requests')content=businessCapabilities(identity?.role||profile.role).createClientRequest?<ClientRequestForm previewMode={previewMode} supports={result.rows||[]} onCreated={setError}/>:<div className="client-empty">Accès refusé.</div>;else if(currentView?.id==='edt')content=<OperationsCenter role={identity?.role||profile.role} permission={permission} previewTargetId={previewMode?targetUserId:null}/>;else if(['campaigns','communications'].includes(currentView?.id))content=<CampaignsPanel scopeKey={[identity?.user_id,identity?.client_id,previewMode].join(':')} role={identity?.role||profile.role} permission={permission} scopedCampaigns={result.rows||[]} onReload={()=>load(currentView)} businessContext={currentView.id==='campaigns'?'marketing':'operational_communication'} previewMode={previewMode}/>;else if(CLIENT_BUSINESS_ROUTES[currentView?.id])content=<BusinessTable key={currentView.id} previewMode={previewMode} previewTargetId={previewMode?targetUserId:null} name={CLIENT_BUSINESS_ROUTES[currentView.id]} dataStore={{[CLIENT_BUSINESS_ROUTES[currentView.id]]:result}} role={identity?.role||profile.role} rolePermission={permission} scopeKey={[identity?.user_id,identity?.client_id,identity?.role,previewMode].join(':')} initialGridContext={currentView.id==='infrastructures'?infrastructureContext.current:null} onRowsUpdated={()=>load(currentView)} onGridContextChange={rememberInfrastructureContext} onOpenMap={openMap}/>;else if(currentView)content=<ClientBusinessGrid readOnly={businessCapabilities(identity?.role||profile.role).readOnly} columnPermissions={permission?.visible_columns} key={currentView.id} refreshing={refreshing} scopeKey={[identity?.client_id||identity?.organization_id,identity?.role].join(':')} view={currentView} result={result} initialQuery={navigationContext.supportId||''} onLoad={loadCurrent} onLoadAll={loadAll} onOpenMap={openMap}/>;else content=<div className="client-empty">Aucune vue n’est actuellement autorisée.</div>;
 return <div className={`client-portal${previewMode?' client-preview-mode':''}`}>{previewMode&&<div className="ca-preview-banner"><strong>APERÇU ADMINISTRATEUR — Vue simulée pour {identity?.nom||identity?.name||identity?.courriel}</strong><span>L’Admin reste connecté comme Administrateur. Les enregistrements sont désactivés dans cet aperçu.</span><button onClick={onClose}>Quitter l’aperçu</button></div>}<header><div className="client-brand"><BrandLogo priority/><span>Display Manager</span></div><button className="client-menu-button" onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}<span>Menu</span></button><div className="client-profile"><span>{identity?.name||identity?.nom||profile.nom||profile.courriel}</span><small>{identity?.role||profile.role}</small>{!previewMode&&<button onClick={onLogout}><LogOut/> Déconnexion</button>}</div></header><div className="client-body"><aside className={menu?'open':''}><button className={active==='dashboard'&&mapRows===null&&!mapLoading?'active':''} onClick={()=>navigate('dashboard')}><BarChart3/>Sommaire</button>{available.some(view=>!['requests','members'].includes(view.id))&&<button className={active==='exports'&&mapRows===null&&!mapLoading?'active':''} onClick={()=>navigate('exports')}><Download/>Exports</button>}{available.map(view=>{const Icon=view.icon;return <button key={view.id} className={active===view.id&&mapRows===null&&!mapLoading?'active':''} onClick={()=>navigate(view.id)}><Icon/>{view.label}</button>})}{isAllowedClientPortalView(available,'infrastructures')&&<button className={mapRows!==null||mapLoading?'active':''} onClick={()=>openMap()}><MapPin/>Carte interactive</button>}</aside><main aria-busy={refreshing||mapLoading}>{!['dashboard','exports'].includes(active)&&<div className="client-title"><div><span>{identity?.client_name||'Mon organisation'}</span><h1>{currentView?.label}</h1></div><span>{refreshing&&!result.rows?.length?'Chargement…':`${result.total||0} résultat(s)`}</span></div>}{resolved.unknown.length>0&&<div className="client-notice" role="alert">Configuration portail invalide : vue non implémentée.</div>}{active==='support360'&&<button onClick={()=>navigate('infrastructures')}>Retour au tableau</button>}{error&&<div className="client-notice" role="alert">{error}</div>}{loading||mapLoading||(refreshing&&!result.rows?.length)?<div className="client-loading" role="status">{mapLoading?'Chargement de la carte interactive…':'Chargement des données…'}</div>:<><div hidden={mapRows!==null}>{content}</div>{mapRows!==null&&<><button className="client-back" onClick={returnToTable}><ArrowLeft/> Tableau</button><InteractiveMap dataStore={{Infrastructures:{rows:mapRows}}} role={identity?.role||profile.role} onNavigate={navigateFromMap}/></>}</>}</main></div></div>;
}
