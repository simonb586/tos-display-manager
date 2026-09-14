import React, {useEffect, useState} from 'react';
import {assignVisualToEdt, listCampaignVisuals} from '../services/campaignVisualService';

export default function EdtVisualAssignments({edt, phases, busy, run}) {
  const [visuals,setVisuals]=useState([]);
  const [visualId,setVisualId]=useState('');
  const [phaseId,setPhaseId]=useState('');
  const [error,setError]=useState('');
  const [revision,setRevision]=useState(0);
  const [loading,setLoading]=useState(true);
  const installationPhases=phases.filter(p=>String(p.edt_id)===String(edt.id)&&p.phase_type==='installation');
  const targetPhase=phaseId|| (installationPhases.length===1 ? String(installationPhases[0].id) : '');
  useEffect(()=>{
    let current=true;
    setLoading(true);setError('');setVisualId('');setPhaseId('');
    listCampaignVisuals().then(rows=>{if(current)setVisuals(rows.filter(v=>String(v.campagne_id)===String(edt.campagne_id)));})
      .catch(e=>{console.error('Visuels de l’EDT indisponibles',e);if(current)setError('Les visuels n’ont pas pu être chargés.');})
      .finally(()=>{if(current)setLoading(false);});
    return ()=>{current=false;};
  },[edt.id,edt.campagne_id,revision]);
  const linked=visuals.filter(v=>installationPhases.some(p=>String(p.id)===String(v.edt_phase_id)));
  const save=(id,phase)=>run(async()=>{
    await assignVisualToEdt(id,phase);setRevision(n=>n+1);
  },phase?'Visuel rattaché à l’EDT.':'Rattachement du visuel retiré.');
  return <section className="v07-card operations-wide" aria-label="Visuels associés à l’EDT">
    <h2>Visuels associés à l’EDT</h2>
    <p>Le terrain retrouve cet EDT à partir du visuel choisi. Les affectations de supports restent indépendantes.</p>
    {error?<div role="alert">{error} <button type="button" onClick={()=>setRevision(n=>n+1)}>Réessayer</button></div>:loading?<p role="status">Chargement des visuels…</p>:<>
      {linked.length?<ul>{linked.map(v=><li key={v.id}>{v.nom_visuel} — {v.format_support} <button type="button" disabled={busy} onClick={()=>save(v.id,null)}>Détacher de cet EDT</button></li>)}</ul>:<p>Aucun visuel associé à cet EDT.</p>}
      <form onSubmit={e=>{e.preventDefault();if(!busy&&visualId&&targetPhase)save(visualId,targetPhase);}}>
        <label>Visuel de la campagne <select required disabled={busy} value={visualId} onChange={e=>setVisualId(e.target.value)}>
          <option value="">Sélectionner un visuel</option>
          {visuals.map(v=><option key={v.id} value={v.id}>{v.nom_visuel} — {v.format_support}{v.edt_phase?.edt?.no_edt?` — actuellement ${v.edt_phase.edt.no_edt}`:''}</option>)}
        </select></label>
        {installationPhases.length>1&&<label>Phase d’installation <select required disabled={busy} value={targetPhase} onChange={e=>setPhaseId(e.target.value)}><option value="">Sélectionner</option>{installationPhases.map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}</select></label>}
        {!installationPhases.length&&<p>Créez une phase d’installation pour rattacher un visuel.</p>}
        <button type="submit" disabled={busy||!visualId||!targetPhase}>Rattacher le visuel</button>
      </form>
    </>}
  </section>;
}
