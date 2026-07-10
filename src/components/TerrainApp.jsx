import React, { useEffect, useMemo, useState } from 'react';
import { Camera, CheckCircle2, CloudOff, LocateFixed, MapPin, RefreshCw, Save, Search, Wifi, WifiOff } from 'lucide-react';
import { getOfflineQueue, saveInspection, syncOfflineQueue } from '../services/terrainService';

const normalize = (v) => String(v ?? '').trim().toLowerCase();

export default function TerrainApp({ dataStore, role, session }) {
  const allowed = ['Administrateur', 'Coordonnateur', 'Installateur'].includes(role);
  const infrastructures = dataStore?.['Infrastructures']?.rows || [];
  const arrets = dataStore?.['Liste des arrêts']?.rows || [];

  const [source, setSource] = useState('Infrastructure');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState('inspection');
  const [flags, setFlags] = useState({
    affiche_presente: true,
    affiche_conforme: true,
    support_endommage: false,
    nettoyage_effectue: false,
    remplacement_effectue: false
  });
  const [comments, setComments] = useState('');
  const [gps, setGps] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [queueCount, setQueueCount] = useState(getOfflineQueue().length);

  useEffect(() => {
    const update = () => setQueueCount(getOfflineQueue().length);
    window.addEventListener('tos-terrain-queue-change', update);
    window.addEventListener('online', update);
    return () => {
      window.removeEventListener('tos-terrain-queue-change', update);
      window.removeEventListener('online', update);
    };
  }, []);

  const rows = source === 'Infrastructure' ? infrastructures : arrets;
  const idField = source === 'Infrastructure' ? 'support_id' : 'no_arret';

  const suggestions = useMemo(() => {
    if (!query) return [];
    const q = normalize(query);
    return rows.filter(row => {
      const id = normalize(row[idField]);
      const label = normalize(row.emplacement_visibilite || row.site || '');
      return id.includes(q) || label.includes(q);
    }).slice(0, 12);
  }, [rows, query, idField]);

  function choose(row) {
    setSelected(row);
    setQuery(String(row[idField] || ''));
    setMessage('');
  }

  function requestGps() {
    setGpsStatus('Recherche GPS...');
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGps({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          precision_m: pos.coords.accuracy
        });
        setGpsStatus('Position obtenue');
      },
      err => setGpsStatus(`GPS indisponible : ${err.message}`),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }

  function handleFile(e) {
    const chosen = e.target.files?.[0] || null;
    setFile(chosen);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(chosen ? URL.createObjectURL(chosen) : '');
  }

  async function submit(e) {
    e.preventDefault();
    if (!selected) {
      setMessage('Sélectionne d’abord une infrastructure ou un arrêt.');
      return;
    }

    setStatus('saving');
    setMessage('');

    const payload = {
      support_id: source === 'Infrastructure' ? String(selected.support_id || '') : null,
      no_arret: source === 'Arrêt' ? String(selected.no_arret || '') : null,
      source_type: source,
      emplacement: selected.emplacement_visibilite || selected.site || '',
      action,
      ...flags,
      commentaires: comments,
      latitude: gps?.latitude || null,
      longitude: gps?.longitude || null,
      precision_gps_m: gps?.precision_m || null,
      utilisateur_courriel: session?.user?.email || '',
      statut: 'Terminée'
    };

    try {
      const result = await saveInspection(payload, file);
      setMessage(result.queued
        ? 'Inspection enregistrée hors ligne. Elle sera synchronisée au retour du réseau.'
        : 'Inspection enregistrée dans Supabase.');
      setStatus('done');
      setComments('');
      setFile(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview('');
      setQueueCount(getOfflineQueue().length);
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'Erreur lors de l’enregistrement.');
    }
  }

  async function syncNow() {
    setStatus('saving');
    const result = await syncOfflineQueue();
    setQueueCount(result.remaining);
    setStatus('done');
    setMessage(`${result.synced} inspection(s) synchronisée(s). ${result.remaining} restante(s).`);
  }

  if (!allowed) {
    return <div className="terrain-page"><section className="terrain-card"><h1>Accès non autorisé</h1><p>Le module terrain est réservé aux administrateurs, coordonnateurs et installateurs.</p></section></div>;
  }

  return (
    <div className="terrain-page">
      <header className="terrain-hero">
        <div>
          <h1>Application terrain</h1>
          <p>Inspection, photo, GPS et synchronisation.</p>
        </div>
        <div className="terrain-network">
          {navigator.onLine ? <Wifi size={18} /> : <WifiOff size={18} />}
          {navigator.onLine ? 'En ligne' : 'Hors ligne'}
          <span>{queueCount} en attente</span>
          <button onClick={syncNow} disabled={!queueCount || !navigator.onLine}><RefreshCw size={16} /> Synchroniser</button>
        </div>
      </header>

      <div className="terrain-layout">
        <section className="terrain-card">
          <h2><Search size={20} /> Sélectionner une fiche</h2>
          <div className="terrain-inline">
            <select value={source} onChange={e => { setSource(e.target.value); setSelected(null); setQuery(''); }}>
              <option>Infrastructure</option>
              <option>Arrêt</option>
            </select>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Support ID, numéro d’arrêt ou emplacement" />
          </div>

          {suggestions.length > 0 && (
            <div className="terrain-suggestions">
              {suggestions.map((row, index) => (
                <button key={row.id || index} onClick={() => choose(row)}>
                  <strong>{row[idField]}</strong>
                  <span>{row.emplacement_visibilite || row.site || ''}</span>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <article className="terrain-selected">
              <CheckCircle2 />
              <div>
                <strong>{selected[idField]}</strong>
                <span>{selected.emplacement_visibilite || selected.site || 'Fiche sélectionnée'}</span>
                <small>{selected.type_support || selected.statut || ''}</small>
              </div>
            </article>
          )}
        </section>

        <form className="terrain-card" onSubmit={submit}>
          <h2><Camera size={20} /> Intervention</h2>

          <label>Action
            <select value={action} onChange={e => setAction(e.target.value)}>
              <option value="inspection">Inspection</option>
              <option value="installation">Installation</option>
              <option value="retrait">Retrait</option>
              <option value="entretien">Entretien</option>
              <option value="enjeu">Signalement d’enjeu</option>
            </select>
          </label>

          <div className="terrain-checks">
            {Object.entries(flags).map(([key, value]) => (
              <label key={key}>
                <input type="checkbox" checked={value} onChange={e => setFlags({ ...flags, [key]: e.target.checked })} />
                {key.replaceAll('_', ' ')}
              </label>
            ))}
          </div>

          <label>Commentaires
            <textarea value={comments} onChange={e => setComments(e.target.value)} placeholder="Observations terrain..." />
          </label>

          <div className="terrain-gps">
            <button type="button" onClick={requestGps}><LocateFixed size={18} /> Obtenir la position GPS</button>
            <span>{gpsStatus}</span>
            {gps && <small>{gps.latitude.toFixed(6)}, {gps.longitude.toFixed(6)} — précision ±{Math.round(gps.precision_m)} m</small>}
          </div>

          <label className="terrain-photo">
            <Camera size={20} />
            Prendre ou joindre une photo
            <input type="file" accept="image/*" capture="environment" onChange={handleFile} />
          </label>

          {preview && <img className="terrain-preview" src={preview} alt="Aperçu terrain" />}

          <button className="terrain-save" type="submit" disabled={status === 'saving'}>
            <Save size={18} /> {status === 'saving' ? 'Enregistrement...' : 'Terminer l’intervention'}
          </button>

          {message && <div className={status === 'error' ? 'terrain-message error' : 'terrain-message'}>{message}</div>}
        </form>
      </div>
    </div>
  );
}
