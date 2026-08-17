const INVITATION_TYPE = 'invite';

export function readInvitationParameters(location = window.location) {
  const params = new URLSearchParams(location.search || '');
  const tokenHash = String(params.get('token_hash') || '').trim();
  const type = String(params.get('type') || '').trim().toLowerCase();

  return {
    tokenHash,
    type,
    valid: type === INVITATION_TYPE && /^[A-Za-z0-9_-]{20,}$/.test(tokenHash)
  };
}

export function invitationErrorMessage(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();

  if (code.includes('already') || message.includes('already been used') || message.includes('already used')) {
    return 'Ce lien a déjà été utilisé. Vous pouvez vous connecter.';
  }
  if (code === 'otp_expired' || message.includes('expired') || message.includes('expiré')) {
    return 'Ce lien d’invitation a expiré. Demandez un nouveau lien d’invitation.';
  }
  return 'Ce lien d’invitation est invalide.';
}

export async function acceptInvitation(supabaseClient, tokenHash) {
  const { data, error } = await supabaseClient.auth.verifyOtp({
    token_hash: tokenHash,
    type: INVITATION_TYPE
  });
  if (error) throw error;

  const session = data?.session || (await supabaseClient.auth.getSession()).data?.session;
  if (!session) throw new Error('invitation_session_missing');
  return session;
}
