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
