import VisualReferences from './VisualReferences';
import React, { useEffect, useRef, useState } from 'react';
import { Archive, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { listMasterCampaigns } from '../services/campaignService';
import { BUSINESS_CONTEXT, isBusinessContext } from '../lib/businessContext';
import { clearFormDraft, readFormDraft, writeFormDraft } from '../lib/formDraft';
import {
  deleteOrArchiveCampaignVisual,
  listEdtPhasesForCampaign,
  listCampaignVisuals,
  saveCampaignVisual
} from '../services/campaignVisualService';

const empty = {
  campagne_id: '',
  phase: '',
  nom_visuel: '',
  code_visuel: '',
  format_support: '',
  quantite_prevue: 0,
  actif: true,
  is_out_of_frame: false,
  instructions_terrain: '',
  edt_associations: [],
  edt_phase_id: ''
};

export default function CampaignVisualManager({ role, businessContext = BUSINESS_CONTEXT.MARKETING, campaignId=null, previewMode=false }) {
  const draftScope=campaignId ? businessContext+':'+campaignId : businessContext;
  const emptyForCampaign={...empty,campagne_id:campaignId||''};
  const initialDraft = readFormDraft('visual', draftScope, { form: {...empty,campagne_id:campaignId||''}, formOpen: false });
  const [campaigns, setCampaigns] = useState([]);
  const [visuals, setVisuals] = useState([]);
  const [form, setForm] = useState(initialDraft.form);
  const [formOpen, setFormOpen] = useState(Boolean(initialDraft.formOpen));
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const mutationActive = useRef(false);
  const [edts, setEdts] = useState([]);
  const [edtSearch,setEdtSearch]=useState('');
  const [campaignSearch,setCampaignSearch]=useState(''),[visualSearch,setVisualSearch]=useState('');
  const [hydratedContext, setHydratedContext] = useState(businessContext);

  const canManage = !previewMode&&['Administrateur', 'Coordonnateur'].includes(role);

  async function reload() {
    try {
      const [nextCampaigns, nextVisuals] = await Promise.all([
        listMasterCampaigns(false, businessContext),
        listCampaignVisuals()
      ]);
      setCampaigns(campaignId?nextCampaigns.filter(c=>String(c.id)===String(campaignId)):nextCampaigns);
      setVisuals(nextVisuals.filter(visual => isBusinessContext(visual.campagne, businessContext)&&(!campaignId||String(visual.campagne_id)===String(campaignId))));
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    reload();
  }, [businessContext,campaignId]);

  useEffect(() => {
    setHydratedContext(null);
    const draft = readFormDraft('visual', draftScope, { form: emptyForCampaign, formOpen: false });
    setForm(draft.form);
    setFormOpen(Boolean(draft.formOpen));
    setHydratedContext(businessContext);
  }, [businessContext,campaignId]);

  useEffect(() => {
    if (hydratedContext !== businessContext) return;
    if (formOpen) writeFormDraft('visual', draftScope, { form, formOpen });
    else clearFormDraft('visual', draftScope);
  }, [businessContext, form, formOpen, hydratedContext]);

  useEffect(() => {
    let live=true;setEdts([]);
    listEdtPhasesForCampaign(form.campagne_id).then(rows=>{if(live)setEdts(rows);}).catch(error => {if(live)setMessage(error.message);});
    return ()=>{live=false;};
  }, [form.campagne_id]);

  async function submit(event) {
    event.preventDefault();
    if (mutationActive.current) return;
    mutationActive.current = true;
    setBusy(true);

    try {
      await saveCampaignVisual({...form,edt_associations:role==='Administrateur'?form.edt_associations:undefined});
      setMessage(form.id ? 'Visuel modifié.' : 'Visuel enregistré.');
      clearFormDraft('visual', draftScope);
      setForm(emptyForCampaign);
      setFormOpen(false);
      await reload();
    } catch (error) {
      setMessage(error.message);
    } finally {
      mutationActive.current = false;
      setBusy(false);
    }
  }

  async function removeVisual(visual) {
    if (mutationActive.current || !window.confirm(
      `Supprimer ou archiver le visuel « ${visual.nom_visuel} »? L’historique déjà utilisé sera protégé.`
    )) return;

    mutationActive.current = true;
    setBusy(true);

    try {
      const result = await deleteOrArchiveCampaignVisual(visual.id);
      setMessage(
        result?.action === 'archived'
          ? 'Le visuel était déjà utilisé et a été archivé.'
          : 'Visuel supprimé.'
      );
      if (form.id === visual.id) setForm(emptyForCampaign);
      await reload();
    } catch (error) {
      setMessage(error.message);
    } finally {
      mutationActive.current = false;
      setBusy(false);
    }
  }

  function editVisual(visual) {
    setForm({
      id: visual.id,
      campagne_id: visual.campagne_id || '',
      phase: visual.phase || '',
      nom_visuel: visual.nom_visuel || '',
      code_visuel: visual.code_visuel || '',
      format_support: visual.format_support || '',
      quantite_prevue: visual.quantite_prevue || 0,
      actif: visual.actif !== false,
      is_out_of_frame: visual.is_out_of_frame === true,
      instructions_terrain: visual.instructions_terrain || '',
      edt_phase_id: visual.edt_phase_id || '',
      edt_associations: role==='Administrateur'?(visual.edt_associations||[]):undefined
    });
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function discardDraft() {
    clearFormDraft('visual', draftScope);
    setForm(emptyForCampaign);
    setFormOpen(false);
  }

  return (
    <div className="v74-page">
      <header className="v74-hero">
        <div><h1>Campagne — Visuels et formats</h1>
        <p>Une campagne peut contenir plusieurs phases, visuels, formats et EDT.</p></div>
        {canManage && <button type="button" className="business-primary-action" onClick={() => { setForm(emptyForCampaign); setFormOpen(true); }}><Plus/> Créer un visuel</button>}
      </header>

      {message && <div className="v74-msg">{message}</div>}

      <div className={formOpen ? 'v74-grid' : 'v74-grid v74-list-only'}>
        {canManage && formOpen && (
          <section className="v74-card">
            <h2>{form.id ? <Pencil/> : <Plus/>} {form.id ? 'Modifier le visuel' : 'Ajouter un visuel'}</h2>

            <form className="v74-form" onSubmit={submit}>
              <label>Rechercher une campagne<input value={campaignSearch} onChange={e=>setCampaignSearch(e.target.value)}/></label>
              <label>
                Campagne
                <select
                  required
                  value={form.campagne_id}
                  onChange={event => setForm({ ...form, campagne_id: event.target.value, edt_phase_id: '', edt_associations: role==='Administrateur'?[]:undefined })}
                >
                  <option value="">Sélectionner</option>
                  {campaigns.filter(campaign=>String(campaign.id)===String(form.campagne_id)||[campaign.nom_campagne,campaign.code_campagne].join(' ').toLocaleLowerCase('fr').includes(campaignSearch.toLocaleLowerCase('fr'))).map(campaign => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.nom_campagne}
                    </option>
                  ))}
                </select>
              </label>

              <fieldset disabled={role!=='Administrateur'}><legend>EDT associés</legend><label>Rechercher un EDT<input value={edtSearch} onChange={e=>setEdtSearch(e.target.value)} placeholder="Numéro EDT"/></label>
                {(form.edt_associations||[]).map((link,index)=><div key={index} className="v74-card">
                  <label>EDT<select required value={link.phase_id||''} onChange={e=>setForm({...form,edt_associations:form.edt_associations.map((a,i)=>i===index?{...a,phase_id:e.target.value}:a)})}><option value="">Sélectionner</option>{edts.filter(p=>p.phase_type==='installation'&&(String(p.id)===String(link.phase_id)||String(p.edt?.no_edt).toLocaleLowerCase('fr').includes(edtSearch.toLocaleLowerCase('fr')))).map(p=><option key={p.id} value={p.id}>{p.edt?.no_edt}{p.edt?.archived_at?' — archivé (historique)':''}</option>)}</select></label>
                  <label>Date début<input type="date" value={link.date_debut||''} onChange={e=>setForm({...form,edt_associations:form.edt_associations.map((a,i)=>i===index?{...a,date_debut:e.target.value}:a)})}/></label>
                  <label>Date fin<input type="date" min={link.date_debut||undefined} value={link.date_fin||''} onChange={e=>setForm({...form,edt_associations:form.edt_associations.map((a,i)=>i===index?{...a,date_fin:e.target.value}:a)})}/></label>
                  <button type="button" onClick={()=>setForm({...form,edt_associations:form.edt_associations.filter((_,i)=>i!==index)})}>Retirer cette association</button>
                </div>)}
                <button type="button" onClick={()=>setForm({...form,edt_associations:[...(form.edt_associations||[]),{phase_id:'',date_debut:'',date_fin:''}]})}>+ Ajouter un EDT</button>
              </fieldset>

              <label>
                Phase
                <input
                  value={form.phase}
                  onChange={event => setForm({ ...form, phase: event.target.value })}
                />
              </label>

              <label>
                Nom du visuel
                <input
                  required
                  value={form.nom_visuel}
                  onChange={event => setForm({ ...form, nom_visuel: event.target.value })}
                />
              </label>

              <label>
                Code
                <input
                  value={form.code_visuel}
                  onChange={event => setForm({ ...form, code_visuel: event.target.value })}
                />
              </label>

              <label>
                Format exact du support
                <input
                  required
                  value={form.format_support}
                  onChange={event => setForm({ ...form, format_support: event.target.value })}
                />
              </label>

              <label>
                Quantité prévue
                <input
                  type="number"
                  value={form.quantite_prevue}
                  onChange={event => setForm({ ...form, quantite_prevue: event.target.value })}
                />
              </label>

              <label>
                Instructions
                <textarea
                  value={form.instructions_terrain}
                  onChange={event => setForm({ ...form, instructions_terrain: event.target.value })}
                />
              </label>

              <label className="visual-active-check">
                <input
                  type="checkbox"
                  checked={form.actif !== false}
                  onChange={event => setForm({ ...form, actif: event.target.checked })}
                />
                Visuel actif
              </label>

              <label className="visual-active-check">
                <input type="checkbox" checked={form.is_out_of_frame === true}
                  onChange={event => setForm({ ...form, is_out_of_frame: event.target.checked })}/>
                <span><b>Hors-Cadre</b><small>Permet d’utiliser ce visuel sans limiter les supports selon son format.</small></span>
              </label>

              <div className="visual-form-actions">
                <button disabled={busy}>
                  <Save/> {form.id ? 'Enregistrer les modifications' : 'Enregistrer'}
                </button>

                <button type="button" className="secondary" disabled={busy} onClick={discardDraft}>
                  <X/> Annuler
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="v74-card">
          <h2>Visuels configurés</h2>
          <label>Rechercher un visuel<input value={visualSearch} onChange={e=>setVisualSearch(e.target.value)} placeholder="Campagne, visuel, format ou EDT"/></label>

          {visuals.filter(visual=>[visual.nom_visuel,visual.format_support,visual.campagne?.nom_campagne,...(visual.edt_associations||[]).map(a=>a.edt?.no_edt)].join(' ').toLocaleLowerCase('fr').includes(visualSearch.toLocaleLowerCase('fr'))).map(visual => (
            <article className="v74-row visual-managed-row" key={visual.id}>
              <div>
                <b>{visual.nom_visuel}</b>
                <span>{visual.campagne?.nom_campagne}</span>
                <small>
                  {visual.phase || 'Sans phase'} — {visual.format_support} {visual.is_out_of_frame ? '— Hors-Cadre' : ''}
                </small>
                {visual.edt_associations?.map(link=><small key={link.edt_id}>{link.edt?.no_edt} — {link.date_debut||'Début non défini'} → {link.date_fin||'Fin non définie'}</small>)}
              </div>

              <VisualReferences visual={visual} canManage={canManage} onChanged={reload}/><em>{visual.actif ? 'Actif' : 'Archivé / inactif'}</em>

              {canManage && (
                <div className="visual-managed-actions">
                  <button disabled={busy} onClick={() => editVisual(visual)}>
                    <Pencil size={15}/> Modifier
                  </button>
                  <button
                    className="danger"
                    disabled={busy}
                    onClick={() => removeVisual(visual)}
                  >
                    {visual.actif ? <Trash2 size={15}/> : <Archive size={15}/>}
                    Supprimer
                  </button>
                </div>
              )}
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
