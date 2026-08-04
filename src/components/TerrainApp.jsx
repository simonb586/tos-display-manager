import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  RefreshCw,
  Save,
  Search
} from 'lucide-react';
import {
  finalizeTerrainInstallation,
  finalizeTerrainIntervention,
  rollbackUploadedPhoto,
  uploadTerrainPhoto
} from '../services/terrainService';
import {
  diagnoseCompatibleVisualsForSupport
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
  const [visualDiagnostic, setVisualDiagnostic] = useState(null);
  const [visualsLoading, setVisualsLoading] = useState(false);
  const [visualId, setVisualId] = useState('');
  const [action, setAction] = useState('installation');
  const [comments, setComments] = useState('');
  const [issueType, setIssueType] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [capturedAt, setCapturedAt] = useState('');
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

  async function loadVisuals(row) {
    if (source !== 'Infrastructure') {
      setVisuals([]);
      setVisualDiagnostic(null);
      return;
    }

    setVisualsLoading(true);
    setMessage('');
    setMessageType('info');

    try {
      const result = await diagnoseCompatibleVisualsForSupport(row);
      setVisuals(result.visuals);
      setVisualDiagnostic(result.diagnostic);
    } catch (error) {
      setVisuals([]);
      setVisualDiagnostic({
        supportId: String(row?.support_id || ''),
        supportFormat: String(
          row?.format_affichage || row?.format || row?.type_support || ''
        ),
        supportFormatKey: '',
        totalActiveVisuals: 0,
        matchingFormat: 0,
        publishedCampaigns: 0,
        activeCampaigns: 0,
        eligibleCount: 0,
        availableFormats: [],
        reason: error.message || 'Diagnostic des visuels impossible.'
      });
      setMessageType('error');
      setMessage(error.message || 'Diagnostic des visuels impossible.');
    } finally {
      setVisualsLoading(false);
    }
  }

  async function choose(row) {
    setSelected(row);
    setQuery(String(row[idField] || ''));
    setVisualId('');
    setVisuals([]);
    setVisualDiagnostic(null);
    setMessage('');
    setMessageType('info');
    await loadVisuals(row);
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
      const uploaded = await uploadTerrainPhoto(file, supportId, action, {
        campaignCode:visual?.campagne?.nom_campagne || selected.campagne_actuelle || selected.campagne_selon_visuel,
        edt:visual?.campagne?.no_edt || selected.edt_associe,
        capturedAt:capturedAt || undefined,
        source:'terrain'
      });

      try { if (source === 'Infrastructure' && action === 'installation') {
        const result = await finalizeTerrainInstallation({
          supportId: selected.support_id,
          visualId,
          fileName: uploaded.normalizedFilename,
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
          throw new Error('La stabilisation v0.12.8 exige une Infrastructure pour cette opération.');
        }

        const result = await finalizeTerrainIntervention({
          supportId: selected.support_id,
          action,
          issueType,
          comments,
          fileName: uploaded.normalizedFilename,
          storagePath: uploaded.path,
          photoUrl: uploaded.publicUrl,
          userEmail: session?.user?.email || ''
        });

        if (!result?.ok || !result?.reference) {
          throw new Error('Le serveur n’a pas confirmé toutes les écritures.');
        }
      }} catch (error) {
        await rollbackUploadedPhoto(uploaded);
        throw error;
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
      setCapturedAt('');
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
                setVisualDiagnostic(null);
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
                  disabled={visualsLoading}
                  value={visualId}
                  onChange={event => setVisualId(event.target.value)}
                >
                  <option value="">
                    {visualsLoading ? 'Chargement des visuels…' : 'Sélectionner'}
                  </option>
                  {visuals.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.nom_visuel}
                      {item.phase ? ` — ${item.phase}` : ''}
                      {` — ${item.format_support}`}
                    </option>
                  ))}
                </select>
              </label>

              {!visualsLoading && !visuals.length && visualDiagnostic && (
                <div className="terrain-visual-diagnostic" role="alert">
                  <div className="terrain-visual-diagnostic-title">
                    <AlertTriangle size={18}/>
                    <strong>Aucun visuel compatible</strong>
                  </div>
                  <p>{visualDiagnostic.reason}</p>
                  <dl>
                    <div><dt>Support</dt><dd>{visualDiagnostic.supportId || '—'}</dd></div>
                    <div><dt>Format détecté</dt><dd>{visualDiagnostic.supportFormat || 'Non défini'}</dd></div>
                    <div><dt>Clé normalisée</dt><dd>{visualDiagnostic.supportFormatKey || 'Indisponible'}</dd></div>
                    <div><dt>Visuels actifs</dt><dd>{visualDiagnostic.totalActiveVisuals}</dd></div>
                    <div><dt>Formats compatibles</dt><dd>{visualDiagnostic.matchingFormat}</dd></div>
                    <div><dt>Campagnes publiées et actives</dt><dd>{visualDiagnostic.activeCampaigns}</dd></div>
                  </dl>
                  {visualDiagnostic.availableFormats.length > 0 && (
                    <details>
                      <summary>Formats actifs disponibles</summary>
                      <p>{visualDiagnostic.availableFormats.join(' · ')}</p>
                    </details>
                  )}
                  <button
                    type="button"
                    disabled={visualsLoading}
                    onClick={() => loadVisuals(selected)}
                  >
                    <RefreshCw size={16}/> Réessayer
                  </button>
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
            <span>Date de prise</span>
            <input type="datetime-local" value={capturedAt} onChange={event=>setCapturedAt(event.target.value)}/>
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
