import { supabase, supabaseConfigured } from '../lib/supabaseClient';
import {
  normalizeCampaignStatus,
  normalizeDisplayFormat,
  supportDisplayFormat
} from '../lib/displayFormat';
import { isVisualFormatCompatible } from '../lib/visualCompatibility';
import { BUSINESS_CONTEXT } from '../lib/businessContext';

export { normalizeDisplayFormat, supportDisplayFormat } from '../lib/displayFormat';

export { isVisualFormatCompatible } from '../lib/visualCompatibility';

function ready() {
  if (!supabaseConfigured || !supabase) {
    throw new Error('Supabase n’est pas configuré.');
  }
}

export async function diagnoseCompatibleVisualsForSupport(support) {
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

  if (!supportFormatKey) {
    return {
      visuals: [],
      diagnostic: {
        ...baseDiagnostic,
        reason: 'Le support ne possède aucun format exploitable.'
      }
    };
  }

  const { data, error } = await supabase
    .from('campagne_visuels_formats')
    .select('*, campagne:campagne_id(*)')
    .eq('actif', true)
    .order('phase')
    .order('nom_visuel');

  if (error) {
    throw new Error(`Lecture des visuels impossible : ${error.message || error}`);
  }

  const activeVisuals = data || [];
  const sameFormat = activeVisuals.filter(visual => isVisualFormatCompatible(visual, support));
  const published = sameFormat.filter(
    visual => visual.campagne?.publiee_terrain === true && (visual.campagne?.business_context || BUSINESS_CONTEXT.MARKETING) === BUSINESS_CONTEXT.MARKETING
  );
  const activeCampaigns = published.filter(
    visual => normalizeCampaignStatus(visual.campagne?.statut) === 'active'
  );
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
    visuals: activeCampaigns,
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

export async function listCompatibleVisualsForSupport(support) {
  const result = await diagnoseCompatibleVisualsForSupport(support);
  return result.visuals;
}

export async function listCampaignVisuals() {
  ready();
  const { data, error } = await supabase
    .from('campagne_visuels_formats')
    .select('*, campagne:campagne_id(*), edt_phase:edt_phase_id(id,phase_type,edt:edt_id(id,no_edt))')
    .order('nom_visuel');
  if (error) throw error;
  return data || [];
}

export async function listEdtPhasesForCampaign(campaignId) {
  ready();
  if (!campaignId) return [];
  const { data, error } = await supabase.from('edt_phases')
    .select('id,phase_type,date_debut_prevue,edt:edt_id!inner(id,no_edt,campagne_id,statut)')
    .eq('edt.campagne_id', Number(campaignId))
    .order('date_debut_prevue', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data || [];
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

  const query = visual.id
    ? supabase.from('campagne_visuels_formats').update(payload).eq('id', visual.id)
    : supabase.from('campagne_visuels_formats').insert(payload);
  const { data, error } = await query.select().single();
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
  const { data, error } = await supabase.rpc('delete_or_archive_campaign_visual', {
    p_visual_id: Number(id)
  });
  if (error) throw error;
  return data;
}
