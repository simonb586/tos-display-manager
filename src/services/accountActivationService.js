import { supabase } from '../lib/supabaseClient';

export function isInvitationSession(session) {
  const user = session?.user;
  if (!user) return false;
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const type = params.get('type') || hash.get('type') || '';
  return Boolean(type === 'invite' || params.has('code') || hash.has('access_token') || hash.has('refresh_token'));
}

export function requiresAccountActivation(session, profile) {
  if (!session?.user) return false;
  const metadata = session.user.user_metadata || {};
  const status = String(profile?.invitation_statut || '').toLowerCase();
  if (metadata.account_activated === true) return false;
  if (status === 'compte activé') return false;
  return isInvitationSession(session) || status.includes('invitation') || !profile?.premiere_connexion_le;
}

export function activationLinkError() {
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return params.get('error_description') || hash.get('error_description') || '';
}

export function activationState(session, profile, loading = false) {
  if (loading) return 'loading';
  if (!session?.user) return activationLinkError() ? 'expired' : 'invalid';
  const metadata = session.user.user_metadata || {};
  const status = String(profile?.invitation_statut || '').toLowerCase();
  if (metadata.account_activated === true || status === 'compte activé' || profile?.compte_active_le) return 'already-activated';
  if (metadata.account_activated === false || status.includes('invitation')) return 'ready';
  return 'invalid';
}

export async function completeClientInvitationActivation() {
  const { data, error } = await supabase.functions.invoke('invite-user', { body: { action: 'complete_client_activation' } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
