import { supabase, supabaseConfigured } from '../lib/supabaseClient';
import { getSignedPhotoUrls } from './photoAccessService';

const ALLOWED_SECTIONS = new Set(['dashboard','campaigns','communications','supports','photos','reports','edt','issues','history','members']);
const clampSize = (section, size) => Math.min(section === 'photos' ? 50 : 100, Math.max(1, Number(size) || 25));
const rpc = async (name, args = {}) => {
  if (!supabaseConfigured || !supabase) throw new Error('Service sécurisé indisponible.');
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
};

export async function listClientPortalSection(section, { page = 1, pageSize = 25, filters = {} } = {}) {
  if (!ALLOWED_SECTIONS.has(section)) throw new Error('Section client non autorisée.');
  const result = await rpc('client_portal_list_v120', {
    p_section: section,
    p_page: Math.max(1, Number(page) || 1),
    p_page_size: clampSize(section, pageSize),
    p_filters: filters
  });
  if (section === 'photos') result.rows = await getSignedPhotoUrls(result.rows || [], { purpose:'preview' });
  return result;
}

export async function listAllClientPortalSection(section,{filters={}}={}){
  const pageSize=clampSize(section,100),first=await listClientPortalSection(section,{page:1,pageSize,filters}),rows=[...(first.rows||[])];
  const pages=Math.ceil((first.total||0)/(first.page_size||pageSize));
  for(let page=2;page<=pages;page+=1)rows.push(...((await listClientPortalSection(section,{page,pageSize,filters})).rows||[]));
  return rows;
}

export const inviteClientMember = ({ email, name }) => rpc('client_admin_invite_member_v120', { p_email: email, p_name: name });
export const deactivateClientMember = memberId => rpc('client_admin_deactivate_member_v120', { p_member_id: memberId });
export const updateClientMemberCampaignAccess = ({ memberId, campaignId, allowed }) => rpc('client_admin_set_campaign_access_v120', { p_member_id: memberId, p_campaign_id: campaignId, p_allowed: Boolean(allowed) });
