const toNumber = value => {
  if (value === null || value === undefined || value === '') return null;
  const normalized = String(value).trim().replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const firstValue = (row, keys) => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') return value;
  }
  return null;
};

const textValue = (row, keys) => String(firstValue(row, keys) || '').trim();
const expandMapRow = row => row?.raw_data && typeof row.raw_data === 'object' && !Array.isArray(row.raw_data)
  ? { ...row.raw_data, ...row }
  : row;

export function classifySupportCoordinates(row) {
  row = expandMapRow(row);
  const coordinateKeys = ['latitude', 'Latitude', 'lat', 'LATITUDE', 'longitude', 'Longitude', 'lng', 'lon', 'LONGITUDE'];
  const combinedKeys = ['coordonnees_gps', 'Coordonnées GPS', 'coordonnées GPS', 'gps', 'GPS'];
  const linkKeys = ['lien_carte_interactive', 'Lien carte interactive', 'lien_carte', 'map_url'];
  const supplied = [...coordinateKeys, ...combinedKeys, ...linkKeys].some(key => row?.[key] !== null && row?.[key] !== undefined && String(row[key]).trim() !== '');
  const coordinates = getSupportCoordinates(row);
  return { status: coordinates ? 'valid' : supplied ? 'invalid' : 'missing', coordinates };
}

export function getSupportCoordinates(row) {
  row = expandMapRow(row);
  const latitude = toNumber(firstValue(row, [
    'latitude', 'Latitude', 'lat', 'LATITUDE'
  ]));
  const longitude = toNumber(firstValue(row, [
    'longitude', 'Longitude', 'lng', 'lon', 'LONGITUDE'
  ]));

  if (
    latitude !== null &&
    longitude !== null &&
    latitude >= -90 && latitude <= 90 &&
    longitude >= -180 && longitude <= 180
  ) {
    return { latitude, longitude };
  }

  const combined = firstValue(row, [
    'coordonnees_gps',
    'Coordonnées GPS',
    'coordonnées GPS',
    'gps',
    'GPS'
  ]);

  const mapLink = firstValue(row, ['lien_carte_interactive', 'Lien carte interactive', 'lien_carte', 'map_url']);
  if (!combined && !mapLink) return null;

  const matches = String(combined || mapLink)
    .replace(';', ',')
    .match(/(-?\d{1,2}(?:[.,]\d+)?)\s*[,/@ ]\s*(-?\d{1,3}(?:[.,]\d+)?)/);

  if (!matches) return null;

  const combinedLatitude = toNumber(matches[1]);
  const combinedLongitude = toNumber(matches[2]);

  if (
    combinedLatitude === null ||
    combinedLongitude === null ||
    combinedLatitude < -90 || combinedLatitude > 90 ||
    combinedLongitude < -180 || combinedLongitude > 180
  ) {
    return null;
  }

  return { latitude: combinedLatitude, longitude: combinedLongitude };
}

export function normalizeInfrastructureForMap(row) {
  row = expandMapRow(row);
  const coordinates = getSupportCoordinates(row);
  if (!coordinates) return null;

  return {
    ...row,
    ...coordinates,
    supportId: textValue(row, ['support_id', 'Support ID', 'supportId']),
    siteLabel: String(firstValue(row, [
      'emplacement_visibilite',
      'Emplacement/Visibilité',
      'site',
      'Site'
    ]) || ''),
    supportType: String(firstValue(row, [
      'type_support',
      'Type de support',
      'type_de_support'
    ]) || ''),
    formatLabel: String(firstValue(row, [
      'format_affichage',
      "Formats d'affichage",
      'format',
      'format_visuel'
    ]) || ''),
    campaignLabel: String(firstValue(row, [
      'campagne_actuelle',
      'Nom de la campagne actuelle',
      'campagne_selon_visuel',
      'CAMPAGNES SELON VISUEL'
    ]) || ''),
    visualLabel: String(firstValue(row, [
      'visuel_campagne',
      'Visuel de la campagne',
      'visuel_en_expo',
      'VISUEL EN EXPO'
    ]) || ''),
    edtLabel: String(firstValue(row, [
      'edt_associe',
      'EDT Associé',
      'no_edt'
    ]) || ''),
    issueLabel: String(firstValue(row, [
      'enjeux',
      'Enjeux',
      'type_enjeux',
      "Type d'enjeux"
    ]) || ''),
    activeLabel: textValue(row, ['statut', 'État', 'etat', 'actif', 'Actif']),
    clientLabel: textValue(row, ['client', 'client_nom', 'nom_client', 'Client']),
    installerLabel: textValue(row, ['installateur', 'installateur_nom', 'assigne_a', 'assignà', 'Assigné à']),
    zoneLabel: textValue(row, ['zone', 'secteur', 'territoire', 'Zone']),
    inspectionLabel: textValue(row, ['derniere_inspection', 'inspection_statut', 'inspection', 'Dernière inspection']),
    photoUrl: textValue(row, ['photo_miniature_url', 'photo_principale_url', 'visuel_actuel_cadre']),
    lastActivity: textValue(row, ['updated_at', 'date_modification', 'Date Modified', 'created_at'])
  };
}

export function prepareMapInfrastructureRows(rows) {
  const counters = { total: rows.length, displayable: 0, missing: 0, invalid: 0, duplicates: 0 };
  const unique = new Map();
  rows.forEach((row, index) => {
    const classified = classifySupportCoordinates(row);
    if (classified.status === 'missing') { counters.missing += 1; return; }
    if (classified.status === 'invalid') { counters.invalid += 1; return; }
    const normalized = normalizeInfrastructureForMap(row);
    const key = normalized.supportId || `coordinates:${normalized.latitude}:${normalized.longitude}`;
    if (unique.has(key)) { counters.duplicates += 1; return; }
    unique.set(key, { ...normalized, mapKey: key || `row-${index}` });
  });
  const points = [...unique.values()];
  counters.displayable = points.length;
  return { points, counters };
}

export function infrastructureMapUrl(row) {
  const coordinates = getSupportCoordinates(row);
  if (!coordinates) return '';
  return `https://www.openstreetmap.org/?mlat=${coordinates.latitude}&mlon=${coordinates.longitude}#map=18/${coordinates.latitude}/${coordinates.longitude}`;
}

export function buildMapOptions(points, key) {
  return [...new Set(points.map(point => String(point[key] || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'fr-CA'));
}

export function filterMapPoints(points, filters) {
  const query = String(filters.query || '').trim().toLowerCase();

  return points.filter(point => {
    if (query) {
      const haystack = [
        point.supportId,
        point.siteLabel,
        point.supportType,
        point.formatLabel,
        point.campaignLabel,
        point.visualLabel,
        point.edtLabel,
        point.issueLabel,
        point.clientLabel,
        point.installerLabel,
        point.zoneLabel,
        point.activeLabel,
        point.inspectionLabel
      ].join(' ').toLowerCase();

      if (!haystack.includes(query)) return false;
    }

    if (filters.supportType && point.supportType !== filters.supportType) return false;
    if (filters.campaign && point.campaignLabel !== filters.campaign) return false;
    if (filters.edt && point.edtLabel !== filters.edt) return false;
    if (filters.issueOnly && !point.issueLabel) return false;
    if (filters.client && point.clientLabel !== filters.client) return false;
    if (filters.status && point.activeLabel !== filters.status) return false;
    if (filters.installer && point.installerLabel !== filters.installer) return false;
    if (filters.zone && point.zoneLabel !== filters.zone) return false;
    if (filters.inspectionOnly && !point.inspectionLabel) return false;
    if (filters.photo === 'with' && !point.photoUrl) return false;
    if (filters.photo === 'without' && point.photoUrl) return false;

    return true;
  });
}

export function clusterMapPoints(points, zoom) {
  if (zoom >= 15) {
    return points.map(point => ({
      key: `support-${point.mapKey || point.supportId}`,
      latitude: point.latitude,
      longitude: point.longitude,
      points: [point],
      count: 1
    }));
  }

  const step =
    zoom <= 5 ? 2 :
    zoom <= 7 ? 0.75 :
    zoom <= 9 ? 0.25 :
    zoom <= 11 ? 0.08 :
    zoom <= 13 ? 0.025 : 0.009;

  const buckets = new Map();

  for (const point of points) {
    const latBucket = Math.round(point.latitude / step);
    const lonBucket = Math.round(point.longitude / step);
    const key = `${latBucket}:${lonBucket}`;
    const current = buckets.get(key) || {
      key,
      latitudeSum: 0,
      longitudeSum: 0,
      points: []
    };

    current.latitudeSum += point.latitude;
    current.longitudeSum += point.longitude;
    current.points.push(point);
    buckets.set(key, current);
  }

  return [...buckets.values()].map(bucket => ({
    key: bucket.key,
    latitude: bucket.latitudeSum / bucket.points.length,
    longitude: bucket.longitudeSum / bucket.points.length,
    points: bucket.points,
    count: bucket.points.length
  }));
}
