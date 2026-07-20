import React, { useMemo, useState } from 'react';
import { Camera, CheckCircle2, Save, Search } from 'lucide-react';
import {
  finalizeTerrainInstallation,
  finalizeTerrainIntervention,
  uploadTerrainPhoto
} from '../services/terrainService';
import {
  listCompatibleVisualsForSupport
} from '../services/campaignVisualService';

const norm = value => String(value ?? '').toLowerCase();

export default function TerrainApp({ dataStore, role, session }) {
  const allowed = ['Administrateur', 'Coordonnateur', 'Installateur'].includes(role);
  const infrastructures = dataStore?.Infrastructures?.rows || [];
  const stops = dataStore?.['Liste des arrêts']?.rows || [];

  const [source, setSource] = useState('Infrastructure');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [visuals, setVisuals] = useState([]);
  const [visualId, setVisualId] = useState('');
  const [action, setAction] = useState('installation');
  const [comments, setComments] = useState('');
  const [issueType, setIssueType] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [busy, setBusy] = useState(false);

  const rows = source === 'Infrastructure' ? infrastructures : stops;
  const idField = source === 'Infrastructure' ? 'support_id' : 'no_arret';
  const visual = visuals.find(item => String(item.id) === String(visualId));
  const requiresVisual = source === 'Infrastructure' && action === 'installation';

  const suggestions = useMemo(() => (
    query
      ? rows
          .filter(row =>
            norm(row[idField]).includes(norm(query)) ||
            norm(row.emplacement_visibilite || row.site).includes(norm(query))
          )
          .slice(0, 12)
      : []
  ), [query, rows, idField]);

  async function choose(row) {
    setSelected(row);
    setQuery(String(row[idField] || ''));
    setVisualId('');
    setMessage('');
    setMessageType('info');

    try {
      setVisuals(
        source === 'Infrastructure'
          ? await listCompatibleVisualsForSupport(row)
          : []
      );
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function submit(event) {
    event.preventDefault();

    if (!selected) {
      setMessage('Sélectionne une fiche.');
      return;
    }

    if (requiresVisual && !visualId) {
      setMessage('Sélectionne un visuel compatible pour une installation.');
      return;
    }

    if (!file) {
      setMessage('Prends ou joins une photo avant de terminer.');
      return;
    }

    setBusy(true);
    setMessage('');
    setMessageType('info');

    try {
      const supportId = selected.support_id || selected.no_arret;
      const uploaded = await uploadTerrainPhoto(file, supportId, action);

      if (source === 'Infrastructure' && action === 'installation') {
        const result = await finalizeTerrainInstallation({
          supportId: selected.support_id,
          visualId,
          fileName: file.name || `${selected.support_id}-${action}.jpg`,
          storagePath: uploaded.path,
          photoUrl: uploaded.publicUrl,
          userEmail: session?.user?.email || '',
          comments
        });
        if (!result?.ok || !result?.reference) throw new Error('Le serveur n’a pas confirmé la mise à jour complète.');
        setMessageType('success');
        setMessage(`Installation confirmée. Infrastructure, historique et photo mis à jour. Référence : ${result.reference}`);
      } else {
        if (source !== 'Infrastructure') {
          throw new Error('La stabilisation v0.12.7.3 exige une Infrastructure pour cette opération.');
        }

        const result = await finalizeTerrainIntervention({
          supportId: selected.support_id,
          action,
          issueType,
          comments,
          fileName: file.name || `${selected.support_id}-${action}.jpg`,
          storagePath: uploaded.path,
          photoUrl: uploaded.publicUrl,
          userEmail: session?.user?.email || ''
        });

        if (!result?.ok || !result?.reference) {
          throw new Error('Le serveur n’a pas confirmé toutes les écritures.');
        }
      }

      if (!(source === 'Infrastructure' && action === 'installation')) {
        const explanation = action === 'inspection'
          ? 'Photo validée et ajoutée à la galerie, sans remplacer la photo principale.'
          : 'Photo ajoutée à la galerie en attente de validation, sans remplacer le visuel actuel.';
        setMessageType('success');
        setMessage(`Intervention terminée. ${explanation}`);
      }
      setComments('');
      setIssueType('');
      setFile(null);
      setPreview('');
    } catch (error) {
      setMessageType('error');
      setMessage(`Échec de l’intervention : ${error.message || error}`);
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) return <div className="terrain-page">Accès refusé.</div>;

  return (
    <div className="terrain-page">
      <header className="terrain-hero">
        <h1>Application terrain</h1>
        <p>Les photos d’installation s’affichent automatiquement dans Infrastructure.</p>
      </header>

      <div className="terrain-layout">
        <section className="terrain-card">
          <h2><Search/> Sélectionner une fiche</h2>

          <div className="terrain-inline">
            <select
              value={source}
              onChange={event => {
                setSource(event.target.value);
                setSelected(null);
                setQuery('');
                setVisuals([]);
                setVisualId('');
              }}
            >
              <option>Infrastructure</option>
              <option>Arrêt</option>
            </select>
            <input value={query} onChange={event => setQuery(event.target.value)}/>
          </div>

          <div className="terrain-suggestions">
            {suggestions.map((row, index) => (
              <button key={index} onClick={() => choose(row)}>
                <b>{row[idField]}</b>
                <span>{row.emplacement_visibilite || row.site}</span>
              </button>
            ))}
          </div>

          {selected && (
            <article className="terrain-selected">
              <CheckCircle2/>
              <div>
                <b>{selected[idField]}</b>
                <span>{selected.emplacement_visibilite || selected.site}</span>
                <small>
                  Format : {selected.format_affichage || selected.format || selected.type_support || 'Non défini'}
                </small>
              </div>
            </article>
          )}
        </section>

        <form className="terrain-card" onSubmit={submit}>
          <h2><Camera/> Intervention</h2>

          <label>
            Action photo
            <select
              value={action}
              onChange={event => {
                setAction(event.target.value);
                if (event.target.value !== 'installation') setVisualId('');
              }}
            >
              <option value="installation">Installation</option>
              <option value="inspection">Inspection</option>
              <option value="enjeu">Enjeu</option>
              <option value="photo">Autre photo</option>
            </select>
          </label>

          {requiresVisual && selected && (
            <>
              <label>
                Visuel compatible
                <select
                  required
                  value={visualId}
                  onChange={event => setVisualId(event.target.value)}
                >
                  <option value="">Sélectionner</option>
                  {visuals.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.nom_visuel}
                      {item.phase ? ` — ${item.phase}` : ''}
                      {` — ${item.format_support}`}
                    </option>
                  ))}
                </select>
              </label>

              {!visuals.length && (
                <div className="terrain-message error">
                  Aucun visuel compatible.
                </div>
              )}
            </>
          )}

          {visual && (
            <div className="terrain-campaign-summary">
              <b>{visual.nom_visuel}</b>
              <span>Campagne : {visual.campagne?.nom_campagne}</span>
              <span>Phase : {visual.phase || '—'}</span>
              <span>EDT : {visual.campagne?.no_edt || '—'}</span>
            </div>
          )}


          {action === 'enjeu' && (
            <label>
              Type d’enjeu
              <input
                required
                value={issueType}
                onChange={event => setIssueType(event.target.value)}
                placeholder="Ex. vitre brisée, affiche endommagée, structure..."
              />
            </label>
          )}

          <label>
            Commentaires
            <textarea
              value={comments}
              onChange={event => setComments(event.target.value)}
            />
          </label>

          <label className="terrain-photo">
            <Camera/> Prendre ou joindre une photo
            <input
              required
              type="file"
              accept="image/*"
              capture="environment"
              onChange={event => {
                const nextFile = event.target.files?.[0] || null;
                setFile(nextFile);
                setPreview(nextFile ? URL.createObjectURL(nextFile) : '');
              }}
            />
          </label>

          {preview && <img className="terrain-preview" src={preview} alt="Aperçu"/>}

          <button className="terrain-save" disabled={busy}>
            <Save/> {busy ? 'Enregistrement...' : 'Terminer'}
          </button>

          {message && <div className={`terrain-message ${messageType}`}>{message}</div>}
        </form>
      </div>
    </div>
  );
}
