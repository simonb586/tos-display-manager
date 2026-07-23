import React, { useEffect, useState } from 'react';
import { Lock, LogOut, UserCheck } from 'lucide-react';
import { getCurrentSession, getUserProfile, signIn, signOut } from '../services/authService';

export default function Bloc3LoginPanel() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  async function loadSession() {
    const s = await getCurrentSession();
    setSession(s);
    if (s?.user?.id) {
      const p = await getUserProfile(s.user.id);
      setProfile(p);
    } else {
      setProfile(null);
    }
  }

  useEffect(() => {
    loadSession().catch(() => {});
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setStatus('loading');
    setError('');

    try {
      const data = await signIn(email, password);
      setSession(data.session);
      const p = await getUserProfile(data.user.id);
      setProfile(p);
      setStatus('done');
    } catch (err) {
      setError(err.message || 'Connexion impossible');
      setStatus('error');
    }
  }

  async function handleLogout() {
    await signOut();
    setSession(null);
    setProfile(null);
  }

  if (session) {
    return (
      <section className="bloc3-card">
        <div className="bloc3-status">
          <UserCheck size={22} />
          <div>
            <h2>Connexion active</h2>
            <p>{session.user.email}</p>
            <p>Rôle : <strong>{profile?.role || 'non défini'}</strong></p>
          </div>
        </div>
        <button className="bloc3-secondary" onClick={handleLogout}>
          <LogOut size={18} />
          Déconnexion
        </button>
      </section>
    );
  }

  return (
    <section className="bloc3-card">
      <div className="bloc3-title">
        <Lock size={24} />
        <div>
          <h2>Connexion</h2>
          <p>Connexion sécurisée et gestion des rôles.</p>
        </div>
      </div>

      <form className="bloc3-form" onSubmit={handleLogin}>
        <label>
          Courriel
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="nom@entreprise.com" />
        </label>

        <label>
          Mot de passe
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" />
        </label>

        {error && <div className="bloc3-error">{error}</div>}

        <button type="submit" disabled={status === 'loading'}>
          {status === 'loading' ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>
    </section>
  );
}
