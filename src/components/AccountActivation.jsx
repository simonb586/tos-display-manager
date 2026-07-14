import React, { useMemo, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const rules = [
  { key: 'length', label: 'Au moins 12 caractères', test: value => value.length >= 12 },
  { key: 'upper', label: 'Une lettre majuscule', test: value => /[A-Z]/.test(value) },
  { key: 'lower', label: 'Une lettre minuscule', test: value => /[a-z]/.test(value) },
  { key: 'number', label: 'Un chiffre', test: value => /\d/.test(value) },
  { key: 'special', label: 'Un caractère spécial', test: value => /[^A-Za-z0-9]/.test(value) }
];

export default function AccountActivation({ session, profile, onActivated }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [completed, setCompleted] = useState(false);

  const results = useMemo(() => Object.fromEntries(rules.map(rule => [rule.key, rule.test(password)])), [password]);
  const valid = rules.every(rule => results[rule.key]) && password === confirmation && Boolean(password);

  async function activate(event) {
    event.preventDefault();
    setMessage('');
    if (!valid) { setMessage('Le mot de passe ne respecte pas encore toutes les exigences.'); return; }
    setBusy(true);
    try {
      const { error: passwordError } = await supabase.auth.updateUser({
        password,
        data: { account_activated: true, account_activated_at: new Date().toISOString() }
      });
      if (passwordError) throw passwordError;

      const { error: rpcError } = await supabase.rpc('mark_current_user_active');
      if (rpcError) console.warn('[TDM] Activation du profil non confirmée:', rpcError.message);

      setCompleted(true);
      setMessage('Compte activé avec succès.');
    } catch (error) {
      setMessage(error.message || 'Activation impossible.');
    } finally { setBusy(false); }
  }

  if (completed) {
    return <div className="activation-page"><section className="activation-card activation-success">
      <CheckCircle2 size={54}/><h1>Compte activé avec succès</h1>
      <p>Bienvenue chez Groupe TOS. Ton accès est maintenant actif.</p>
      <button onClick={onActivated}>Accéder à l’application terrain</button>
    </section></div>;
  }

  return <div className="activation-page"><section className="activation-card">
    <div className="activation-brand"><ShieldCheck size={38}/><div>
      <h1>Bienvenue dans TOS Display Manager</h1>
      <p>Pour terminer ton inscription, choisis ton mot de passe.</p>
    </div></div>
    <div className="activation-user"><strong>{profile?.nom || session?.user?.email}</strong><span>{session?.user?.email}</span><small>Rôle : {profile?.role || 'Installateur'}</small></div>
    <form onSubmit={activate}>
      <label>Nouveau mot de passe<div className="activation-password-field"><KeyRound size={18}/><input autoFocus type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password"/><button type="button" onClick={() => setShow(v => !v)}>{show ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
      <label>Confirmer le mot de passe<div className="activation-password-field"><KeyRound size={18}/><input type={show ? 'text' : 'password'} value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="new-password"/></div></label>
      <div className="activation-rules">{rules.map(rule => <div key={rule.key} className={results[rule.key] ? 'valid' : ''}><CheckCircle2 size={16}/>{rule.label}</div>)}<div className={confirmation && password === confirmation ? 'valid' : ''}><CheckCircle2 size={16}/>Les deux mots de passe correspondent</div></div>
      {message && <div className="activation-message">{message}</div>}
      <button className="activation-submit" disabled={!valid || busy}>{busy ? <LoaderCircle className="spin" size={19}/> : <ShieldCheck size={19}/>}Activer mon compte</button>
    </form>
  </section></div>;
}
