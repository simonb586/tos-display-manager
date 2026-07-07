import React, {useEffect, useMemo, useState} from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const DATA = '/data/';
const EXCLUDE = new Set(['Date nul','Enjeux nul','Record ID#','Record Owner','Last Modified By']);

function parseCSV(text){
  const rows=[]; let row=[], cell='', q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i], n=text[i+1];
    if(c==='"' && q && n==='"'){ cell+='"'; i++; continue; }
    if(c==='"'){ q=!q; continue; }
    if(c===',' && !q){ row.push(cell); cell=''; continue; }
    if((c==='\n'||c==='\r') && !q){
      if(c==='\r' && n==='\n') i++;
      row.push(cell); cell='';
      if(row.some(x=>String(x).trim()!=='')) rows.push(row);
      row=[]; continue;
    }
    cell+=c;
  }
  if(cell || row.length){ row.push(cell); rows.push(row); }
  const headers=(rows.shift()||[]).map(h=>h.trim());
  return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,(r[i]||'').trim()])));
}
async function loadCsv(name){
  const r=await fetch(DATA+name); if(!r.ok) throw new Error(name);
  return parseCSV(await r.text());
}
const get=(o,...names)=>names.map(n=>o?.[n]).find(v=>v!==undefined && v!==null && String(v).trim()!=='') || '';
const today=()=>new Date().toISOString().slice(0,10);
const slug=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

function App(){
  const [data,setData]=useState(null); const [loading,setLoading]=useState(true); const [err,setErr]=useState('');
  const [tab,setTab]=useState('infrastructures'); const [selected,setSelected]=useState(null); const [collapsed,setCollapsed]=useState(false);
  const [filters,setFilters]=useState({}); const [global,setGlobal]=useState(''); const [hidden,setHidden]=useState({});
  const [photos,setPhotos]=useState([]); const [history,setHistory]=useState([]); const [autoLog,setAutoLog]=useState([]);
  const [mobileSupport,setMobileSupport]=useState(''); const [mobileVisuel,setMobileVisuel]=useState(''); const [issueText,setIssueText]=useState(''); const [issueType,setIssueType]=useState('Affichage');

  useEffect(()=>{(async()=>{try{
    const files={
      infrastructures:'Infrastructures__cadres_et_supports_.csv', campagnes:'Campagnes_et_visuels.csv', repertoire:'R__pertoires_des_affiches.csv',
      communications:'Communication_op__rationnelle.csv', enjeux:'Enjeux_des_cadres_et_supports.csv', ci:'Centres_d_informations__C_I__.csv', ci_enjeux:'C_I__avec_enjeux.csv', arrets:'Liste_des_arr__ts.csv', voitures:'Voitures_trains.csv'
    };
    const loaded={}; for(const [k,f] of Object.entries(files)) loaded[k]=await loadCsv(f);
    setData(loaded); setSelected(loaded.infrastructures[0]);
    setPhotos([{photo_id:'PH-0001',support_id:get(loaded.infrastructures[0],'Support ID'),type:'Installation',date:today(),utilisateur:'Démo installateur',commentaire:'Photo de départ V0.5'}]);
  }catch(e){setErr('Erreur de chargement des fichiers CSV: '+e.message)} finally{setLoading(false)}})()},[]);

  const columns=useMemo(()=> data ? Object.keys(data.infrastructures[0]||{}).filter(c=>!EXCLUDE.has(c)).concat(['Latitude','Longitude','Carte interactive']) : [],[data]);
  const infraRows=useMemo(()=>{ if(!data) return []; const g=slug(global); return data.infrastructures.filter(r=>{
    if(g && !slug(Object.values(r).join(' ')).includes(g)) return false;
    for(const [k,v] of Object.entries(filters)){ if(v && !slug(r[k]).includes(slug(v))) return false; }
    return true;
  }).slice(0,500);},[data,global,filters]);
  const stats=useMemo(()=>{ if(!data) return {}; return {
    infrastructures:data.infrastructures.length, campagnes:data.campagnes.length, repertoire:data.repertoire.length,
    enjeux:data.enjeux.filter(e=>slug(get(e,'Statut')).includes('actif')).length,
    photos:photos.length, historique:history.length
  }},[data,photos,history]);
  const currentSupportId=get(selected,'Support ID');
  const relatedCampagnes=useMemo(()=> data ? data.campagnes.filter(c=>get(c,'Support ID')===currentSupportId) : [],[data,currentSupportId]);
  const relatedEnjeux=useMemo(()=> data ? data.enjeux.filter(e=>get(e,'Related Support','#Du cadre')===currentSupportId) : [],[data,currentSupportId]);
  const relatedComms=useMemo(()=> data ? data.communications.filter(c=>get(c,'ID du support')===currentSupportId) : [],[data,currentSupportId]);
  const supportPhotos=photos.filter(p=>p.support_id===currentSupportId);
  const compatibleVisuels=useMemo(()=>{
    if(!data||!selected) return [];
    const format=slug(get(selected,"Formats d'affichage"));
    return data.repertoire.filter(v=> slug(get(v,'Format')).includes(format) || format.includes(slug(get(v,'Format'))) || !get(v,'Format')).slice(0,80);
  },[data,selected]);

  function runInstallWorkflow(supportId, visuelName){
    if(!data) return; const infra=data.infrastructures.find(i=>get(i,'Support ID')===supportId); if(!infra) return alert('Support ID introuvable');
    const visuel=data.repertoire.find(v=>get(v,'Nom détaillé du visuel')===visuelName || get(v,'Visuel')===visuelName) || data.repertoire[0];
    const old={campagne:get(infra,'Nom de la campagne actuelle'),visuel:get(infra,'Visuel actuel du cadre'),edt:get(infra,'EDT Associé')};
    const newCamp=get(visuel,'Nom de la campagne'); const newVis=get(visuel,'Nom détaillé du visuel','Visuel');
    infra['Campagne précédentes']=old.campagne; infra['EDT précédent associé']=old.edt; infra['Nom de la campagne actuelle']=newCamp; infra['Visuel actuel du cadre']=newVis; infra['Visuel de la campagne']=newVis; infra['VISUEL EN EXPO']=newVis; infra['Date de la dernière manipulation']=today();
    const ph={photo_id:'PH-'+String(photos.length+1).padStart(4,'0'),support_id:supportId,type:'Installation / Remplacement',date:today(),utilisateur:'Installateur démo',commentaire:'Photo ajoutée depuis l’application mobile V0.5',campagne:newCamp,visuel:newVis,gps:'Position mobile'};
    setPhotos(p=>[ph,...p]);
    setHistory(h=>[{support_id:supportId,campagne:newCamp,visuel:newVis,ancienne_campagne:old.campagne,ancien_visuel:old.visuel,date_installation:today(),source:'Application mobile',photo_id:ph.photo_id},...h]);
    setAutoLog(l=>[{date:new Date().toLocaleString('fr-CA'),event:'Installation / remplacement',support_id:supportId,actions:['Infrastructure mise à jour','Répertoire des affiches simulé: exposition +1 / entrepôt -1','Historique des campagnes créé','Photo liée au support','Date de dernière manipulation mise à jour'].join(' • ')},...l]);
    setSelected({...infra}); setMobileVisuel(''); alert('Synchronisation simulée terminée pour '+supportId);
  }
  function declareIssue(){
    const sid=mobileSupport || currentSupportId; if(!sid) return alert('Entre un Support ID');
    const infra=data.infrastructures.find(i=>get(i,'Support ID')===sid); if(infra){ infra['Enjeux']=issueText||'Enjeu déclaré'; infra["Type d'enjeux"]=issueType; setSelected({...infra}); }
    setAutoLog(l=>[{date:new Date().toLocaleString('fr-CA'),event:'Déclaration d’enjeu',support_id:sid,actions:'Enjeux des cadres et supports créé • Champs Enjeux et Type d’enjeux de l’infrastructure mis à jour • Bon de travail prêt à créer'},...l]);
    alert('Enjeu déclaré pour '+sid); setIssueText('');
  }

  if(loading) return <div className="center">Chargement de TOS Display Manager V0.5...</div>;
  if(err) return <div className="center error">{err}</div>;

  return <div className="app">
    <aside className="sidebar"><div className="brand">TOS<span>Display Manager</span><b>V0.5</b></div>
      {[['dashboard','Tableau de bord'],['infrastructures','Infrastructures'],['mobile','Application terrain'],['photos','Photos'],['history','Historique'],['admin','Administration']].map(x=><button key={x[0]} className={tab===x[0]?'active':''} onClick={()=>setTab(x[0])}>{x[1]}</button>)}
    </aside>
    <main className="main">
      <header><h1>{tab==='dashboard'?'Centre de commande':tab==='mobile'?'Application mobile terrain':tab==='photos'?'Table centrale Photos':tab==='history'?'Historique et automatisations':tab==='admin'?'Administration':'Infrastructures'}</h1><span>portail.groupetos.com</span></header>
      {tab==='dashboard' && <Dashboard stats={stats} log={autoLog}/>} 
      {tab==='infrastructures' && <section className="split">
        <div className="left">
          <div className="tools"><input placeholder="Recherche globale" value={global} onChange={e=>setGlobal(e.target.value)}/><button onClick={()=>setFilters({})}>Effacer filtres</button><button>Exporter Excel filtré</button></div>
          <div className="tableWrap"><table><thead><tr>{columns.filter(c=>!hidden[c]).map(c=><th key={c}>{c}<input value={filters[c]||''} onChange={e=>setFilters({...filters,[c]:e.target.value})} placeholder="Filtrer"/></th>)}</tr></thead><tbody>{infraRows.map((r,i)=><tr key={i} onClick={()=>setSelected(r)} className={get(r,'Support ID')===currentSupportId?'sel':''}>{columns.filter(c=>!hidden[c]).map(c=><td key={c}>{c==='Carte interactive'?<a target="_blank" href={`https://www.google.com/maps?q=${r.Latitude||45.5017},${r.Longitude||-73.5673}`}>Ouvrir</a>:c==='Latitude'?(r.Latitude||'À compléter'):c==='Longitude'?(r.Longitude||'À compléter'):get(r,c)}</td>)}</tr>)}</tbody></table></div>
        </div>
        {!collapsed && <DetailPanel selected={selected} campagnes={relatedCampagnes} enjeux={relatedEnjeux} comms={relatedComms} photos={supportPhotos} history={history.filter(h=>h.support_id===currentSupportId)} onCollapse={()=>setCollapsed(true)}/>} 
        {collapsed && <button className="openPanel" onClick={()=>setCollapsed(false)}>◀ Fiche 360°</button>}
      </section>}
      {tab==='mobile' && <Mobile selected={selected} setSelected={setSelected} data={data} support={mobileSupport} setSupport={setMobileSupport} compatible={compatibleVisuels} visuel={mobileVisuel} setVisuel={setMobileVisuel} run={runInstallWorkflow} issueText={issueText} setIssueText={setIssueText} issueType={issueType} setIssueType={setIssueType} declareIssue={declareIssue}/>} 
      {tab==='photos' && <Photos photos={photos}/>} 
      {tab==='history' && <History history={history} log={autoLog}/>} 
      {tab==='admin' && <Admin hidden={hidden} setHidden={setHidden} columns={columns}/>} 
    </main>
  </div>
}
function Dashboard({stats,log}){return <div><div className="cards">{Object.entries(stats).map(([k,v])=><div className="card" key={k}><b>{v}</b><span>{k}</span></div>)}</div><h2>Priorités V0.5</h2><div className="grid2"><div className="panel"><h3>Ce qui est fonctionnel</h3><ul><li>Import des tables CSV avec accents corrigés.</li><li>Support ID comme clé métier.</li><li>Filtres sur chaque colonne de la table Infrastructures.</li><li>Fiche Infrastructure 360° avec panneau réduit.</li><li>Workflow terrain simulé : choix du visuel, photo, historique.</li></ul></div><div className="panel"><h3>Dernières automatisations</h3>{log.slice(0,5).map((l,i)=><p key={i}><b>{l.event}</b><br/>{l.support_id} — {l.actions}</p>)}</div></div></div>}
function DetailPanel({selected,campagnes,enjeux,comms,photos,history,onCollapse}){if(!selected) return null; const sid=get(selected,'Support ID'); return <aside className="detail"><button className="collapse" onClick={onCollapse}>Masquer ▶</button><h2>Support {sid}</h2><div className="status">{get(selected,'Enjeux')?'🟡 Enjeu à vérifier':'🟢 Conforme'}</div><p><b>Campagne actuelle</b><br/>{get(selected,'Nom de la campagne actuelle')||'Aucune'}</p><p><b>Visuel actuel</b><br/>{get(selected,'Visuel actuel du cadre','VISUEL EN EXPO')||'Aucun'}</p><p><b>Format</b><br/>{get(selected,"Formats d'affichage")}</p><p><b>Dernière manipulation</b><br/>{get(selected,'Date de la dernière manipulation')||'À compléter'}</p><a className="map" target="_blank" href={`https://www.google.com/maps?q=${selected.Latitude||45.5017},${selected.Longitude||-73.5673}`}>🗺 Ouvrir la carte</a><h3>Relations</h3><small>{campagnes.length} campagnes • {enjeux.length} enjeux • {comms.length} communications • {photos.length} photos • {history.length} historiques</small><h3>Photos</h3>{photos.length?photos.map(p=><div className="mini" key={p.photo_id}>{p.photo_id} — {p.type}<br/><small>{p.date}</small></div>):<div className="empty">Aucune photo encore</div>}<h3>Enjeux</h3>{enjeux.slice(0,3).map((e,i)=><div className="mini" key={i}>{get(e,'Enjeux')}<br/><small>{get(e,'Statut')}</small></div>)}</aside>}
function Mobile({selected,setSelected,data,support,setSupport,compatible,visuel,setVisuel,run,issueText,setIssueText,issueType,setIssueType,declareIssue}){function find(){const r=data.infrastructures.find(i=>get(i,'Support ID')===support); if(r) setSelected(r); else alert('Support introuvable');} return <div className="mobileArea"><div className="phone"><div className="phoneTop">TOS Terrain</div><label>Support ID</label><div className="row"><input value={support} onChange={e=>setSupport(e.target.value)} placeholder="Ex: HC-70922"/><button onClick={find}>Rechercher</button></div><div className="info"><b>{get(selected,'Support ID')}</b><br/>{get(selected,'Emplacement/Visibilité')}<br/><small>Format: {get(selected,"Formats d'affichage")}</small><br/><small>Visuel actuel: {get(selected,'Visuel actuel du cadre','VISUEL EN EXPO')}</small></div><label>Nouveau visuel compatible</label><select value={visuel} onChange={e=>setVisuel(e.target.value)}><option value="">Choisir...</option>{compatible.map((v,i)=><option key={i}>{get(v,'Nom détaillé du visuel','Visuel')}</option>)}</select><button className="big">📷 Prendre une photo</button><button className="finish" onClick={()=>run(get(selected,'Support ID'),visuel)}>✓ Terminer et synchroniser</button><nav><span>Support</span><span>Photos</span><span>Enjeux</span></nav></div><div className="panel"><h3>Déclarer un enjeu</h3><input placeholder="Support ID" value={support} onChange={e=>setSupport(e.target.value)}/><select value={issueType} onChange={e=>setIssueType(e.target.value)}><option>Affichage</option><option>Structure</option><option>Vandalisme</option><option>Sécurité</option><option>Inventaire</option></select><textarea placeholder="Description de l’enjeu" value={issueText} onChange={e=>setIssueText(e.target.value)} /><button onClick={declareIssue}>Créer l’enjeu</button></div></div>}
function Photos({photos}){return <div className="panel"><h2>Table centrale Photos</h2><p>Une photo est déposée une seule fois et peut apparaître dans plusieurs tables.</p><table><thead><tr><th>Photo ID</th><th>Support ID</th><th>Type</th><th>Campagne</th><th>Visuel</th><th>Date</th><th>Utilisateur</th></tr></thead><tbody>{photos.map(p=><tr key={p.photo_id}><td>{p.photo_id}</td><td>{p.support_id}</td><td>{p.type}</td><td>{p.campagne}</td><td>{p.visuel}</td><td>{p.date}</td><td>{p.utilisateur}</td></tr>)}</tbody></table></div>}
function History({history,log}){return <div className="grid2"><div className="panel"><h2>Historique des campagnes par support</h2><table><thead><tr><th>Support ID</th><th>Ancienne campagne</th><th>Nouvelle campagne</th><th>Visuel</th><th>Date</th><th>Source</th></tr></thead><tbody>{history.map((h,i)=><tr key={i}><td>{h.support_id}</td><td>{h.ancienne_campagne}</td><td>{h.campagne}</td><td>{h.visuel}</td><td>{h.date_installation}</td><td>{h.source}</td></tr>)}</tbody></table></div><div className="panel"><h2>Journal des automatisations</h2>{log.map((l,i)=><p key={i}><b>{l.date} — {l.event}</b><br/>{l.support_id}<br/><small>{l.actions}</small></p>)}</div></div>}
function Admin({columns,hidden,setHidden}){return <div className="panel"><h2>Administration des vues</h2><p>Masquer/afficher des colonnes dans Infrastructures.</p><div className="cols">{columns.map(c=><label key={c}><input type="checkbox" checked={!hidden[c]} onChange={e=>setHidden({...hidden,[c]:!e.target.checked})}/>{c}</label>)}</div></div>}

createRoot(document.getElementById('root')).render(<App/>);
