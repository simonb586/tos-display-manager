import { supabase, supabaseConfigured } from '../lib/supabaseClient';
import {compareVisuals,compareNatural} from '../lib/gridSorting';
import {
  normalizeDisplayFormat,
  supportDisplayFormat
} from '../lib/displayFormat';

export { normalizeDisplayFormat, supportDisplayFormat } from '../lib/displayFormat';

export { isVisualFormatCompatible } from '../lib/visualCompatibility';

function ready() {
  if (!supabaseConfigured || !supabase) {
    throw new Error('Supabase n’est pas configuré.');
  }
}

export async function diagnoseCompatibleVisualsForSupport(support, phaseId) {
  ready();

  const supportFormat = supportDisplayFormat(support);
  const supportFormatKey = normalizeDisplayFormat(supportFormat);
  const baseDiagnostic = {
    supportId: String(support?.support_id || ''),
    supportFormat,
    supportFormatKey,
    totalActiveVisuals: 0,
    matchingFormat: 0,
    publishedCampaigns: 0,
    activeCampaigns: 0,
    eligibleCount: 0,
    availableFormats: [],
    reason: ''
  };

  const { data, error } = await supabase.rpc('lister_visuels_installation_terrain_v1331', {
    p_support_id: String(support?.support_id || ''),
    p_edt_phase_id: null
  });

  if (error) {
    throw error;
  }

  const links=await supabase.from('visual_edt_associations').select('visual_id,phase_id,date_debut,date_fin,edt:edt_id(id,no_edt,archived_at)');
  if(links.error)throw links.error;
  const activeCampaigns = (Array.isArray(data) ? data : []).map(v=>({...v,edt_associations:(links.data||[]).filter(a=>a.visual_id===v.id&&a.edt&&!a.edt.archived_at).map(a=>({...a,edt_number:a.edt.no_edt}))}));
  const activeVisuals = activeCampaigns;
  const sameFormat = activeCampaigns;
  const published = activeCampaigns;
  const availableFormats = [...new Set(
    activeVisuals
      .map(visual => String(visual.format_support || '').trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, 'fr-CA', { numeric: true }));

  let reason = '';
  if (!activeVisuals.length) {
    reason = 'Aucun visuel actif n’est disponible.';
  } else if (!sameFormat.length) {
    reason = 'Aucun visuel actif ne correspond au format normalisé du support.';
  } else if (!published.length) {
    reason = 'Les visuels compatibles appartiennent à des campagnes non publiées sur le terrain.';
  } else if (!activeCampaigns.length) {
    reason = 'Les campagnes publiées compatibles ne sont pas à l’état Active.';
  }

  return {
    visuals: activeCampaigns.sort(compareVisuals),
    diagnostic: {
      ...baseDiagnostic,
      totalActiveVisuals: activeVisuals.length,
      matchingFormat: sameFormat.length,
      publishedCampaigns: published.length,
      activeCampaigns: activeCampaigns.length,
      eligibleCount: activeCampaigns.length,
      availableFormats,
      reason
    }
  };
}

export async function listCompatibleVisualsForSupport(support, phaseId) {
  const result = await diagnoseCompatibleVisualsForSupport(support, phaseId);
  return result.visuals;
}

export async function listCampaignVisuals() {
  ready();
  const query = supabase
    .from('campagne_visuels_formats')
    .select('*, campagne:campagne_id(*), edt_phase:edt_phase_id(id,phase_type,edt:edt_id(id,no_edt)), edt_associations:visual_edt_associations(edt_id,phase_id,date_debut,date_fin,edt:edt_id(id,no_edt))')
    .order('id');
  const rows=[];
  for(let offset=0;;offset+=500){const {data,error}=await query.range(offset,offset+499);if(error)throw error;rows.push(...(data||[]));if((data||[]).length<500)return rows.sort(compareVisuals);}
}

export async function assignVisualToEdt(visualId, phaseId, removedEdtId = null) {
  ready();
  const {data,error}=await supabase.rpc('update_visual_edt_association', {
    p_visual_id:Number(visualId), p_phase_id:phaseId ? Number(phaseId) : null, p_remove_edt_id:removedEdtId ? Number(removedEdtId):null
  });
  if(error) throw error;
  if(!data?.ok) throw new Error('Le rattachement du visuel n’a pas été confirmé.');
  window.dispatchEvent(new CustomEvent('tos-terrain-data-updated'));
  return data;
}

export async function listEdtPhasesForCampaign(campaignId) {
  ready();
  if (!campaignId) return [];
  const { data, error } = await supabase.rpc('list_visual_eligible_edt_phases',{p_campaign_id:Number(campaignId)});
  if (error) throw error;
  return (data || []).sort((a,b)=>compareNatural(a.edt?.no_edt,b.edt?.no_edt)||compareNatural(a.id,b.id));
}

export async function saveCampaignVisual(visual) {
  ready();
  const payload = {
    campagne_id: Number(visual.campagne_id),
    phase: visual.phase?.trim() || null,
    nom_visuel: visual.nom_visuel?.trim() || '',
    code_visuel: visual.code_visuel?.trim() || null,
    format_support: visual.format_support?.trim() || '',
    quantite_prevue: Number(visual.quantite_prevue || 0),
    actif: visual.actif !== false,
    instructions_terrain: visual.instructions_terrain?.trim() || null,
    is_out_of_frame: Boolean(visual.is_out_of_frame),
    edt_phase_id: visual.edt_phase_id ? Number(visual.edt_phase_id) : null,
    updated_at: new Date().toISOString()
  };

  if (!payload.campagne_id || !payload.nom_visuel || !payload.format_support) {
    throw new Error('Campagne, visuel et format sont obligatoires.');
  }
  if(visual.edt_associations!==undefined){
    const ids=visual.edt_associations.map(a=>Number(a.phase_id));
    if(ids.some(id=>!Number.isSafeInteger(id)||id<=0))throw new Error('Sélectionnez un EDT pour chaque association.');
    if(new Set(ids).size!==ids.length)throw new Error('Un EDT ne peut être associé qu’une seule fois au visuel.');
  }

  const {data,error}=await supabase.rpc('save_campaign_visual_with_edts',{
    p_visual:{...payload,...(visual.id?{id:visual.id}:{})},
    p_links:visual.edt_associations===undefined?null:visual.edt_associations.map(a=>({phase_id:Number(a.phase_id),date_debut:a.date_debut||null,date_fin:a.date_fin||null}))
  });
  if (error) throw error;
  return data;
}

export async function applyVisualToSupport({
  supportId,
  visualId,
  userEmail,
  photoUrl = null,
  photoPath = null
}) {
  ready();
  const { data, error } = await supabase.rpc('appliquer_visuel_support', {
    p_support_id: supportId,
    p_visuel_id: Number(visualId),
    p_utilisateur: userEmail || null,
    p_photo_url: photoUrl,
    p_photo_path: photoPath
  });
  if (error) throw error;
  return data;
}

export async function deleteOrArchiveCampaignVisual(id) {
  ready();
  const {data:visual,error:readError}=await supabase.from('campagne_visuels_formats').select('id,reference_assets').eq('id',Number(id)).single();
  if(readError)throw readError;
  if(visual.reference_assets?.length){
    const {error}=await supabase.from('campagne_visuels_formats').update({actif:false,updated_at:new Date().toISOString()}).eq('id',Number(id)).select('id').single();
    if(error)throw error;
    return {action:'archived',used_count:visual.reference_assets.length};
  }
  const { data, error } = await supabase.rpc('delete_or_archive_campaign_visual', {
    p_visual_id: Number(id)
  });
  if (error) throw error;
  return data;
}
