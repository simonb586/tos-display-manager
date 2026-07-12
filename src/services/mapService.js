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

export function getSupportCoordinates(row) {
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

  if (!combined) return null;

  const matches = String(combined)
    .replace(';', ',')
    .match(/(-?\d+(?:[.,]\d+)?)\s*[, ]\s*(-?\d+(?:[.,]\d+)?)/);

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
  const coordinates = getSupportCoordinates(row);
  if (!coordinates) return null;

  return {
    ...row,
    ...coordinates,
    supportId: String(firstValue(row, ['support_id', 'Support ID', 'supportId']) || ''),
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
    activeLabel: String(firstValue(row, ['actif', 'Actif', 'statut']) || '')
  };
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
        point.issueLabel
      ].join(' ').toLowerCase();

      if (!haystack.includes(query)) return false;
    }

    if (filters.supportType && point.supportType !== filters.supportType) return false;
    if (filters.campaign && point.campaignLabel !== filters.campaign) return false;
    if (filters.edt && point.edtLabel !== filters.edt) return false;
    if (filters.issueOnly && !point.issueLabel) return false;

    return true;
  });
}

export function clusterMapPoints(points, zoom) {
  if (zoom >= 15) {
    return points.map(point => ({
      key: `support-${point.supportId}`,
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
