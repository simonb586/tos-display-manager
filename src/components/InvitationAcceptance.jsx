import React, { useRef, useState } from 'react';
import { LoaderCircle, ShieldCheck } from 'lucide-react';
import BrandLogo from './BrandLogo';
import { supabase } from '../lib/supabaseClient';
import {
  acceptInvitation,
  invitationErrorMessage,
  readInvitationParameters
} from '../services/invitationAcceptanceService';

export default function InvitationAcceptance() {
  const [{ tokenHash, valid }] = useState(() => readInvitationParameters());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(valid ? '' : 'Ce lien d’invitation est invalide.');
  const attemptActive = useRef(false);

  async function activate() {
    if (!valid || attemptActive.current) return;
    attemptActive.current = true;
    setBusy(true);
    setMessage('');
    try {
      await acceptInvitation(supabase, tokenHash);
      window.location.assign('/set-password');
    } catch (error) {
      setMessage(invitationErrorMessage(error));
      attemptActive.current = false;
      setBusy(false);
    }
  }

  return <div className="activation-page"><section className="activation-card invitation-acceptance-card">
    <div className="activation-brand"><BrandLogo priority/><div>
      <h1>Votre compte Groupe TOS est prêt à être activé.</h1>
      <p>Confirmez votre choix pour poursuivre vers la création de votre mot de passe.</p>
    </div></div>
    {message && <div className="activation-message" role="alert">{message}</div>}
    <button className="activation-submit" type="button" disabled={!valid || busy} onClick={activate}>
      {busy ? <LoaderCircle className="spin" size={19}/> : <ShieldCheck size={19}/>}
      {busy ? 'Activation en cours…' : 'Activer mon compte'}
    </button>
    <a className="invitation-login-link" href="/">Revenir à la connexion</a>
  </section></div>;
}
