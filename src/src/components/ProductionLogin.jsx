import React, { useState } from 'react';
import { Lock, Mail, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { requestPasswordReset } from '../services/authProfileService';
import '../features/production/bloc-7-5-production.css';

export default function ProductionLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error) {
      setMessage(error.message || 'Connexion impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    if (!email) {
      setMessage('Inscris d’abord ton adresse courriel.');
      return;
    }
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setMessage('Un courriel de réinitialisation a été envoyé.');
    } catch (error) {
      setMessage(error.message || 'Envoi impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="production-login-page">
      <form className="production-login-card" onSubmit={login}>
        <div className="production-login-logo">TOS<span>Display Manager</span></div>
        <div className="production-login-icon"><ShieldCheck size={30}/></div>
        <h1>Connexion sécurisée</h1>
        <p>Accès réservé aux utilisateurs autorisés de Groupe TOS.</p>
        <label><Mail size={17}/> Adresse courriel
          <input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)}/>
        </label>
        <label><Lock size={17}/> Mot de passe
          <input type="password" required autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)}/>
        </label>
        <button type="submit" disabled={busy}>{busy ? 'Connexion...' : 'Se connecter'}</button>
        <button className="link-button" type="button" onClick={forgotPassword} disabled={busy}>Mot de passe oublié</button>
        {message && <div className="production-login-message">{message}</div>}
      </form>
    </div>
  );
}
