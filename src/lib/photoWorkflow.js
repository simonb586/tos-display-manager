export const PHOTO_TYPES = Object.freeze([
  'installation', 'retrait', 'inspection', 'enjeu', 'autre',
  'visuel_actuel', 'historique', 'avant', 'apres', 'rapport', 'photo_ci'
]);

const ascii = value => String(value ?? '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toUpperCase()
  .replace(/[^A-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

export function normalizePhotoType(value) {
  const type = ascii(value).toLowerCase().replace(/-/g, '_');
  const aliases = { photo:'autre', autre_photo:'autre', retrait_photo:'retrait', photo_c_i:'photo_ci' };
  const normalized = aliases[type] || type;
  if (!PHOTO_TYPES.includes(normalized)) throw new Error(`Type de photo non autorisé : ${value || 'absent'}.`);
  return normalized;
}

export function realExtension(name, mimeType='') {
  const fromName = String(name || '').match(/\.([a-zA-Z0-9]{2,5})$/)?.[1]?.toLowerCase();
  if (fromName) return fromName === 'jpeg' ? 'jpg' : fromName;
  const fromMime = String(mimeType).split('/')[1]?.toLowerCase();
  return fromMime === 'jpeg' ? 'jpg' : (fromMime || 'jpg').replace(/[^a-z0-9]/g, '');
}

export function photoDate(value, fallback=new Date()) {
  const dateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = value ? new Date(dateOnly ? `${value}T12:00:00` : value) : new Date(fallback);
  if (Number.isNaN(date.getTime())) throw new Error('Date de photo invalide.');
  return date;
}

export function generatePhotoIdentity({supportId, capturedAt, uploadedAt=new Date(), type, campaignCode='NONE', edt='NONE', sequence=1, originalFilename='', mimeType=''}) {
  const support = ascii(supportId);
  if (!support) throw new Error('Un support valide est obligatoire.');
  const normalizedType = normalizePhotoType(type);
  const date = photoDate(capturedAt, uploadedAt);
  const ymd = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;
  const seq = String(Number(sequence) || 1).padStart(3, '0');
  const extension = realExtension(originalFilename, mimeType);
  const normalizedFilename = `${support}-${ymd}-${ascii(normalizedType)}-${ascii(campaignCode)||'NONE'}-${ascii(edt)||'NONE'}-${seq}.${extension}`;
  return {
    originalFilename:String(originalFilename || ''), normalizedFilename,
    storagePath:`supports/${support}/${ymd.slice(0,4)}/${ascii(campaignCode)||'NONE'}/${ascii(normalizedType)}/${normalizedFilename}`,
    capturedAt:date.toISOString(), uploadedAt:photoDate(uploadedAt).toISOString(), type:normalizedType
  };
}

export function resolvePhotoAssociations({supportId, explicitCampaign=null, edtCampaign=null, activeCampaigns=[], explicitEdt=null, candidateEdts=[], type}) {
  if (!String(supportId || '').trim()) return {ok:false, reason:'SUPPORT_REQUIRED'};
  const campaign = edtCampaign || explicitCampaign || (activeCampaigns.length === 1 ? activeCampaigns[0] : null);
  if (!campaign && activeCampaigns.length > 1) return {ok:false, reason:'CAMPAIGN_AMBIGUOUS'};
  const edt = explicitEdt || (candidateEdts.length === 1 ? candidateEdts[0] : null);
  if (!edt && candidateEdts.length > 1) return {ok:false, reason:'EDT_AMBIGUOUS'};
  const needsEdt = ['installation','retrait','rapport'].includes(normalizePhotoType(type));
  if (needsEdt && !edt) return {ok:false, reason:'EDT_REQUIRED'};
  return {ok:true, supportId:String(supportId), campaign, edt};
}

export const shouldUpdateCurrentVisual = type => normalizePhotoType(type) === 'inspection';
