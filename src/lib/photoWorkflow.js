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

export const DEFAULT_INSPECTION_NOTICE = 'Aucun événement actif n’a été trouvé pour cette date. La photo a été classée comme inspection.';

const one = values => Array.isArray(values) && values.length === 1 ? values[0] : null;

// Point d’entrée unique de classement. Les appelants fournissent uniquement les
// relations réellement connues à la date de prise de vue.
export function classifyPhotoContext(context = {}) {
  if (context.issueId) return { type:'enjeu', source:'explicit', reason:'explicit_issue', issueId:context.issueId };
  const installation = context.activeInstallationEdt || one(context.activeInstallationEdts);
  if (installation) return { type:'installation', source:'automatic', reason:'active_installation_edt', edtId:installation.id ?? installation, campaignId:installation.campagne_id ?? null };
  const removal = context.activeRemovalEdt || one(context.activeRemovalEdts);
  if (removal) return { type:'retrait', source:'automatic', reason:'active_removal_edt', edtId:removal.id ?? removal, campaignId:removal.campagne_id ?? null };
  if (context.inspectionId || context.explicitType === 'inspection') return { type:'inspection', source:'explicit', reason:'explicit_inspection', inspectionId:context.inspectionId ?? null };
  const campaign = context.explicitCampaign || one(context.activeCampaigns);
  if (campaign) return { type:context.explicitType ? normalizePhotoType(context.explicitType) : 'inspection', source:context.explicitType ? 'explicit' : 'automatic', reason:'determining_campaign', campaignId:campaign.id ?? campaign };
  return { type:'inspection', source:'automatic', reason:'no_active_business_context', campaignId:null, edtId:null, notice:DEFAULT_INSPECTION_NOTICE };
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
  const normalizedType = normalizePhotoType(type || 'inspection');
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
