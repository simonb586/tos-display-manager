import { supabase } from '../lib/supabaseClient';
import { clientPortalAccessStatus } from '../lib/clientPortalAccessStatus';
import { inviteRealUser } from './userProvisioningService';

async function rpc(name, args = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

export async function listClientAccessOverview() {
  return (await rpc('admin_client_access_overview_v135')).map(row => ({ ...row, portal_access_status: clientPortalAccessStatus(row) }));
}
export const getClientAccessDetail = id => rpc('admin_client_access_detail_v135', { p_client_id: +id });
export const createClient = payload => rpc('admin_create_client_v135', { p_payload: payload });
export const updateClient = (id, payload) => rpc('admin_update_client_v135', { p_client_id: +id, p_payload: payload });
export const searchClientUsers = query => rpc('admin_search_client_users_v136', { p_query: String(query || '') });
export const linkUserToClient = ({ userId, clientId, role }) => rpc('admin_link_user_to_client_v136', { p_user_id: +userId, p_client_id: +clientId, p_role: role });
export const unlinkUserFromClient = userId => rpc('admin_unlink_user_from_client_v136', { p_user_id: +userId });
export const transferUserClient = ({ userId, clientId, role }) => rpc('admin_transfer_user_client_v136', { p_user_id: +userId, p_client_id: +clientId, p_role: role });
export const changeClientUserRole = ({ userId, role }) => rpc('admin_change_client_user_role_v136', { p_user_id: +userId, p_role: role });
export const inviteClientUser = (client, form) => inviteRealUser({ nom: form.nom, courriel: form.courriel, role: form.role, organisation: client.nom_client, client_id: client.client_id });
export const inviteClientAdmin = (client, form) => inviteClientUser(client, { ...form, role: 'Client-Admin' });
