export const CLIENT_ROLES = Object.freeze(['Client', 'Client-Admin']);
export const isClientRole = role => CLIENT_ROLES.includes(role);
export const isClientAdmin = role => role === 'Client-Admin';
export function requireClientIdentity(profile) {
  if (!profile || !isClientRole(profile.role) || !profile.client_id) throw new Error('Périmètre client non autorisé.');
  return Object.freeze({ role: profile.role, organizationId: String(profile.client_id) });
}
