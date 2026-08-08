import { supabase, supabaseConfigured } from '../lib/supabaseClient';
import { BUSINESS_CONTEXT, normalizeBusinessContext } from '../lib/businessContext';

function ensureSupabase() {
  if (!supabaseConfigured || !supabase) throw new Error('Supabase n’est pas configuré.');
}

export async function listMasterCampaigns(publishedOnly = false, businessContext = null) {
  ensureSupabase();
  let query = supabase.from('campagnes_maitres').select('*').order('nom_campagne');
  if (publishedOnly) query = query.eq('publiee_terrain', true);
  if (businessContext) query = query.eq('business_context', normalizeBusinessContext(businessContext));
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function saveMasterCampaign(campaign) {
  ensureSupabase();
  const payload = {
    code_campagne: campaign.code_campagne?.trim() || null,
    nom_campagne: campaign.nom_campagne?.trim() || '',
    client: campaign.client?.trim() || null,
    type_campagne: campaign.type_campagne || 'Installation',
    visuel_generique: campaign.visuel_generique?.trim() || null,
    no_edt: campaign.no_edt?.trim() || null,
    date_debut: campaign.date_debut || null,
    date_fin: campaign.date_fin || null,
    statut: campaign.statut || 'Brouillon',
    publiee_terrain: Boolean(campaign.publiee_terrain),
    instructions_terrain: campaign.instructions_terrain?.trim() || null,
    business_context: normalizeBusinessContext(campaign.business_context || BUSINESS_CONTEXT.MARKETING),
    updated_at: new Date().toISOString()
  };
  if (!payload.nom_campagne) throw new Error('Le nom de campagne est obligatoire.');
  const query = campaign.id
    ? supabase.from('campagnes_maitres').update(payload).eq('id', campaign.id)
    : supabase.from('campagnes_maitres').insert(payload);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}

export async function deleteOrArchiveMasterCampaign(id) {
  ensureSupabase();
  const { data, error } = await supabase.rpc('delete_or_archive_master_campaign_v111', {
    p_campaign_id: Number(id)
  });
  if (error) throw error;
  return data;
}

export async function applyCampaignToSupport({ supportId, campaignId, userEmail, photoUrl, photoPath }) {
  ensureSupabase();
  const { data, error } = await supabase.rpc('appliquer_campagne_support', {
    p_support_id: supportId,
    p_campagne_id: Number(campaignId),
    p_utilisateur: userEmail || null,
    p_photo_url: photoUrl || null,
    p_photo_path: photoPath || null
  });
  if (error) throw error;
  return data;
}
