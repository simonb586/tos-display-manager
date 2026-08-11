import React, { useEffect, useState } from 'react';
import { Archive, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { listMasterCampaigns } from '../services/campaignService';
import { BUSINESS_CONTEXT, isBusinessContext } from '../lib/businessContext';
import {
  deleteOrArchiveCampaignVisual,
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
  instructions_terrain: ''
};

export default function CampaignVisualManager({ role, businessContext = BUSINESS_CONTEXT.MARKETING }) {
  const [campaigns, setCampaigns] = useState([]);
  const [visuals, setVisuals] = useState([]);
  const [form, setForm] = useState(empty);
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const canManage = ['Administrateur', 'Coordonnateur'].includes(role);

  async function reload() {
    try {
      const [nextCampaigns, nextVisuals] = await Promise.all([
        listMasterCampaigns(false, businessContext),
        listCampaignVisuals()
      ]);
      setCampaigns(nextCampaigns);
      setVisuals(nextVisuals.filter(visual => isBusinessContext(visual.campagne, businessContext)));
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    reload();
  }, [businessContext]);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);

    try {
      await saveCampaignVisual(form);
      setMessage(form.id ? 'Visuel modifié.' : 'Visuel enregistré.');
      setForm(empty);
      setFormOpen(false);
      await reload();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeVisual(visual) {
    if (busy || !window.confirm(
      `Supprimer ou archiver le visuel « ${visual.nom_visuel} »? L’historique déjà utilisé sera protégé.`
    )) return;

    setBusy(true);

    try {
      const result = await deleteOrArchiveCampaignVisual(visual.id);
      setMessage(
        result?.action === 'archived'
          ? 'Le visuel était déjà utilisé et a été archivé.'
          : 'Visuel supprimé.'
      );
      if (form.id === visual.id) setForm(empty);
      await reload();
    } catch (error) {
      setMessage(error.message);
    } finally {
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
      instructions_terrain: visual.instructions_terrain || ''
    });
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="v74-page">
      <header className="v74-hero">
        <div><h1>Campagne — Visuels et formats</h1>
        <p>Une campagne peut contenir plusieurs phases, visuels, formats et EDT.</p></div>
        {canManage && <button type="button" className="business-primary-action" onClick={() => { setForm(empty); setFormOpen(true); }}><Plus/> Créer un visuel</button>}
      </header>

      {message && <div className="v74-msg">{message}</div>}

      <div className={formOpen ? 'v74-grid' : 'v74-grid v74-list-only'}>
        {canManage && formOpen && (
          <section className="v74-card">
            <h2>{form.id ? <Pencil/> : <Plus/>} {form.id ? 'Modifier le visuel' : 'Ajouter un visuel'}</h2>

            <form className="v74-form" onSubmit={submit}>
              <label>
                Campagne
                <select
                  required
                  value={form.campagne_id}
                  onChange={event => setForm({ ...form, campagne_id: event.target.value })}
                >
                  <option value="">Sélectionner</option>
                  {campaigns.map(campaign => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.nom_campagne}
                    </option>
                  ))}
                </select>
              </label>

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

                {form.id && (
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => { setForm(empty); setFormOpen(false); }}
                  >
                    <X/> Annuler
                  </button>
                )}
              </div>
            </form>
          </section>
        )}

        <section className="v74-card">
          <h2>Visuels configurés</h2>

          {visuals.map(visual => (
            <article className="v74-row visual-managed-row" key={visual.id}>
              <div>
                <b>{visual.nom_visuel}</b>
                <span>{visual.campagne?.nom_campagne}</span>
                <small>
                  {visual.phase || 'Sans phase'} — {visual.format_support} {visual.is_out_of_frame ? '— Hors-Cadre' : ''}
                </small>
              </div>

              <em>{visual.actif ? 'Actif' : 'Archivé / inactif'}</em>

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
