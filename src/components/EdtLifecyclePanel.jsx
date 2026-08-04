import React,{useMemo,useState}from'react';
import{AlertTriangle,CalendarClock,CheckCircle2,FileText,LockKeyhole,Play,RotateCcw,Send}from'lucide-react';
import{closeEdtLifecycle,initializeEdtLifecycle,markPhaseReportSent,scheduleEdtRemoval,transitionEdtPhase}from'../services/operationsService';

const labels={installation:'Installation',retrait:'Retrait'};
const fmt=value=>value?new Date(value).toLocaleString('fr-CA'):'—';

export default function EdtLifecyclePanel({edt,data,canManage,busy,run}){
  const[campaignId,setCampaignId]=useState(edt.campagne_id||'');
  const[removalDate,setRemovalDate]=useState('');
  const[justification,setJustification]=useState('');
  const phases=useMemo(()=>(data.phases||[]).filter(item=>String(item.edt_id)===String(edt.id)&&['installation','retrait'].includes(item.phase_type)),[data.phases,edt.id]);
  const reports=useMemo(()=>(data.phaseReports||[]).filter(item=>String(item.edt_id)===String(edt.id)),[data.phaseReports,edt.id]);
  const campaign=(data.campaigns||[]).find(item=>String(item.id)===String(edt.campagne_id));
  const installation=phases.find(item=>item.phase_type==='installation');
  const removal=phases.find(item=>item.phase_type==='retrait');

  function phaseAction(phase,action){
    let comment='';let photoException='';
    if(action==='fermer'){
      comment=window.prompt('Commentaire de fermeture ou anomalies documentées :','')||'';
      photoException=window.prompt('Exception photo (laisser vide si les photos requises sont présentes) :','')||'';
    }
    if(action==='rouvrir'){
      comment=window.prompt('Motif obligatoire de réouverture :','')||'';
      if(!comment.trim())return;
    }
    run(()=>transitionEdtPhase(phase.id,action,{comment,photoException,anomalies:comment?[{description:comment}]:[]}),`${labels[phase.phase_type]} : action « ${action} » enregistrée.`);
  }

  return <section className="v07-card operations-wide edt-lifecycle">
    <header className="edt-lifecycle-head"><div><span className="eyebrow">Bloc 13.2-P1</span><h2>Cycle de vie Installation / Retrait</h2><p>Deux fermetures indépendantes, rapports versionnés et historique permanent.</p></div><span className={`lifecycle-status status-${edt.lifecycle_status||'brouillon'}`}>{edt.lifecycle_status||'brouillon'}</span></header>
    {!edt.campagne_id?<div className="lifecycle-setup"><AlertTriangle/><div><strong>Campagne obligatoire</strong><p>Sélectionnez une campagne possédant une date de fin exploitable.</p></div><select value={campaignId} onChange={event=>setCampaignId(event.target.value)}><option value="">Choisir</option>{(data.campaigns||[]).map(item=><option key={item.id} value={item.id} disabled={!item.date_fin}>{item.nom_campagne} — fin {item.date_fin||'absente'}</option>)}</select>{canManage&&<button disabled={busy||!campaignId} onClick={()=>run(()=>initializeEdtLifecycle(edt.id,campaignId),'Cycle EDT initialisé.')}>Initialiser</button>}</div>:<div className="lifecycle-campaign"><CalendarClock/><div><strong>{campaign?.nom_campagne||edt.campagne}</strong><span>Fin de campagne : {campaign?.date_fin||'Non disponible'} · retrait proposé : {edt.retrait_date_proposee||campaign?.date_fin||'—'}</span></div></div>}
    <div className="lifecycle-phases">{['installation','retrait'].map(type=>{
      const phase=phases.find(item=>item.phase_type===type);const phaseReports=reports.filter(item=>item.phase_type===type);
      return <article key={type} className="lifecycle-phase"><header><div><span>{type==='installation'?'01':'02'}</span><div><h3>{labels[type]}</h3><small>{phase?.statut||'Non initialisée'}</small></div></div><strong>{phase?.progression||0}%</strong></header>
        {phase?<><dl><div><dt>Début prévu</dt><dd>{phase.date_debut_prevue||'—'}</dd></div><div><dt>Début réel</dt><dd>{fmt(phase.date_debut_reelle)}</dd></div><div><dt>Fin réelle</dt><dd>{fmt(phase.date_fin_reelle)}</dd></div><div><dt>Fermeture</dt><dd>{fmt(phase.closed_at)}</dd></div></dl><div className="lifecycle-progress"><i style={{width:`${phase.progression||0}%`}}/></div>
        {type==='retrait'&&canManage&&<div className="removal-schedule"><input type="date" value={removalDate} min={installation?.closed_at?.slice(0,10)||''} onChange={event=>setRemovalDate(event.target.value)}/><input placeholder="Justification si avant fin campagne" value={justification} onChange={event=>setJustification(event.target.value)}/><button disabled={!removalDate||busy} onClick={()=>run(()=>scheduleEdtRemoval(phase.id,removalDate,justification),'Retrait planifié.')}>Planifier</button></div>}
        {canManage&&<div className="phase-actions"><button disabled={busy||phase.closed_at} onClick={()=>phaseAction(phase,'demarrer')}><Play/>Démarrer</button><button disabled={busy||phase.closed_at} onClick={()=>phaseAction(phase,'terminer')}><CheckCircle2/>Terminer</button><button disabled={busy||phase.closed_at} onClick={()=>phaseAction(phase,'fermer')}><LockKeyhole/>Fermer</button><button disabled={busy||!phase.closed_at} onClick={()=>phaseAction(phase,'rouvrir')}><RotateCcw/>Rouvrir</button></div>}
        <section className="phase-reports"><h4><FileText/> Rapports {labels[type].toLowerCase()}</h4>{phaseReports.length?phaseReports.map(report=><details key={report.id}><summary>Version {report.version} · {report.status}</summary><p>Généré : {fmt(report.generated_at)} · Destinataire : {report.recipient||'—'} · Envoi : {fmt(report.sent_at)}</p><pre>{JSON.stringify(report.report_snapshot,null,2)}</pre>{canManage&&report.status!=='envoye'&&<button onClick={()=>{const recipient=window.prompt('Destinataire du rapport :',report.recipient||'')||'';if(recipient)run(()=>markPhaseReportSent(report.id,recipient),'Envoi du rapport consigné.')}}><Send/>Consigner l’envoi</button>}</details>):<p className="executive-empty">Aucune version générée.</p>}</section></>:<p className="executive-empty">Initialisez le cycle pour créer cette phase.</p>}
      </article>})}</div>
    <footer className="lifecycle-close"><div><strong>Fermeture globale</strong><span>Disponible seulement lorsque Installation et Retrait sont fermés.</span></div>{canManage&&<button disabled={busy||installation?.statut!=='fermee'||removal?.statut!=='ferme'} onClick={()=>{const reason=window.prompt('Exceptions ou blocages documentés (facultatif) :','')||'';run(()=>closeEdtLifecycle(edt.id,reason),'EDT fermé.')}}><LockKeyhole/>Fermer l’EDT</button>}</footer>
    <section className="lifecycle-history"><h3>Historique permanent</h3>{(data.history||[]).filter(item=>item.entity_type==='edt_lifecycle'&&item.entity_reference===edt.no_edt).slice(0,20).map(item=><article key={item.id}><strong>{item.action}</strong><span>{fmt(item.created_at)} · {item.details||'Aucun motif'}</span></article>)}</section>
  </section>;
}
