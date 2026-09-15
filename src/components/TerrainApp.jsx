import React, { useEffect, useMemo, useRef, useState } from 'react';
import { terrainErrorMessage } from '../lib/terrainErrors';
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
  const [withoutEdt,setWithoutEdt]=useState(false);
  const [installationPhase,setInstallationPhase]=useState('');
  const [comments, setComments] = useState('');
  const [issueType, setIssueType] = useState('');
  const [visualError, setVisualError] = useState('');
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
    setVisualError('');
    setMessage('');
    setMessageType('info');

    try {
      const result = await diagnoseCompatibleVisualsForSupport(row);
      if (requestId !== visualRequestRef.current) return;
      setVisuals(result.visuals);
      setVisualDiagnostic(result.diagnostic);
    } catch (error) {
      if (requestId !== visualRequestRef.current) return;
      console.error('Lecture des visuels Terrain impossible', error);
      setVisuals([]);
      setVisualDiagnostic(null);
      setVisualError(terrainErrorMessage(error, 'read'));
    } finally {
      if (requestId === visualRequestRef.current) setVisualsLoading(false);
    }
  }

  async function choose(row) {
    ++visualRequestRef.current;
    setVisualsLoading(false);
    setVisualError('');
    setSelected(row);
    setWithoutEdt(false);setInstallationPhase('');
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

    if (requiresVisual && !withoutEdt && !installationPhase) {
      setMessageType('error');setMessage('Sélectionne un EDT pour cette installation.');return;
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
        edt:action === 'installation' && !withoutEdt ? visuals.flatMap(v=>v.edt_associations||[]).find(a=>String(a.phase_id)===installationPhase)?.edt_number : undefined,
        source:'terrain'
      });

      try { if (source === 'Infrastructure' && action === 'installation') {
        const result = await finalizeTerrainInstallation({
          supportId: selected.support_id,
          visualId,
          phaseId:withoutEdt?null:installationPhase,
          withoutEdt,
          fileName: uploaded.normalizedFilename,
          storagePath: uploaded.path,
          photoUrl: uploaded.storageReference,
          userEmail: session?.user?.email || '',
          comments
        });
        if (!result?.ok || !result?.reference) throw new Error('Le serveur n’a pas confirmé la mise à jour complète.');
        setMessageType('success');
        setMessage(`Installation confirmée. La nouvelle photo est principale ; les précédentes restent dans la galerie. Référence : ${result.reference}`);
      } else {
        if (source !== 'Infrastructure') {
          throw new Error('La stabilisation v0.12.8 exige une Infrastructure pour cette opération.');
        }

        const result = await finalizeTerrainIntervention({
          supportId: selected.support_id,
          phaseId: null,
          action,
          issueType,
          comments,
          fileName: uploaded.normalizedFilename,
          storagePath: uploaded.path,
          photoUrl: uploaded.storageReference,
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
        const explanation = action === 'retrait'
          ? 'Retrait confirmé. Le support est sans affiche ; les photos restent dans la galerie.'
          : action === 'inspection'
          ? 'Photo validée et ajoutée à la galerie.'
          : 'Photo ajoutée à la galerie en attente de validation, sans remplacer le visuel actuel.';
        setMessageType('success');
        setMessage(`Intervention terminée. ${explanation}`);
      }
      setComments('');
      setIssueType('');

      clearPhoto();
      setSelected(null);
      setQuery('');
      setVisualId('');
      setVisuals([]);
      setVisualDiagnostic(null);
    } catch (error) {
      console.error('Échec de l’intervention Terrain', error);
      setMessageType('error');
      setMessage(terrainErrorMessage(error));
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


                setVisualsLoading(false);

                setVisualError('');
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
              <option value="retrait">Retrait — support sans affiche</option>
              <option value="inspection">Inspection</option>
              <option value="enjeu">Enjeu</option>
              <option value="photo">Autre photo</option>
            </select>
          </label>

          {action === 'installation' && <p>La nouvelle photo remplacera la principale. Les anciennes resteront dans la galerie ; aucun retrait séparé n’est nécessaire.</p>}
          {action === 'retrait' && <p>À utiliser seulement si aucune nouvelle affiche n’est installée. Joins une photo du support après le retrait ; les photos précédentes seront conservées.</p>}


          {requiresVisual && <label><input type="checkbox" checked={withoutEdt} onChange={e=>{setWithoutEdt(e.target.checked);setInstallationPhase('');setVisualId('');}}/> Installation sans EDT</label>}
          {requiresVisual && selected && !withoutEdt && <label>EDT<select required value={installationPhase} onChange={e=>{setInstallationPhase(e.target.value);setVisualId('');}}><option value="">Sélectionner un EDT</option>{[...new Map(visuals.flatMap(v=>v.edt_associations||[]).map(a=>[String(a.phase_id),a])).values()].map(a=><option key={a.phase_id} value={a.phase_id}>{a.edt_number}</option>)}</select></label>}
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
                  {visuals.filter(item=>withoutEdt||(item.edt_associations||[]).some(a=>String(a.phase_id)===installationPhase)).map(item => (
                    <option key={item.id} value={item.id}>
                      {item.nom_visuel} — {item.campagne?.nom_campagne} — {item.format_support} — {item.business_context === 'operational_communication' ? 'Communication opérationnelle' : 'Marketing'}{item.is_out_of_frame ? ' — Hors-Cadre' : ''}
                    </option>
                  ))}
                </select>
              </label>

              {visualError && (
                <div className="terrain-message error" role="alert">
                  <p>{visualError}</p>
                  <button type="button" disabled={visualsLoading} onClick={() => loadVisuals(selected)}>
                    <RefreshCw size={16}/> Réessayer
                  </button>
                </div>
              )}
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
              <span>Contexte : {visual.business_context === 'operational_communication' ? 'Communication opérationnelle' : 'Marketing'}</span>
              <span>Phase : {visual.phase || '—'}</span>
              <span>EDT : {withoutEdt?'Installation sans EDT':visual.edt_associations?.find(a=>String(a.phase_id)===installationPhase)?.edt_number}</span>
            </div>
          )}


          {action === 'enjeu' && (
            <>
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
