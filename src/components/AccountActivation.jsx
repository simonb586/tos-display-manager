import React, { useMemo, useState } from 'react';
import { CheckCircle2, KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { activationState, completeClientInvitationActivation } from '../services/accountActivationService';

const rules = [
  { key: 'length', label: 'Au moins 12 caractères', test: value => value.length >= 12 },
  { key: 'upper', label: 'Une lettre majuscule', test: value => /[A-Z]/.test(value) },
  { key: 'lower', label: 'Une lettre minuscule', test: value => /[a-z]/.test(value) },
  { key: 'number', label: 'Un chiffre', test: value => /\d/.test(value) },
  { key: 'special', label: 'Un caractère spécial', test: value => /[^A-Za-z0-9]/.test(value) }
];

function ActivationNotice({ title, children }) {
  return <div className="activation-page"><section className="activation-card activation-success">
    <ShieldCheck size={54}/><h1>{title}</h1><p>{children}</p>
    <button onClick={() => window.location.assign('/')}>Retour à la connexion</button>
  </section></div>;
}

export default function AccountActivation({ session, profile, loading, onActivated }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const state = activationState(session, profile, loading);
  const results = useMemo(() => Object.fromEntries(rules.map(rule => [rule.key, rule.test(password)])), [password]);
  const valid = rules.every(rule => results[rule.key]) && password === confirmation && Boolean(password);

  async function activate(event) {
    event.preventDefault();
    if (busy) return;
    setMessage('');
    if (!valid) { setMessage('Le mot de passe ne respecte pas encore toutes les exigences ou sa confirmation diffère.'); return; }
    setBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) throw new Error('Lien d’activation invalide ou expiré.');
      const { error: passwordError } = await supabase.auth.updateUser({
        password,
        data: { account_activated: true, account_activated_at: new Date().toISOString() }
      });
      if (passwordError) throw passwordError;
      const { error: rpcError } = await supabase.rpc('mark_current_user_active');
      if (rpcError) throw rpcError;
      if (['Client', 'Client-Admin'].includes(profile?.role)) await completeClientInvitationActivation();
      await onActivated();
    } catch (error) {
      setMessage(error.message || 'Activation impossible. Demandez une nouvelle invitation.');
      setBusy(false);
    }
  }

  if (state === 'loading') return <div className="app-startup" role="status"><div className="app-startup-card"><div className="app-startup-spinner"/><p>Validation de votre invitation…</p></div></div>;
  if (state === 'already-activated') return <ActivationNotice title="Ce compte est déjà activé.">Utilisez votre mot de passe pour vous connecter.</ActivationNotice>;
  if (state === 'expired') return <ActivationNotice title="Cette invitation a expiré ou n’est plus valide.">Demandez à votre administrateur de renvoyer l’invitation.</ActivationNotice>;
  if (state !== 'ready') return <ActivationNotice title="Lien d’activation invalide ou expiré.">Ouvrez le lien reçu dans votre courriel ou demandez une nouvelle invitation.</ActivationNotice>;

  return <div className="activation-page"><section className="activation-card">
    <div className="activation-brand"><ShieldCheck size={38}/><div><h1>Créer votre mot de passe</h1><p>Votre invitation a été confirmée. Choisissez maintenant votre mot de passe pour accéder au portail.</p></div></div>
    <div className="activation-user"><strong>{profile?.nom || session.user.email}</strong><span>{session.user.email}</span><small>Rôle : {profile?.role}</small></div>
    <form onSubmit={activate}>
      <label>Nouveau mot de passe<div className="activation-password-field"><KeyRound size={18}/><input autoFocus type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password"/></div></label>
      <label>Confirmer le mot de passe<div className="activation-password-field"><KeyRound size={18}/><input type="password" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="new-password"/></div></label>
      <div className="activation-rules">{rules.map(rule => <div key={rule.key} className={results[rule.key] ? 'valid' : ''}><CheckCircle2 size={16}/>{rule.label}</div>)}<div className={confirmation && password === confirmation ? 'valid' : ''}><CheckCircle2 size={16}/>Les deux mots de passe correspondent</div></div>
      {message && <div className="activation-message" role="alert">{message}</div>}
      <button className="activation-submit" disabled={!valid || busy}>{busy ? <LoaderCircle className="spin" size={19}/> : <ShieldCheck size={19}/>}Créer mon mot de passe</button>
    </form>
  </section></div>;
}
