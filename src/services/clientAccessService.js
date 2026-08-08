import { supabase, supabaseConfigured } from '../lib/supabaseClient.js';
import { isClientRole } from '../lib/clientPermissions.js';
export { CLIENT_ROLES, isClientRole, isClientAdmin, requireClientIdentity } from '../lib/clientPermissions.js';

export async function getClientPortalIdentity() {
  if (!supabaseConfigured || !supabase) throw new Error('Service sécurisé indisponible.');
  const { data, error } = await supabase.rpc('client_portal_identity_v120');
  if (error) throw error;
  if (!data?.organization_id || !isClientRole(data?.role)) throw new Error('Identité client non autorisée.');
  return Object.freeze(data);
}
