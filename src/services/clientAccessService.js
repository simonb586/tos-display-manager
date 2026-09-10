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

export async function getCurrentUserVisibleViews() {
  if (!supabaseConfigured || !supabase) throw new Error('Service sécurisé indisponible.');
  const { data, error } = await supabase.rpc('current_user_visible_views_v136');
  if (error) throw error;
  const { data: columns, error: columnError } = await supabase.from('role_ui_permissions')
    .select('visible_columns').eq('role', data?.role).maybeSingle();
  if (columnError) throw columnError;
  return Object.freeze({
    role: data?.role || null,
    client_id: data?.client_id || null,
    visible_tables: Array.isArray(data?.visible_tables) ? data.visible_tables : [],
    visible_columns: columns?.visible_columns || {}
  });
}
