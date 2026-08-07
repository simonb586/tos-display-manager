import React, { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents
} from 'react-leaflet';
import {
  AlertTriangle,
  Crosshair,
  ExternalLink,
  Filter,
  LocateFixed,
  MapPin,
  Search,
  X
} from 'lucide-react';
import {
  buildMapOptions,
  clusterMapPoints,
  filterMapPoints,
  infrastructureMapUrl,
  prepareMapInfrastructureRows
} from '../services/mapService';

const DEFAULT_CENTER = [52.0, -71.5];
const DEFAULT_ZOOM = 5;

function MapStateBridge({ onZoom, onBounds }) {
  useMapEvents({
    zoomend(event) {
      onZoom(event.target.getZoom());
      onBounds(event.target.getBounds());
    },
    moveend(event) {
      onBounds(event.target.getBounds());
    }
  });
  return null;
}

function MapResizeGuard() {
  const map = useMap();

  useEffect(() => {
    const invalidate = () => map.invalidateSize({ pan: false });
    const timers = [
      window.setTimeout(invalidate, 0),
      window.setTimeout(invalidate, 150),
      window.setTimeout(invalidate, 500)
    ];

    window.addEventListener('resize', invalidate);

    const container = map.getContainer();
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(invalidate)
      : null;

    observer?.observe(container);

    return () => {
      timers.forEach(timer => window.clearTimeout(timer));
      window.removeEventListener('resize', invalidate);
      observer?.disconnect();
    };
  }, [map]);

  return null;
}

function FocusSupport({ point }) {
  const map = useMap();

  useEffect(() => {
    if (!point) return;
    map.flyTo([point.latitude, point.longitude], 17, { duration: 0.8 });
  }, [map, point]);

  return null;
}

function FitVisiblePoints({ points, enabled }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled || !points.length) return;

    if (points.length === 1) {
      map.flyTo([points[0].latitude, points[0].longitude], 17);
      return;
    }

    const bounds = L.latLngBounds(points.map(point => [point.latitude, point.longitude]));
    map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 });
  }, [map, points, enabled]);

  return null;
}

const clusterIcon = count => L.divIcon({
  className: 'tos-map-cluster-wrapper',
  html: `<div class="tos-map-cluster">${count.toLocaleString('fr-CA')}</div>`,
  iconSize: [44, 44],
  iconAnchor: [22, 22]
});

export default function InteractiveMap({ dataStore, focusSupportId = '', onClearFocus, onNavigate, role }) {
  const infrastructures = dataStore?.Infrastructures?.rows || [];
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [bounds, setBounds] = useState(null);
  const [selected, setSelected] = useState(null);
  const [autoFit, setAutoFit] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [filters, setFilters] = useState({
    query: '',
    supportType: '',
    campaign: '',
    edt: '',
    client: '',
    status: '',
    installer: '',
    zone: '',
    issueOnly: false,
    inspectionOnly: false,
    photo: ''
  });

  const prepared = useMemo(
    () => prepareMapInfrastructureRows(infrastructures),
    [infrastructures]
  );
  const points = prepared.points;

  const visiblePoints = useMemo(
    () => filterMapPoints(points, filters),
    [points, filters]
  );

  const renderedPoints = useMemo(() => {
    if (!bounds || zoom < 13) return visiblePoints;
    const padded = bounds.pad(0.35);
    return visiblePoints.filter(point => padded.contains([point.latitude, point.longitude]));
  }, [visiblePoints, bounds, zoom]);

  const clusters = useMemo(() => clusterMapPoints(renderedPoints, zoom), [renderedPoints, zoom]);

  const focusedPoint = useMemo(
    () => focusSupportId
      ? points.find(point => point.supportId === String(focusSupportId))
      : null,
    [points, focusSupportId]
  );

  const supportTypes = useMemo(() => buildMapOptions(points, 'supportType'), [points]);
  const campaigns = useMemo(() => buildMapOptions(points, 'campaignLabel'), [points]);
  const edts = useMemo(() => buildMapOptions(points, 'edtLabel'), [points]);
  const clients = useMemo(() => buildMapOptions(points, 'clientLabel'), [points]);
  const statuses = useMemo(() => buildMapOptions(points, 'activeLabel'), [points]);
  const installers = useMemo(() => buildMapOptions(points, 'installerLabel'), [points]);
  const zones = useMemo(() => buildMapOptions(points, 'zoneLabel'), [points]);

  function resetFilters() {
    setFilters({
      query: '',
      supportType: '',
      campaign: '',
      edt: '',
      client: '', status: '', installer: '', zone: '',
      issueOnly: false, inspectionOnly: false, photo: ''
    });
    setAutoFit(true);
    window.setTimeout(() => setAutoFit(false), 250);
  }

  function locateUser(map) {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(position => {
      map.flyTo(
        [position.coords.latitude, position.coords.longitude],
        16,
        { duration: 0.8 }
      );
    });
  }

  return (
    <div className="map-page">
      <header className="map-hero">
        <div>
          <h1><MapPin/> Carte interactive</h1>
          <p>Visualise les supports géolocalisés, filtre les opérations et ouvre leur fiche cartographique.</p>
        </div>
        <div className="map-kpis">
          <span><strong>{infrastructures.length.toLocaleString('fr-CA')}</strong> infrastructures</span>
          <span><strong>{prepared.counters.displayable.toLocaleString('fr-CA')}</strong> affichables</span>
          <span><strong>{visiblePoints.length.toLocaleString('fr-CA')}</strong> visibles</span>
        </div>
      </header>

      <div className="map-workspace">
        <aside className={filtersOpen ? 'map-filters open' : 'map-filters'}>
          <button className="map-filter-toggle" onClick={() => setFiltersOpen(value => !value)}>
            {filtersOpen ? <X size={18}/> : <Filter size={18}/>}
          </button>

          {filtersOpen && (
            <>
              <h2><Filter size={18}/> Filtres</h2>

              <label className="map-search">
                <Search size={17}/>
                <input
                  value={filters.query}
                  onChange={event => setFilters({ ...filters, query: event.target.value })}
                  placeholder="Numéro du support, site, visuel…"
                />
              </label>

              <label>Type de support
                <select
                  value={filters.supportType}
                  onChange={event => setFilters({ ...filters, supportType: event.target.value })}
                >
                  <option value="">Tous</option>
                  {supportTypes.map(item => <option key={item}>{item}</option>)}
                </select>
              </label>

              <label>Campagne
                <select
                  value={filters.campaign}
                  onChange={event => setFilters({ ...filters, campaign: event.target.value })}
                >
                  <option value="">Toutes</option>
                  {campaigns.map(item => <option key={item}>{item}</option>)}
                </select>
              </label>

              <label>EDT
                <select
                  value={filters.edt}
                  onChange={event => setFilters({ ...filters, edt: event.target.value })}
                >
                  <option value="">Tous</option>
                  {edts.map(item => <option key={item}>{item}</option>)}
                </select>
              </label>

              {[['client','Client',clients],['status','Statut',statuses],['installer','Installateur',installers],['zone','Zone',zones]].map(([key,label,options]) => (
                <label key={key}>{label}
                  <select value={filters[key]} onChange={event => setFilters({ ...filters, [key]: event.target.value })}>
                    <option value="">Tous</option>
                    {options.map(item => <option key={item}>{item}</option>)}
                  </select>
                </label>
              ))}

              <label className="map-check">
                <input
                  type="checkbox"
                  checked={filters.issueOnly}
                  onChange={event => setFilters({ ...filters, issueOnly: event.target.checked })}
                />
                Afficher seulement les supports avec enjeux
              </label>
              <label className="map-check"><input type="checkbox" checked={filters.inspectionOnly} onChange={event => setFilters({ ...filters, inspectionOnly: event.target.checked })}/> Avec inspection</label>
              <label>Photos
                <select value={filters.photo} onChange={event => setFilters({ ...filters, photo: event.target.value })}>
                  <option value="">Toutes</option><option value="with">Avec photo</option><option value="without">Sans photo</option>
                </select>
              </label>

              <div className="map-filter-actions">
                <button onClick={() => {
                  setAutoFit(true);
                  window.setTimeout(() => setAutoFit(false), 250);
                }}>
                  <Crosshair size={16}/> Cadrer les résultats
                </button>
                <button onClick={resetFilters}>Réinitialiser</button>
              </div>

              <div className="map-coverage">
                <strong>Couverture GPS</strong>
                <div><i style={{ width: `${infrastructures.length ? Math.round(points.length / infrastructures.length * 100) : 0}%` }}/></div>
                <span>
                  {infrastructures.length
                    ? Math.round(points.length / infrastructures.length * 100)
                    : 0}% des infrastructures
                </span>
                <small>{prepared.counters.missing.toLocaleString('fr-CA')} sans coordonnées • {prepared.counters.invalid.toLocaleString('fr-CA')} invalides • {prepared.counters.duplicates.toLocaleString('fr-CA')} doublons ignorés</small>
              </div>
              <div className="map-legend" aria-label="Légende de la carte"><strong>Légende</strong><span><i className="map-dot map-dot-normal"/> Support</span><span><i className="map-dot map-dot-issue"/> Enjeu signalé</span><span><i className="map-dot map-dot-cluster"/> Groupe de supports</span></div>
            </>
          )}
        </aside>

        <section className="map-canvas">
          <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} preferCanvas className="tos-map">
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapStateBridge onZoom={setZoom} onBounds={setBounds}/>
            <MapResizeGuard/>
            <FocusSupport point={focusedPoint}/>
            <FitVisiblePoints points={visiblePoints} enabled={autoFit}/>

            <MapControls onLocate={locateUser}/>

            {clusters.map(cluster => {
              if (cluster.count > 1) {
                return (
                  <Marker
                    key={cluster.key}
                    position={[cluster.latitude, cluster.longitude]}
                    icon={clusterIcon(cluster.count)}
                    eventHandlers={{
                      click(event) {
                        event.target._map.flyTo(
                          [cluster.latitude, cluster.longitude],
                          Math.min(18, zoom + 2)
                        );
                      }
                    }}
                  />
                );
              }

              const point = cluster.points[0];

              return (
                <CircleMarker
                  key={cluster.key}
                  center={[point.latitude, point.longitude]}
                  radius={8}
                  pathOptions={{
                    color: point.issueLabel ? '#dc2626' : '#5b21b6',
                    fillColor: point.issueLabel ? '#ef4444' : '#7c3aed',
                    fillOpacity: 0.85,
                    weight: 2
                  }}
                  eventHandlers={{
                    click() {
                      setSelected(point);
                    }
                  }}
                >
                  <Popup>
                    <div className="map-popup">
                      <strong>{point.supportId}</strong>
                      <span>{point.siteLabel || 'Emplacement non précisé'}</span>
                      <small>{point.supportType || 'Type non précisé'} — {point.formatLabel || 'Format non précisé'}</small>
                      <small>Campagne : {point.campaignLabel || '—'}</small>
                      <small>EDT : {point.edtLabel || '—'}</small>
                      <button onClick={() => setSelected(point)}>Ouvrir la fiche carte</button>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>

          {!points.length && (
            <div className="map-empty">
              <AlertTriangle/>
              <div>
                <h2>Aucun support géolocalisé pour le moment</h2>
                <p>La carte demeure centrée sur le Québec. Les marqueurs apparaîtront automatiquement dès que des coordonnées GPS seront enregistrées.</p>
              </div>
            </div>
          )}
        </section>

        {selected && (
          <aside className="map-detail">
            <button className="map-detail-close" onClick={() => setSelected(null)}><X/></button>
            <span className="map-detail-label">Support</span>
            <h2>{selected.supportId}</h2>
            <p>{selected.siteLabel || 'Emplacement non précisé'}</p>

            <dl>
              <div><dt>Type</dt><dd>{selected.supportType || '—'}</dd></div>
              <div><dt>Format</dt><dd>{selected.formatLabel || '—'}</dd></div>
              <div><dt>Campagne</dt><dd>{selected.campaignLabel || '—'}</dd></div>
              <div><dt>Visuel</dt><dd>{selected.visualLabel || '—'}</dd></div>
              <div><dt>EDT</dt><dd>{selected.edtLabel || '—'}</dd></div>
              <div><dt>Enjeux</dt><dd>{selected.issueLabel || 'Aucun'}</dd></div>
              <div><dt>Client</dt><dd>{selected.clientLabel || '—'}</dd></div>
              <div><dt>État</dt><dd>{selected.activeLabel || '—'}</dd></div>
              <div><dt>Inspection</dt><dd>{selected.inspectionLabel || '—'}</dd></div>
              <div><dt>Activité</dt><dd>{selected.lastActivity || '—'}</dd></div>
            </dl>

            {selected.photoUrl && <img className="map-detail-photo" src={selected.photoUrl} alt={`Dernière photo du support ${selected.supportId}`}/>}

            <div className="map-coordinates">
              {selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}
            </div>

            <a href={infrastructureMapUrl(selected)} target="_blank" rel="noreferrer">
              <ExternalLink size={17}/> Ouvrir dans OpenStreetMap
            </a>

            <div className="map-detail-actions">
              <button onClick={() => onNavigate?.('Infrastructures')}>Ouvrir / Fiche 360</button>
              {role === 'Administrateur' && <button onClick={() => onNavigate?.('Photos et inventaire')}>Photos</button>}
              {['Administrateur','Coordonnateur'].includes(role) && <button onClick={() => onNavigate?.('Centre EDT et BT')}>EDT / Travaux</button>}
              {['Administrateur','Coordonnateur'].includes(role) && <button onClick={() => onNavigate?.('Journal des événements')}>Historique</button>}
            </div>

            {focusSupportId && (
              <button onClick={onClearFocus}>Retirer le ciblage</button>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function MapControls({ onLocate }) {
  const map = useMap();

  return (
    <div className="leaflet-top leaflet-right">
      <div className="leaflet-control map-leaflet-controls">
        <button title="Ma position" onClick={() => onLocate(map)}>
          <LocateFixed size={18}/>
        </button>
      </div>
    </div>
  );
}
