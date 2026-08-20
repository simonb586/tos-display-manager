import { supabase, supabaseConfigured } from '../lib/supabaseClient';
import { getSignedPhotoUrls } from './photoAccessService';

const ALLOWED_SECTIONS = new Set(['campaigns','communications','supports','poster_directory','information_centers','information_centers_issues','stops','vehicles_trains','photos','reports','edt','issues','history','members']);
const V1361_SECTIONS = new Set(['poster_directory','information_centers','information_centers_issues','stops','vehicles_trains']);
const clampSize = (section, size) => Math.min(section === 'photos' ? 50 : 100, Math.max(1, Number(size) || 25));
const rpc = async (name, args = {}) => {
  if (!supabaseConfigured || !supabase) throw new Error('Service sécurisé indisponible.');
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
};
async function invokeInvitation(body){
  const{data:sessionData}=await supabase.auth.getSession();
  if(!sessionData.session?.access_token)throw new Error('Session Client-Admin expirée.');
  const{data,error}=await supabase.functions.invoke('invite-user',{headers:{Authorization:`Bearer ${sessionData.session.access_token}`},body});
  if(error)throw error;
  if(data?.error)throw new Error(data.error);
  return data;
}

export async function listClientPortalSection(section, { page = 1, pageSize = 25, filters = {} } = {}) {
  if (!ALLOWED_SECTIONS.has(section)) throw new Error('Section client non autorisée.');
  if(section==='reports')return rpc('module15_client_edt_reports_v130',{p_page:Math.max(1,Number(page)||1),p_page_size:clampSize(section,pageSize)});
  if(V1361_SECTIONS.has(section))return rpc('client_portal_list_v1361',{p_section:section,p_page:Math.max(1,Number(page)||1),p_page_size:clampSize(section,pageSize),p_filters:filters});
  const result = await rpc('client_portal_list_v120', {p_section:section,p_page:Math.max(1,Number(page)||1),p_page_size:clampSize(section,pageSize),p_filters:filters});
  if (section === 'photos') result.rows = await getSignedPhotoUrls(result.rows || [], { purpose:'preview' });
  return result;
}
export async function listAllClientPortalSection(section,{filters={}}={}){const pageSize=clampSize(section,100),first=await listClientPortalSection(section,{page:1,pageSize,filters}),rows=[...(first.rows||[])];const pages=Math.ceil((first.total||0)/(first.page_size||pageSize));for(let page=2;page<=pages;page+=1)rows.push(...((await listClientPortalSection(section,{page,pageSize,filters})).rows||[]));return rows;}
export async function inviteClientMember({email,name}){
  const normalizedEmail=String(email||'').trim().toLowerCase();
  let invitation;
  try{invitation=await rpc('client_admin_invite_member_v120',{p_email:normalizedEmail,p_name:name});}
  catch(error){
    if(error?.code!=='23505')throw error;
    const{data, error:lookupError}=await supabase.from('client_member_invitations').select('id,status').eq('email',normalizedEmail).eq('status','pending').maybeSingle();
    if(lookupError||!data)throw lookupError||error;
    invitation={invitation_id:data.id,status:data.status,reused:true};
  }
  return invokeInvitation({origin:'client-admin',invitation_id:invitation.invitation_id,email:normalizedEmail,nom:String(name||'').trim()});
}
export const deactivateClientMember = memberId => rpc('client_admin_deactivate_member_v120', { p_member_id: memberId });
export const updateClientMemberCampaignAccess = ({ memberId, campaignId, allowed }) => rpc('client_admin_set_campaign_access_v120', { p_member_id: memberId, p_campaign_id: campaignId, p_allowed: Boolean(allowed) });
export const createMultiSupportClientRequest = ({type,priority,description,supportIds}) => rpc('creer_requete_client_multi_supports_v133',{p_type:type,p_priorite:priority,p_description:description,p_support_ids:[...new Set(supportIds.map(String))]});
