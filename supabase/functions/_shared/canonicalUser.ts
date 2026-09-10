export class AuthorizationError extends Error {
  status = 403;
}

export async function requireClientOwner(admin: any, clientId: number | null) {
  if (clientId === null) return;
  if (!Number.isSafeInteger(clientId) || clientId <= 0) throw new AuthorizationError('client_scope_invalid');
  const { data, error } = await admin.from('clients').select('id').eq('id', clientId).maybeSingle();
  if (error || !data) throw new AuthorizationError('client_scope_invalid');
}

export async function requireCanonicalUser(admin: any, authUser: any, roles: string[]) {
  const { data, error } = await admin.from('utilisateurs')
    .select('id,auth_user_id,role,statut,client_id,organisation,courriel')
    .eq('auth_user_id', authUser.id).maybeSingle();
  if (error || !data || String(data.statut || '').toLowerCase() !== 'actif' || !roles.includes(data.role)) {
    throw new AuthorizationError('canonical_profile_required');
  }
  await requireClientOwner(admin, data.client_id);
  return data;
}

export function requireTargetScope(actor: any, targetClientId: number | null) {
  if (actor.client_id !== null && actor.client_id !== targetClientId) {
    throw new AuthorizationError('cross_client_denied');
  }
}
