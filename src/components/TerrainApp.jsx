import React, { useEffect, useMemo, useRef, useState } from 'react';
import '../features/terrain/terrain-issue-reporting-p0.css';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  RefreshCw,
  Save,
  Search,
  Trash2
} from 'lucide-react';
import {
  finalizeTerrainInstallation,
  finalizeTerrainIntervention,
  listTerrainIssueContexts,
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
  const [issueContexts, setIssueContexts] = useState([]);
  const [issuePhaseId, setIssuePhaseId] = useState('');
  const [issueContextsLoading, setIssueContextsLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);
  const submittingRef = useRef(false);
  const visualRequestRef = useRef(0);

  const rows = source === 'Infrastructure' ? infrastructures : stops;
  const idField = source === 'Infrastructure' ? 'support_id' : 'no_arret';
  const visual = visuals.find(item => String(item.id) === String(visualId));
  const requiresVisual = source === 'Infrastructure' && action === 'installation';

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function clearPhoto() {
    setFile(null);
    setPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function choosePhoto(event) {
    const nextFile = event.target.files?.[0] || null;
    setMessage('');
    setMessageType('info');
    if (!nextFile) return;
    if (!String(nextFile.type || '').startsWith('image/')) {
      clearPhoto();
      setMessageType('error');
      setMessage('Le fichier choisi doit être une image.');
      return;
    }
    try {
      setFile(nextFile);
      setPreview(URL.createObjectURL(nextFile));
    } catch (error) {
      console.error('Prévisualisation de la photo Terrain impossible', error);
      clearPhoto();
      setMessageType('error');
      setMessage('La photo ne peut pas être prévisualisée. Choisis une autre image.');
    }
  }

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
    const requestId = ++visualRequestRef.current;
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
      if (requestId !== visualRequestRef.current) return;
      setVisuals(result.visuals);
      setVisualDiagnostic(result.diagnostic);
    } catch (error) {
      if (requestId !== visualRequestRef.current) return;
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
      if (requestId === visualRequestRef.current) setVisualsLoading(false);
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
    setIssueContexts([]);
    setIssuePhaseId('');
    await Promise.all([loadVisuals(row), loadIssueContexts(row)]);
  }

  async function loadIssueContexts(row) {
    if (source !== 'Infrastructure') return;
    setIssueContextsLoading(true);
    try {
      const contexts = await listTerrainIssueContexts(row.support_id);
      setIssueContexts(contexts);
      setIssuePhaseId(contexts.length === 1 ? String(contexts[0].phase_id) : '');
    } catch (error) {
      console.error('Contexte EDT/phase Terrain indisponible', error);
      setIssueContexts([]);
      setIssuePhaseId('');
    } finally {
      setIssueContextsLoading(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (submittingRef.current) return;

    if (!selected) {
      setMessageType('error');
      setMessage('Sélectionne une fiche.');
      return;
    }

    if (requiresVisual && !visualId) {
      setMessageType('error');
      setMessage('Sélectionne un visuel compatible pour une installation.');
      return;
    }

    if (action === 'enjeu' && !issuePhaseId) {
      setMessageType('error');
      setMessage(issueContexts.length > 1
        ? 'Sélectionne le contexte EDT et la phase de cet enjeu.'
        : 'Aucun contexte EDT/phase déterministe n’est disponible pour cet enjeu.');
      return;
    }

    if (!file) {
      setMessageType('error');
      setMessage('Prends ou joins une photo avant de terminer.');
      return;
    }

    submittingRef.current = true;
    setBusy(true);
    setMessage('');
    setMessageType('info');

    try {
      const supportId = selected.support_id || selected.no_arret;
      const uploaded = await uploadTerrainPhoto(file, supportId, action, {
        campaignCode:visual?.campagne?.nom_campagne || selected.campagne_actuelle || selected.campagne_selon_visuel,
        edt:visual?.campagne?.no_edt || selected.edt_associe,
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
          phaseId: issuePhaseId,
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
        try {
          await rollbackUploadedPhoto(uploaded);
        } catch (rollbackError) {
          console.error('Nettoyage de la photo Terrain impossible', rollbackError);
        }
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
      setIssueContexts([]);
      setIssuePhaseId('');
      clearPhoto();
      setSelected(null);
      setQuery('');
      setVisualId('');
      setVisuals([]);
      setVisualDiagnostic(null);
    } catch (error) {
      console.error('Échec de l’intervention Terrain', error);
      setMessageType('error');
      setMessage(`Échec de l’intervention : ${error.message || error}`);
    } finally {
      submittingRef.current = false;
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
                visualRequestRef.current += 1;
                setSource(event.target.value);
                setSelected(null);
                setQuery('');
                setVisuals([]);
                setVisualDiagnostic(null);
                setVisualId('');
                setIssueContexts([]);
                setIssuePhaseId('');
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

        <form className="terrain-card terrain-intervention-form" onSubmit={submit} aria-busy={busy}>
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
            <>
              <label>
                Contexte EDT / phase
                <select
                  required
                  disabled={issueContextsLoading}
                  value={issuePhaseId}
                  onChange={event => setIssuePhaseId(event.target.value)}
                >
                  <option value="">
                    {issueContextsLoading ? 'Chargement du contexte…' : 'Sélectionner le contexte'}
                  </option>
                  {issueContexts.map(context => (
                    <option key={context.phase_id} value={context.phase_id}>
                      {context.edt_number} — {context.phase_name || context.phase_type}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Type d’enjeu
                <input
                  required
                  value={issueType}
                  onChange={event => setIssueType(event.target.value)}
                  placeholder="Ex. vitre brisée, affiche endommagée, structure..."
                />
              </label>
              {selected && <div className="terrain-issue-context" aria-label="Contexte de l’enjeu">
                <span>Support : <strong>{selected.support_id}</strong></span>
                <span>EDT : <strong>{issueContexts.find(item => String(item.phase_id) === issuePhaseId)?.edt_number || 'Non associé'}</strong></span>
                <span>Phase : <strong>{issueContexts.find(item => String(item.phase_id) === issuePhaseId)?.phase_name || 'Non associée'}</strong></span>
              </div>}
            </>
          )}

          <label>
            Commentaires
            <textarea
              value={comments}
              onChange={event => setComments(event.target.value)}
            />
          </label>

          <section className="terrain-photo-section" aria-labelledby="terrain-photo-title">
            <div>
              <strong id="terrain-photo-title">Photo de l’intervention</strong>
              <small>La date est enregistrée automatiquement lors de l’envoi; aucune date EXIF n’est inventée.</small>
            </div>
            <input ref={fileInputRef} className="terrain-file-input" type="file" accept="image/*" onChange={choosePhoto}/>
            {!preview ? <button type="button" className="terrain-photo" onClick={() => fileInputRef.current?.click()} disabled={busy}>
              <Camera/> Prendre ou joindre une photo
            </button> : <div className="terrain-photo-preview">
              <img className="terrain-preview" src={preview} alt="Aperçu de la photo sélectionnée"/>
              <span><strong>Photo prête à enregistrer</strong><small>{file?.name}</small></span>
              <div>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}><Camera/> Remplacer</button>
                <button type="button" className="danger" onClick={clearPhoto} disabled={busy}><Trash2/> Retirer</button>
              </div>
            </div>}
          </section>

          <div className="terrain-form-footer">
            {!file && <small className="terrain-photo-required">Une photo est requise pour terminer.</small>}
            <button type="submit" className="terrain-save" disabled={busy}>
              <Save/> {busy ? 'Enregistrement…' : 'Terminer'}
            </button>
            {message && <div className={`terrain-message ${messageType}`} role={messageType === 'error' ? 'alert' : 'status'} aria-live="polite">{message}</div>}
          </div>
        </form>
      </div>
    </div>
  );
}
