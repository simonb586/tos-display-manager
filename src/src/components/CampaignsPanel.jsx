import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Megaphone, Pencil, Plus, Save } from 'lucide-react';
import { listMasterCampaigns, saveMasterCampaign } from '../services/campaignService';

const emptyCampaign = { nom_campagne:'', code_campagne:'', client:'', type_campagne:'Installation', visuel_generique:'', no_edt:'', statut:'Brouillon', publiee_terrain:false, instructions_terrain:'' };

export default function CampaignsPanel({ role }) {
  const [campaigns,setCampaigns] = useState([]);
  const [form,setForm] = useState(emptyCampaign);
  const [message,setMessage] = useState('');
  const canManage = ['Administrateur','Coordonnateur'].includes(role);

  async function reload(){ try { setCampaigns(await listMasterCampaigns()); } catch(e){ setMessage(e.message); } }
  useEffect(()=>{ reload(); },[]);

  async function submit(e){
    e.preventDefault();
    try { await saveMasterCampaign(form); setForm(emptyCampaign); await reload(); setMessage('Campagne enregistrée.'); }
    catch(error){ setMessage(error.message); }
  }

  return <div className="campaigns-page">
    <header className="campaigns-hero"><div><h1>Campagnes maîtres</h1><p>Crée la source de vérité publiée dans l’application terrain.</p></div></header>
    {message&&<div className="relations-message">{message}</div>}
    <div className="campaigns-layout">
      {canManage&&<section className="relations-card"><h2><Plus/> Créer une campagne</h2><form className="campaigns-form" onSubmit={submit}>
        <label>Nom<input required value={form.nom_campagne} onChange={e=>setForm({...form,nom_campagne:e.target.value})}/></label>
        <label>Code<input value={form.code_campagne} onChange={e=>setForm({...form,code_campagne:e.target.value})}/></label>
        <label>Client<input value={form.client} onChange={e=>setForm({...form,client:e.target.value})}/></label>
        <label>Type<select value={form.type_campagne} onChange={e=>setForm({...form,type_campagne:e.target.value})}><option>Installation</option><option>Remplacement</option><option>Retrait</option><option>Inspection</option></select></label>
        <label>Visuel générique<input value={form.visuel_generique} onChange={e=>setForm({...form,visuel_generique:e.target.value})}/></label>
        <label>No EDT<input value={form.no_edt} onChange={e=>setForm({...form,no_edt:e.target.value})}/></label>
        <label>Statut<select value={form.statut} onChange={e=>setForm({...form,statut:e.target.value})}><option>Brouillon</option><option>Active</option><option>Terminée</option><option>Archivée</option></select></label>
        <label className="campaign-check"><input type="checkbox" checked={form.publiee_terrain} onChange={e=>setForm({...form,publiee_terrain:e.target.checked})}/> Visible dans l’application terrain</label>
        <label>Instructions<textarea value={form.instructions_terrain} onChange={e=>setForm({...form,instructions_terrain:e.target.value})}/></label>
        <button className="relations-save"><Save/> Enregistrer</button>
      </form></section>}
      <section className="relations-card"><h2><Megaphone/> Campagnes</h2><div className="campaign-list">{campaigns.map(c=><article key={c.id}><div><strong>{c.nom_campagne}</strong><span>Visuel : {c.visuel_generique||'—'}</span><small>EDT : {c.no_edt||'—'} — {c.statut}</small></div><span className={c.publiee_terrain?'published':'draft'}>{c.publiee_terrain?<Eye size={15}/>:<EyeOff size={15}/>} {c.publiee_terrain?'Terrain':'Brouillon'}</span></article>)}</div></section>
    </div>
  </div>;
}
